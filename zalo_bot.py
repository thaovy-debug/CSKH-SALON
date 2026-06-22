import json
import os
import argparse
import sys
import struct
from urllib import request as urllib_request
from urllib import error as urllib_error
from zlapi import ZaloAPI
from zlapi.models import Message, ThreadType

# Class xử lý các sự kiện từ Zalo
class ZaloBot(ZaloAPI):
    def __init__(self, *args, message_handler=None, **kwargs):
        super().__init__(*args, **kwargs)
        self.message_handler = message_handler

    def onMessage(self, mid, author_id, message, message_object, thread_id, thread_type, **kwargs):
        """
        Hàm này được gọi khi có tin nhắn mới.
        """
        # Tránh tự trả lời tin nhắn của chính mình
        if author_id == self.uid():
            return

        print(f"--- Tin nhắn mới từ {author_id} ---")
        print(f"Nội dung: {message}")

        if self.message_handler and message:
            self.message_handler(self, author_id, message, thread_id, thread_type)
            return

    def onNotification(self, notification_obj, **kwargs):
        """
        Hàm này xử lý các thông báo khác (ví dụ: có người kết bạn, ...).
        """
        pass

def load_session():
    # Đường dẫn tới các file cấu hình
    runtime_dir = os.getenv("ZALO_RUNTIME_DIR", "./data-runtime")
    cookies_path = os.path.join(runtime_dir, 'zalo_cookies.json')
    imei_path = os.path.join(runtime_dir, 'zalo_imei.json')
    ua_path = os.path.join(runtime_dir, 'zalo_user_agent.json')

    if not all(os.path.exists(p) for p in [cookies_path, imei_path]):
        print("❌ Thiếu file cấu hình (cookies hoặc imei).")
        return None, None, None

    with open(cookies_path, 'r') as f:
        cookies = json.load(f)
        if isinstance(cookies, list):
            normalized = {}
            for item in cookies:
                if isinstance(item, dict):
                    key = item.get("key") or item.get("name")
                    value = item.get("value")
                    if key:
                        normalized[str(key)] = "" if value is None else str(value)
            cookies = normalized
    
    with open(imei_path, 'r') as f:
        imei_data = json.load(f)
        imei = imei_data.get('imei')
    
    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    if os.path.exists(ua_path):
        with open(ua_path, 'r') as f:
            ua_data = json.load(f)
            ua = ua_data.get('userAgent') or ua

    return cookies, imei, ua

def create_client():
    cookies, imei, ua = load_session()

    if not cookies or not imei or not ua:
        raise RuntimeError("Không thể khởi động bot. Vui lòng kiểm tra lại các file config.")

    return ZaloBot("", "", imei=imei, cookies=cookies, user_agent=ua)

def get_backend_url():
    return (
        os.getenv("SALONDESK_APP_URL")
        or os.getenv("NEXT_PUBLIC_APP_URL")
        or "http://127.0.0.1:3000"
    ).rstrip("/")

def get_account_id():
    return os.getenv("ZALO_ACCOUNT_ID", "").strip()

def get_relay_secret():
    return os.getenv("ZALO_RELAY_SECRET", "").strip()

def fetch_ai_reply(author_id, text, thread_id):
    payload = {
        "authorId": str(author_id),
        "threadId": str(thread_id),
        "message": text,
        "displayName": f"Zalo {author_id}",
    }
    account_id = get_account_id()
    if account_id:
        payload["accountId"] = account_id

    headers = {"Content-Type": "application/json"}
    relay_secret = get_relay_secret()
    if relay_secret:
        headers["x-zalo-relay-secret"] = relay_secret

    req = urllib_request.Request(
        f"{get_backend_url()}/api/channels/zalo/incoming",
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )

    try:
        with urllib_request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode("utf-8"))
            return data.get("response")
    except urllib_error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="ignore")
        raise RuntimeError(f"Backend HTTP {error.code}: {detail}")
    except urllib_error.URLError as error:
        raise RuntimeError(f"Backend connection failed: {error}")

def default_message_handler(client, author_id, text, thread_id, thread_type):
    reply_text = fetch_ai_reply(author_id, text, thread_id)
    if not reply_text:
        print(f"⚠️ Không nhận được phản hồi AI cho {author_id}")
        return

    client.send(Message(text=reply_text), thread_id, thread_type)
    print(f"✅ Đã gửi phản hồi AI tới {author_id}")

