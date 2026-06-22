# Bao cao tich hop Meta Facebook Messenger va Instagram

## 1. Tong quan

Du an LinhKienLed1000 da tich hop them 2 kenh moi:

```txt
Facebook Messenger
Instagram Direct Messaging API
```

Muc tieu cua integration:

```txt
Khach nhan Facebook Page hoac Instagram Business Account
-> Meta webhook
-> LinhKienLed1000
-> tao/tim Customer + Conversation
-> goi AI/RAG qua chat(conversation.id, text)
-> gui phan hoi lai nen tang tuong ung
```

Pham vi da giu dung theo ranh gioi ban dau:

- Khong sua `src/lib/ai/engine.ts`.
- Khong doi `prisma/schema.prisma`.
- Khong refactor WhatsApp, Email, Telegram, Zalo.
- Meta duoc trien khai nhu external channel adapter.
- Facebook va Instagram dung chung webhook route:

```txt
/api/webhooks/meta
```

## 2. Trang thai hien tai

```txt
Meta Integration Core: DONE
Facebook Messenger: DONE
Instagram Direct Messaging API: DONE
Settings UI Facebook/Instagram: DONE
Secret handling patch: DONE
Phase 1.5 Hardening: DONE
```

Da test thuc te:

- Facebook Page gui tin nhan vao va bot reply duoc.
- Instagram DM gui tin nhan vao va bot reply duoc.
- Webhook verify qua ngrok duoc.
- Ban dau bot tra "AI chua duoc cau hinh..." nen flow da di toi `chat(...)`.
- Sau khi cau hinh AI trong Settings, webhook van tra `200`.

## 3. Kien truc flow

```mermaid
flowchart TD
A[Facebook Page / Instagram DM] --> B[Meta Webhook]
B --> C[/api/webhooks/meta]
C --> D[Parse payload]
D --> E[Detect channel: facebook / instagram]
E --> F[Resolve Customer]
F --> G[Find or Create Conversation]
G --> H[chat(conversation.id, text)]
H --> I[Send reply via Meta Send API]
I --> J[Facebook / Instagram user receives reply]
```

Mapping channel:

- Facebook webhook payload duoc map thanh `channel = "facebook"`.
- Instagram webhook payload duoc map thanh `channel = "instagram"`.

Format `customerContact`:

```txt
facebook:<psid>
instagram:<sender_id>
```

## 4. Cac file da tao/sua

### Meta core

```txt
src/lib/channels/meta.ts
src/lib/channels/external-message.ts
src/app/api/webhooks/meta/route.ts
src/lib/customer-resolver.ts
src/proxy.ts
.env.example
```

- `src/lib/channels/meta.ts`: parse payload Meta, verify signature, goi Meta Send API, retry khi loi tam thoi, split message dai.
- `src/lib/channels/external-message.ts`: helper inbound flow `resolveCustomer -> find/create conversation -> chat(...)`.
- `src/app/api/webhooks/meta/route.ts`: GET verify webhook va POST nhan webhook.
- `src/lib/customer-resolver.ts`: ho tro `facebook` va `instagram` qua `Customer.metadata.externalContacts`.
- `src/proxy.ts`: allow public `/api/webhooks/meta`.
- `.env.example`: them bien moi truong Meta.

### Settings UI va config

```txt
src/app/(dashboard)/settings/page.tsx
src/app/api/channels/route.ts
src/app/api/channels/[type]/route.ts
src/lib/channels/config.ts
```

- Them tab Facebook va Instagram trong Settings.
- Cho phep luu config vao `Channel.config`.
- DB config uu tien hon `.env`.
- Secret duoc sanitize/mask khi GET API.
- Secret cu duoc giu lai neu input rong hoac masked khi Save.
- Callback URL hien thi dang public origin; neu dang local thi hien placeholder `<PUBLIC_APP_URL>/api/webhooks/meta`.

### Hardening

```txt
src/lib/channels/hardening.ts
src/lib/channels/meta.ts
src/app/api/webhooks/meta/route.ts
```

- Timeout guard cho tung webhook event.
- Retry nhe cho Meta Send API.
- Split response dai thanh nhieu message.
- Safe logging, khong log token, app secret, raw body.
- Signature verification tests.

### Tests

```txt
tests/unit/meta.test.ts
tests/unit/external-message.test.ts
tests/api/meta-webhook.test.ts
tests/unit/customer-resolver.test.ts
tests/api/settings.test.ts
tests/api/channels.test.ts
```

## 5. Cau hinh moi truong

```env
META_VERIFY_TOKEN="YOUR_META_VERIFY_TOKEN"
META_GRAPH_VERSION="v25.0"
FACEBOOK_PAGE_ACCESS_TOKEN="YOUR_FACEBOOK_PAGE_ACCESS_TOKEN"
INSTAGRAM_ACCESS_TOKEN="YOUR_INSTAGRAM_ACCESS_TOKEN"
INSTAGRAM_BUSINESS_ACCOUNT_ID="YOUR_INSTAGRAM_BUSINESS_ACCOUNT_ID"
META_APP_SECRET="YOUR_META_APP_SECRET"

META_WEBHOOK_EVENT_TIMEOUT_MS="8000"
META_SEND_MAX_RETRIES="2"
META_MAX_MESSAGE_LENGTH="1800"
```