def extract_user_id(phone_info):
    if phone_info is None:
        return None

    if isinstance(phone_info, dict):
        for key in ["userId", "uid", "id"]:
            if phone_info.get(key):
                return str(phone_info.get(key))
        data = phone_info.get("data")
        if isinstance(data, dict):
            for key in ["userId", "uid", "id"]:
                if data.get(key):
                    return str(data.get(key))
        return None

    for key in ["userId", "uid", "id"]:
        value = getattr(phone_info, key, None)
        if value:
            return str(value)

    data = getattr(phone_info, "data", None)
    if isinstance(data, dict):
        for key in ["userId", "uid", "id"]:
            if data.get(key):
                return str(data.get(key))

    return None

def send_message(phone_number, text):
    client = create_client()
    lookup = client.fetchPhoneNumber(phone_number)
    user_id = extract_user_id(lookup)

    if not user_id:
        raise RuntimeError("Không tìm thấy tài khoản Zalo từ số điện thoại này.")

    client.send(Message(text=text), user_id, ThreadType.USER)
    print(f"Sent message to {phone_number} ({user_id})")

def get_image_size(image_path):
    with open(image_path, "rb") as f:
        header = f.read(26)

    if len(header) >= 24 and header.startswith(b"\211PNG\r\n\032\n"):
        width, height = struct.unpack(">LL", header[16:24])
        return int(width), int(height)

    if len(header) >= 10 and header[:6] in (b"GIF87a", b"GIF89a"):
        width, height = struct.unpack("<HH", header[6:10])
        return int(width), int(height)

    with open(image_path, "rb") as f:
        data = f.read()

    if data[:2] == b"\xff\xd8":
        index = 2
        size = len(data)
        while index < size:
            while index < size and data[index] == 0xFF:
                index += 1
            if index >= size:
                break
            marker = data[index]
            index += 1
            if marker in (0xD8, 0xD9):
                continue
            if index + 2 > size:
                break
            segment_length = struct.unpack(">H", data[index:index + 2])[0]
            if segment_length < 2:
                break
            if marker in (
                0xC0, 0xC1, 0xC2, 0xC3,
                0xC5, 0xC6, 0xC7,
                0xC9, 0xCA, 0xCB,
                0xCD, 0xCE, 0xCF,
            ):
                if index + 7 > size:
                    break
                height, width = struct.unpack(">HH", data[index + 3:index + 7])
                return int(width), int(height)
            index += segment_length

    return 2560, 2560

def send_image_message(phone_number, text, image_path):
    client = create_client()
    lookup = client.fetchPhoneNumber(phone_number)
    user_id = extract_user_id(lookup)

    if not user_id:
        raise RuntimeError("Không tìm thấy tài khoản Zalo từ số điện thoại này.")

    width, height = get_image_size(image_path)
    client.sendLocalImage(
        image_path,
        user_id,
        ThreadType.USER,
        width=width,
        height=height,
        message=Message(text=text)
    )
    print(f"Sent image message to {phone_number} ({user_id})")

def main():
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command")

    send_parser = subparsers.add_parser("send")
    send_parser.add_argument("--phone", required=True)
    send_parser.add_argument("--message", required=True)

    send_image_parser = subparsers.add_parser("send-image")
    send_image_parser.add_argument("--phone", required=True)
    send_image_parser.add_argument("--message", required=True)
    send_image_parser.add_argument("--image", required=True)

    args = parser.parse_args()

    if args.command == "send":
        try:
            send_message(args.phone, args.message)
        except Exception as error:
            print(str(error), file=sys.stderr)
            sys.exit(1)
        return

    if args.command == "send-image":
        try:
            send_image_message(args.phone, args.message, args.image)
        except Exception as error:
            print(str(error), file=sys.stderr)
            sys.exit(1)
        return

    cookies, imei, ua = load_session()

    if not cookies or not imei or not ua:
        print("⚠️ Không thể khởi động bot. Vui lòng kiểm tra lại các file config.")
        return

    print("🚀 Đang khởi động Zalo Bot...")

    # Khởi tạo client
    # Lưu ý: email và password để trống vì chúng ta sử dụng cookies/imei để login
    client = ZaloBot("", "", imei=imei, cookies=cookies, user_agent=ua, message_handler=default_message_handler)

    print(f"✅ Đăng nhập thành công! Bot ID: {client.uid()}")
    print("Bot đang lắng nghe tin nhắn...")

    # Bắt đầu lắng nghe tin nhắn (chạy vòng lặp vô hạn)
    client.listen()

if __name__ == "__main__":
    main()