Giai thich:

- `META_VERIFY_TOKEN`: token dung verify webhook.
- `META_GRAPH_VERSION`: version Graph API. Repo hien tai dung default `v25.0`; co the doi theo version Meta app dang cau hinh, vi du `v21.0` neu app dang chay version do.
- `FACEBOOK_PAGE_ACCESS_TOKEN`: fallback token cho Facebook neu DB chua config.
- `INSTAGRAM_ACCESS_TOKEN`: fallback token cho Instagram neu DB chua config.
- `INSTAGRAM_BUSINESS_ACCOUNT_ID`: dung ghi chu/kiem tra cau hinh Instagram.
- `META_APP_SECRET`: optional, dung verify `x-hub-signature-256`.
- `META_WEBHOOK_EVENT_TIMEOUT_MS`: timeout xu ly tung webhook event.
- `META_SEND_MAX_RETRIES`: so lan retry Send API.
- `META_MAX_MESSAGE_LENGTH`: do dai toi da moi message chunk.

Ghi chu:

- Config trong Settings/DB duoc uu tien hon `.env`.
- `.env` la fallback.
- Khong commit token that, access token that, app secret that vao repo.

## 6. Settings Facebook

Field trong tab Facebook:

```txt
verifyToken
pageAccessToken
pageId
graphVersion
appSecret
```

- `verifyToken`: dung cho Meta webhook verification.
- `pageAccessToken`: dung gui reply Facebook.
- `pageId`: tuy chon, dung ghi chu/kiem tra cau hinh; khong bat buoc neu da co Page Access Token.
- `graphVersion`: vi du `v25.0` hoac version Meta app dang dung.
- `appSecret`: dung verify chu ky webhook neu bat.

Secret handling:

- Token/appSecret khong hien thi lai sau khi luu.
- De trong token/appSecret khi Save nghia la giu gia tri cu.
- Muon doi token thi nhap token moi roi Save.
- Hien chua co nut clear token.

## 7. Settings Instagram

Field trong tab Instagram:

```txt
verifyToken
accessToken
businessAccountId
graphVersion
appSecret
```

- Instagram dung direct Instagram Messaging API.
- Khong di qua Facebook Messenger bridge.
- `businessAccountId`: dung ghi chu/kiem tra cau hinh.
- `accessToken`: dung gui reply Instagram.
- `graphVersion`: vi du `v25.0` hoac version Meta app dang dung.
- `appSecret`: dung verify signature neu bat.

Webhook van dung chung:

```txt
/api/webhooks/meta
```

Parser phan biet Instagram qua payload/source va map thanh:

```txt
channel = "instagram"
```

## 8. Webhook callback URL

Callback URL dung trong Meta Developer App:

```txt
<APP_ORIGIN>/api/webhooks/meta
```

Vi du local qua ngrok:

```txt
https://xxxxx.ngrok-free.app/api/webhooks/meta
```

Dung cung callback cho:

- Facebook Messenger
- Instagram Direct Messaging API

## 9. Local testing bang ngrok

Chay app local:

```bash
npm run dev
ngrok http 3000
```

Callback URL:

```txt
https://<ngrok-domain>/api/webhooks/meta
```

Test GET verify:

```bash
curl "http://localhost:3000/api/webhooks/meta?hub.mode=subscribe&hub.verify_token=<VERIFY_TOKEN>&hub.challenge=hello123"
```

Ket qua mong muon:

```txt
hello123
```

Test POST payload gia Facebook:

```bash
curl -X POST "http://localhost:3000/api/webhooks/meta" -H "Content-Type: application/json" -d "{\"object\":\"page\",\"entry\":[{\"messaging\":[{\"sender\":{\"id\":\"USER_PSID_TEST\"},\"recipient\":{\"id\":\"PAGE_ID_TEST\"},\"message\":{\"text\":\"hello\"}}]}]}"
```

Test POST payload gia Instagram:

```bash
curl -X POST "http://localhost:3000/api/webhooks/meta" -H "Content-Type: application/json" -d "{\"object\":\"instagram\",\"entry\":[{\"messaging\":[{\"sender\":{\"id\":\"IG_SENDER_TEST\"},\"recipient\":{\"id\":\"IG_BUSINESS_TEST\"},\"message\":{\"text\":\"hello\"}}]}]}"
```

Ghi chu: POST payload gia chi nen dung khi moi truong dev khong bat `META_APP_SECRET`, hoac can them header signature hop le neu dang bat signature verification.

## 10. Ket qua test da chay

### Phase 1 core

```txt
npx tsc --noEmit
PASS
```

```txt
npm test -- tests/unit/meta.test.ts tests/unit/external-message.test.ts tests/api/meta-webhook.test.ts tests/unit/customer-resolver.test.ts
PASS: 4 files, 27 tests
```

### Settings va secret handling

```txt
npm test -- tests/unit/meta.test.ts tests/api/meta-webhook.test.ts tests/api/settings.test.ts tests/api/channels.test.ts
PASS
```

### Phase 1.5 hardening

```txt
npx tsc --noEmit
PASS
```

```txt
npm test -- tests/unit/meta.test.ts tests/api/meta-webhook.test.ts tests/api/channels.test.ts tests/api/settings.test.ts tests/unit/external-message.test.ts tests/unit/customer-resolver.test.ts
PASS: 6 files, 56 tests
```

Ghi chu:

- `npm run lint` hoac full lint co the con fail do loi legacy ngoai pham vi, vi du `scratch/*`, `fix-db-vi.cjs`, `test-db.js`.
- Khong sua cac loi legacy trong pham vi Meta integration.

## 11. DB persistence

Da kiem tra DB voi ket qua dang mong doi:

```txt
Conversation:
- channel = facebook
- customerContact = facebook:<psid>

Conversation:
- channel = instagram
- customerContact = instagram:<sender_id>

Message:
- role = customer
- role = assistant
```

Metadata customer:

```json
{
  "externalContacts": {
    "facebook": "facebook:<psid>",
    "instagram": "instagram:<sender_id>"
  }
}
```

Ghi chu:

- Khong in ID that, PSID that, sender ID that, token that trong tai lieu.
- Page ID co the de trong neu chi dung Page Access Token de gui reply.

## 12. Secret handling

Van de tung phat hien:

- Ban dau GET channels tra raw token/appSecret.
- Save rong co the overwrite secret cu.

Da va:

- GET khong tra raw secret.
- Chi tra cac flag an toan:

```txt
hasPageAccessToken
hasAccessToken
hasAppSecret
```

- PUT/POST giu secret cu neu input rong hoac masked.
- UI hien thi "Da cau hinh. De trong neu khong muon thay doi."
- Token/appSecret van duoc nhap bang password input.

## 13. Hardening da lam

### Timeout guard

```txt
META_WEBHOOK_EVENT_TIMEOUT_MS=8000
```

Muc dich: giam rui ro webhook cho qua lau lam Meta retry.

Gioi han hien tai: timeout guard khong cancel duoc `chat(...)` neu promise da bat dau chay; no chi giup route khong cho vo han.

### Send API retry

```txt
META_SEND_MAX_RETRIES=2
```

Retry cho:

- network error
- HTTP 429
- HTTP 5xx

Khong retry cho:

- 400
- 401
- 403

### Long message split

```txt
META_MAX_MESSAGE_LENGTH=1800
```

Bot reply dai duoc chia thanh nhieu message gui theo thu tu. Neu mot chunk gui fail thi dung va log loi an toan.

### Safe logging

Khong log:

- raw body
- access token
- app secret
- full user message

Co log an toan:

- ignored event
- processed event
- duration
- send failure status
- timeout

### Signature verification

Ho tro:

- Env app secret.
- DB app secret candidates.
- Invalid signature tra `401`.
- Khong co app secret thi skip verify de local/dev thuan tien.

## 14. Nhung gi chua support

Chua support:

- Attachment.
- Image.
- Sticker.
- Quick reply.
- Reaction.
- Delivery/read events ngoai viec ignored.
- Queue/background worker that.
- External identity table/schema toi uu lon.
- UI clear token.

## 15. Rui ro con lai

```txt
1. Webhook van sync, chua phai queue that.
2. Timeout guard khong cancel duoc chat(...) neu da chay trong nen.
3. Neu traffic tang, nen them queue/background worker o Phase 2.
4. Resolver metadata scan toi da 1000 customer, on hien tai nhung khong toi uu lau dai.
5. Token Meta co the het han/quyen sai, can kiem tra tren Meta dashboard.
```

## 16. Phase sau de xuat

### Phase 2

- Queue/background worker.
- External identity table hoac schema/index rieng.
- Support attachment/image.
- Dashboard trang thai channel Facebook/Instagram.
- Nut clear token.
- Production monitoring.

## 17. Tom tat

Facebook Messenger va Instagram Direct Messaging API da duoc tich hop thanh cong vao LinhKienLed1000 nhu hai external channels moi. He thong giu nguyen AI/RAG core, dung chung webhook `/api/webhooks/meta`, luu conversation/message/customer theo channel rieng, co Settings UI de cau hinh, da xu ly secret masking/preserve, va da bo sung hardening co ban gom timeout, retry, split message, safe logging va signature verification. Integration hien san sang cho demo/dev va co nen tang tot de tien toi production sau khi bo sung queue/background worker neu traffic tang.
