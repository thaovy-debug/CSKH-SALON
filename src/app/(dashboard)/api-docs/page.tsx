"use client";

import { Header } from "@/components/layout/header";
import {
  Key,
  ChevronDown,
  ChevronRight,
  Send,
  Copy,
  Check,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Ticket,
  BookOpen,
  Users,
  Webhook,
  Download,
  Heart,
} from "lucide-react";
import { useState, useCallback, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Endpoint {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  description: string;
  requestBody?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responseExample: any;
  params?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    defaultValue?: string;
  }[];
  queryParams?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    defaultValue?: string;
  }[];
  headers?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    defaultValue?: string;
  }[];
}

interface ApiSection {
  id: string;
  name: string;
  icon: React.ElementType;
  endpoints: Endpoint[];
  notes?: string[];
  links?: { label: string; url: string }[];
  examples?: { label: string; data: unknown }[];
  guideGroups?: { title: string; items: string[] }[];
}

type DocsLanguage = "en" | "vi";

const docsUiText = {
  en: {
    pageTitle: "API Documentation",
    pageDescription: "Integrate LinhKienLed1000 with your systems",
    languageLabel: "Language",
    english: "English",
    vietnamese: "Tiếng Việt",
    guide: "Guide",
    endpoint: "endpoint",
    endpoints: "endpoints",
    integrationGuide: "Integration guide",
    authentication: "Authentication",
    authDescription: "All API requests require authentication",
    authIntroBefore: "Include your API key in the request headers using the",
    authIntroAfter:
      "header. You can generate and manage API keys from the Admin > API keys page.",
    authSecurity:
      "API keys can be configured with different permissions. Keep your keys secure and never expose them in client-side code. If a key is compromised, revoke it immediately from the Admin > API keys page and generate a new one.",
    notes: "Notes",
    integrationGuideTitle: "Integration Guide",
    examples: "Examples",
    officialDocs: "Official Docs",
    parameters: "Parameters",
    name: "Name",
    type: "Type",
    required: "Required",
    description: "Description",
    yes: "Yes",
    no: "No",
    requestBody: "Request Body",
    requestBodyJson: "Request Body (JSON)",
    response: "Response",
    tryIt: "Try it",
    sendRequest: "Send Request",
    copyToClipboard: "Copy to clipboard",
    requestFailed: "Request failed",
  },
  vi: {
    pageTitle: "Tài liệu API",
    pageDescription: "Tích hợp LinhKienLed1000 với hệ thống và các nền tảng bán hàng",
    languageLabel: "Ngôn ngữ",
    english: "English",
    vietnamese: "Tiếng Việt",
    guide: "Hướng dẫn",
    endpoint: "endpoint",
    endpoints: "endpoint",
    integrationGuide: "Hướng dẫn tích hợp",
    authentication: "Xác thực",
    authDescription: "Tất cả request API đều cần xác thực",
    authIntroBefore: "Gửi API key trong header request bằng",
    authIntroAfter:
      "header. Bạn có thể tạo và quản lý API key tại trang Admin > API keys.",
    authSecurity:
      "API key có thể được cấu hình theo từng quyền. Hãy bảo mật key và không đưa key vào code chạy phía client. Nếu key bị lộ, hãy thu hồi ngay trong Admin > API keys và tạo key mới.",
    notes: "Ghi chú",
    integrationGuideTitle: "Hướng dẫn tích hợp",
    examples: "Ví dụ",
    officialDocs: "Tài liệu chính thức",
    parameters: "Tham số",
    name: "Tên",
    type: "Kiểu",
    required: "Bắt buộc",
    description: "Mô tả",
    yes: "Có",
    no: "Không",
    requestBody: "Nội dung request",
    requestBodyJson: "Nội dung request (JSON)",
    response: "Phản hồi",
    tryIt: "Thử gọi API",
    sendRequest: "Gửi request",
    copyToClipboard: "Sao chép",
    requestFailed: "Request thất bại",
  },
} satisfies Record<DocsLanguage, Record<string, string>>;

const sectionNameVi: Record<string, string> = {
  "Channel Readiness Matrix": "Ma trận sẵn sàng kênh",
  "Connection Status Definitions": "Định nghĩa trạng thái kết nối",
  "Hướng Dẫn Sử Dụng": "Hướng dẫn sử dụng",
  "Real E2E Testing Checklist": "Checklist kiểm thử E2E thật",
  "What This App Cannot Bypass": "Những giới hạn app không thể bỏ qua",
  "Suggested Handoff Message": "Tin nhắn bàn giao gợi ý",
  Chat: "Chat",
  Conversations: "Hội thoại",
  Tickets: "Ticket hỗ trợ",
  "Knowledge Base": "Kho kiến thức",
  Troubleshooting: "Khắc phục lỗi",
  Settings: "Cài đặt",
  Webhooks: "Webhook",
  "Slack notifications": "Thông báo Slack",
  "Slack notification": "Thông báo Slack",
  "Meta Setup Guide": "Hướng dẫn cấu hình Meta",
  "Shopee Setup Guide": "Hướng dẫn cấu hình Shopee",
  "TikTok Shop Setup Guide": "Hướng dẫn cấu hình TikTok Shop",
  "Meta Shared Webhook": "Webhook dùng chung cho Meta",
  "Facebook Messenger": "Facebook Messenger",
  "Instagram Direct Messaging": "Instagram Direct Messaging",
  Export: "Xuất dữ liệu",
  "Health Check": "Kiểm tra hệ thống",
};

const commonTextVi: Record<string, string> = {
  "This matrix is the high-level truth for lead/customer discussion. It separates implemented code from production readiness.":
    "Ma trận này là nguồn đối chiếu cấp cao khi trao đổi với lead/khách hàng. Nó tách rõ phần đã có code và mức sẵn sàng production.",
  "Authorized is not the same as production-ready. Connected is not proof that a real customer can receive a bot reply.":
    "Đã ủy quyền không đồng nghĩa với sẵn sàng production. Đã kết nối cũng chưa chứng minh khách thật có thể nhận phản hồi từ bot.",
  "Any marketplace or social channel should pass a real end-to-end test before being called production-ready.":
    "Mọi kênh marketplace hoặc social cần qua kiểm thử end-to-end thật trước khi gọi là production-ready.",
  "These labels describe integration progress, not business approval. A channel can be authorized but still not ready for real customers.":
    "Các nhãn này mô tả tiến độ tích hợp, không phải phê duyệt kinh doanh. Một kênh có thể đã authorized nhưng vẫn chưa sẵn sàng cho khách thật.",
  "Authorized != production-ready. Connected != bot has replied successfully on the external platform.":
    "Authorized không đồng nghĩa production-ready. Connected không đồng nghĩa bot đã trả lời thành công trên nền tảng bên ngoài.",
  "Use this checklist when lead/customer provides real platform credentials. It is intentionally platform-neutral first, then platform-specific.":
    "Dùng checklist này khi lead/khách hàng cung cấp credential thật của nền tảng. Checklist được viết theo phần chung trước, rồi đến từng nền tảng.",
  "The goal is to prove the full path: platform customer message -> webhook/inbound -> conversation -> AI response -> outbound reply -> safe logs/fallback.":
    "Mục tiêu là chứng minh đủ luồng: khách nhắn trên nền tảng -> webhook/inbound -> hội thoại -> AI phản hồi -> gửi trả ra nền tảng -> log/fallback an toàn.",
  "The app cannot create a seller/page/business account for the customer. The customer must own or grant access to the platform account.":
    "App không thể tự tạo tài khoản seller/page/business cho khách. Khách cần sở hữu hoặc cấp quyền vào tài khoản nền tảng.",
  "The app cannot bypass Meta, Shopee, TikTok, Zalo, Telegram, or Twilio permissions, app review, approval, token expiry, rate limits, or compliance rules.":
    "App không thể bỏ qua quyền, app review, phê duyệt, hạn token, rate limit hoặc quy định tuân thủ của Meta, Shopee, TikTok, Zalo, Telegram hoặc Twilio.",
  "The app cannot guarantee price, stock, warranty, VAT, or product advice accuracy without official customer-provided data in Knowledge Base.":
    "App không thể bảo đảm độ chính xác về giá, tồn kho, bảo hành, VAT hoặc tư vấn sản phẩm nếu chưa có dữ liệu chính thức do khách cung cấp trong Kho kiến thức.",
  "The app should not store or display raw secrets, raw webhook payloads, raw buyer messages, or signatures in user-facing debug fields.":
    "App không nên lưu hoặc hiển thị raw secret, raw webhook payload, tin nhắn raw của người mua hoặc chữ ký trong phần debug cho người dùng.",
  "List all conversations with optional filtering by status or channel.":
    "Liệt kê tất cả hội thoại, có thể lọc theo trạng thái hoặc kênh.",
  "Create a new conversation.": "Tạo hội thoại mới.",
  "Get a specific conversation with its messages.":
    "Lấy một hội thoại cụ thể kèm danh sách tin nhắn.",
  "Update a conversation's status, customer info, or metadata.":
    "Cập nhật trạng thái, thông tin khách hàng hoặc metadata của hội thoại.",
  "Delete a conversation and all its messages.": "Xóa một hội thoại và toàn bộ tin nhắn.",
  "Add a message to an existing conversation.": "Thêm tin nhắn vào hội thoại hiện có.",
  "List all tickets with optional filtering.": "Liệt kê tất cả ticket, có thể lọc.",
  "Create a new support ticket.": "Tạo ticket hỗ trợ mới.",
  "Get a specific ticket with related conversation and assignment details.":
    "Lấy một ticket cụ thể kèm hội thoại liên quan và thông tin phân công.",
  "Update a ticket's status, priority, assignment, or resolution.":
    "Cập nhật trạng thái, độ ưu tiên, phân công hoặc kết quả xử lý của ticket.",
  "Delete a ticket permanently.": "Xóa vĩnh viễn một ticket.",
  "List all knowledge base categories with entry counts.":
    "Liệt kê danh mục Kho kiến thức kèm số lượng mục.",
  "Create a new knowledge base category.": "Tạo danh mục Kho kiến thức mới.",
  "List knowledge base entries, optionally filtered by category.":
    "Liệt kê mục trong Kho kiến thức, có thể lọc theo danh mục.",
  "Create a new knowledge base entry.": "Tạo mục Kho kiến thức mới.",
  "Get the current application settings.": "Lấy cấu hình hiện tại của ứng dụng.",
  "Update application settings. Only include the fields you want to change.":
    "Cập nhật cấu hình ứng dụng. Chỉ gửi các field cần thay đổi.",
  "List all configured webhooks.": "Liệt kê toàn bộ webhook đã cấu hình.",
  "Create a new webhook.": "Tạo webhook mới.",
  "Common troubleshooting guides": "Các hướng dẫn khắc phục lỗi thường gặp",
  "Frequently asked questions": "Câu hỏi thường gặp",
  "Data type: conversations, tickets, knowledge, customers":
    "Loại dữ liệu: conversations, tickets, knowledge, customers",
  "Output format: csv or json": "Định dạng xuất: csv hoặc json",
  "Conversation ID": "ID hội thoại",
  "Ticket ID": "ID ticket",
  "Filter by status: active, closed, archived":
    "Lọc theo trạng thái: active, closed, archived",
  "Filter by channel: web, whatsapp, email, phone":
    "Lọc theo kênh: web, whatsapp, email, phone",
  "Filter by status: open, in_progress, resolved, closed":
    "Lọc theo trạng thái: open, in_progress, resolved, closed",
  "Filter by priority: low, medium, high, urgent":
    "Lọc theo độ ưu tiên: low, medium, high, urgent",
  "Filter by category ID": "Lọc theo ID danh mục",
  "Internal ChannelAccount id for the Shopee shop placeholder/config.":
    "ID ChannelAccount nội bộ cho cấu hình/placeholder shop Shopee.",
  "Internal ChannelAccount id.": "ID ChannelAccount nội bộ.",
  "Authorized Shopee shop id.": "ID shop Shopee đã ủy quyền.",
  "Authorization code returned by Shopee.": "Mã authorization do Shopee trả về.",
  "Challenge string returned as text when verification succeeds.":
    "Chuỗi challenge được trả dạng text khi xác minh thành công.",
  "Webhook verify token from Channels -> Accounts -> Facebook/Instagram or META_VERIFY_TOKEN.":
    "Webhook verify token từ Kênh liên hệ -> Tài khoản -> Facebook/Instagram hoặc META_VERIFY_TOKEN.",
  "Use facebook.": "Dùng facebook.",
  "Use instagram.": "Dùng instagram.",
  "This guide is for admins or customers who need to connect Facebook Messenger and Instagram Direct Messaging for the first time.":
    "Hướng dẫn này dành cho admin hoặc khách hàng cần kết nối Facebook Messenger và Instagram Direct Messaging lần đầu.",
  "Both Facebook and Instagram use the same callback URL in LinhKienLed1000: <APP_ORIGIN>/api/webhooks/meta.":
    "Facebook và Instagram dùng chung callback URL trong LinhKienLed1000: <APP_ORIGIN>/api/webhooks/meta.",
  "Use this guide to understand what each key/token is, where it comes from, and where to paste it in Channels -> Accounts.":
    "Dùng hướng dẫn này để hiểu từng key/token là gì, lấy ở đâu và nhập vào đâu trong Kênh liên hệ -> Tài khoản.",
  "Meta Dashboard screens may change. Use the official Meta docs links as the source of truth for exact button names and review requirements.":
    "Giao diện Meta Dashboard có thể thay đổi. Hãy dùng link tài liệu chính thức của Meta làm nguồn chuẩn cho tên nút và yêu cầu review.",
  "Never paste real access tokens or app secrets into chat, screenshots, public docs, logs, or Git commits.":
    "Không dán access token hoặc app secret thật vào chat, ảnh chụp màn hình, tài liệu công khai, log hoặc Git commit.",
  "Confirm the business has a Facebook Page for Messenger. A personal Facebook profile is not enough for this integration.":
    "Xác nhận doanh nghiệp có Facebook Page dùng cho Messenger. Tài khoản Facebook cá nhân không đủ cho tích hợp này.",
  "Confirm the business has an Instagram Business or Creator account for Instagram Direct Messaging.":
    "Xác nhận doanh nghiệp có tài khoản Instagram Business hoặc Creator để dùng Instagram Direct Messaging.",
  "Make sure the person doing setup has admin/manage access to the Meta App, Facebook Page, and Instagram account.":
    "Đảm bảo người cấu hình có quyền admin/quản lý với Meta App, Facebook Page và tài khoản Instagram.",
  "Prepare the public app URL. In production this is the customer domain; in local testing use a public HTTPS tunnel such as ngrok.":
    "Chuẩn bị URL public của app. Production dùng domain của khách; test local thì dùng HTTPS tunnel public như ngrok.",
  "Decide one Verify Token string, for example led1000-meta-verify-token. This is not provided by Meta; you create it and paste the same value into LinhKienLed1000 and Meta Dashboard.":
    "Chọn một chuỗi Verify Token, ví dụ led1000-meta-verify-token. Meta không cấp giá trị này; mình tự tạo và nhập cùng một giá trị vào LinhKienLed1000 và Meta Dashboard.",
  "Facebook and Instagram can use the same Verify Token for simplicity, or separate Verify Tokens if configured separately. The value entered in Meta Dashboard must match the value saved in the corresponding LinhKienLed1000 channel settings.":
    "Facebook và Instagram có thể dùng chung Verify Token cho đơn giản, hoặc dùng token riêng nếu cấu hình tách biệt. Giá trị nhập trong Meta Dashboard phải khớp với giá trị lưu trong cấu hình kênh tương ứng của LinhKienLed1000.",
  "Keep Page Access Token, Instagram Access Token, and App Secret private. Do not send real values in chat, screenshots, public docs, or commits.":
    "Giữ kín Page Access Token, Instagram Access Token và App Secret. Không gửi giá trị thật qua chat, ảnh chụp màn hình, tài liệu công khai hoặc commit.",
  "Meta Developer App: the container in developers.facebook.com where products, webhook callback, app secret, and permissions are configured.":
    "Meta Developer App: vùng cấu hình trên developers.facebook.com, nơi thiết lập product, webhook callback, app secret và quyền.",
  "Facebook Page: the public page customers message through Messenger. It is different from the Meta Developer App.":
    "Facebook Page: trang công khai mà khách nhắn qua Messenger. Nó khác với Meta Developer App.",
  "Instagram Business or Creator Account: the Instagram account customers message through Direct Messaging.":
    "Instagram Business hoặc Creator Account: tài khoản Instagram mà khách nhắn qua Direct Messaging.",
  "Callback URL: the LinhKienLed1000 webhook URL Meta calls. Use <APP_ORIGIN>/api/webhooks/meta for both Facebook and Instagram.":
    "Callback URL: URL webhook của LinhKienLed1000 mà Meta sẽ gọi. Dùng <APP_ORIGIN>/api/webhooks/meta cho cả Facebook và Instagram.",
  "Verify Token: a shared text value used only when Meta verifies the callback URL. LinhKienLed1000 checks hub.verify_token against this value.":
    "Verify Token: chuỗi text dùng khi Meta xác minh callback URL. LinhKienLed1000 so sánh hub.verify_token với giá trị này.",
  "Access Token: the secret credential LinhKienLed1000 uses to send replies back to Facebook or Instagram.":
    "Access Token: credential bí mật mà LinhKienLed1000 dùng để gửi phản hồi lại Facebook hoặc Instagram.",
  "App Secret: the Meta App secret used to validate x-hub-signature-256 on webhook POST requests.":
    "App Secret: secret của Meta App dùng để xác thực x-hub-signature-256 trên request webhook POST.",
  "Graph Version: the Meta Graph API version used for send/config calls, for example v25.0.":
    "Graph Version: phiên bản Meta Graph API dùng cho lệnh gửi/cấu hình, ví dụ v25.0.",
  "Current app status: Shopee runtime scaffolding is implemented: account config, shop authorization start/callback, token exchange/refresh helper, webhook receiver, tolerant chat payload parser, normalized inbound handoff, and outbound send adapter. A saved or authorized account is not the same as production-ready; final verification still requires a real Shopee Partner App, an existing legitimate Seller shop, approved scopes, and an end-to-end buyer chat test.":
    "Trạng thái hiện tại: app đã có scaffold runtime Shopee gồm cấu hình account, start/callback ủy quyền shop, helper đổi/làm mới token, webhook receiver, parser payload chat linh hoạt, handoff vào normalized inbound và adapter gửi outbound. Account đã lưu hoặc đã authorized chưa đồng nghĩa production-ready; vẫn cần Shopee Partner App thật, shop Seller hợp lệ, scope được duyệt và test buyer chat end-to-end.",
  "Goal status: To make the bot answer real Shopee buyers, LED1000 needs an existing legitimate Shopee Seller/admin account, Shopee Open Platform partner app, approved scopes, and a real end-to-end buyer message test.":
    "Mục tiêu: để bot trả lời người mua Shopee thật, LED1000 cần tài khoản Shopee Seller/admin hợp lệ, Shopee Open Platform partner app, scope được duyệt và test tin nhắn người mua end-to-end thật.",
  "Official docs status: Shopee Open Platform docs and exact scopes can be gated by partner login. Treat the official docs and partner console as the source of truth for endpoint names, permission review, token lifetime, and message policy.":
    "Tài liệu chính thức: Shopee Open Platform docs và scope chính xác có thể yêu cầu đăng nhập partner. Hãy xem tài liệu chính thức và partner console là nguồn chuẩn cho tên endpoint, review quyền, vòng đời token và chính sách tin nhắn.",
  "Security: Never paste real partner_key, access_token, refresh_token, request signatures, tax/business verification data, or buyer personal data into chat, screenshots, public docs, logs, or Git commits.":
    "Bảo mật: không dán partner_key, access_token, refresh_token, chữ ký request, dữ liệu xác minh thuế/doanh nghiệp hoặc dữ liệu cá nhân người mua vào chat, ảnh chụp, tài liệu công khai, log hoặc Git commit.",
  "Current app status: TikTok Shop account storage, masked config, webhook receiver, tolerant customer-message parser, and normalized inbound handoff are implemented. Real auth URL, scopes, exact webhook payload/signature, and outbound send endpoint must be verified in TikTok Shop Partner Center before production.":
    "Trạng thái hiện tại: app đã có lưu account TikTok Shop, mask config, webhook receiver, parser tin nhắn khách linh hoạt và handoff normalized inbound. Auth URL thật, scope, payload/signature webhook chính xác và endpoint gửi outbound phải được xác minh trong TikTok Shop Partner Center trước production.",
  "Use TikTok Shop Partner Center/Open Platform for seller customer-service chat. TikTok for Developers and TikTok Business API are not the right surface for Seller Center buyer chat.":
    "Dùng TikTok Shop Partner Center/Open Platform cho chat chăm sóc khách hàng của seller. TikTok for Developers và TikTok Business API không phải bề mặt đúng cho buyer chat của Seller Center.",
  "Security: never paste real appSecret, access_token, refresh_token, webhook signatures, request bodies, or buyer personal data into chat, screenshots, public docs, logs, or Git commits.":
    "Bảo mật: không dán appSecret, access_token, refresh_token, chữ ký webhook, request body hoặc dữ liệu cá nhân người mua vào chat, ảnh chụp, tài liệu công khai, log hoặc Git commit.",
  "Start Shopee shop authorization for a saved Shopee ChannelAccount. This route redirects the admin browser to Shopee Open Platform authorization.":
    "Bắt đầu luồng ủy quyền shop Shopee cho một Shopee ChannelAccount đã lưu. Route này redirect trình duyệt admin sang trang ủy quyền Shopee Open Platform.",
  "Shopee redirects here after seller authorization. The route exchanges code + shop_id for access_token and refresh_token, stores them in the Shopee ChannelAccount, then redirects back to /channels/accounts.":
    "Shopee redirect về route này sau khi seller ủy quyền. Route đổi code + shop_id lấy access_token và refresh_token, lưu vào Shopee ChannelAccount, rồi redirect về /channels/accounts.",
  "Receive Shopee push/webhook payloads. Supported text chat events are mapped into the normalized inbound handler, then the Shopee send adapter attempts to reply to the buyer chat.":
    "Nhận payload push/webhook từ Shopee. Các event chat text được hỗ trợ sẽ được map vào normalized inbound handler, sau đó Shopee send adapter thử gửi phản hồi lại buyer chat.",
  "Webhook HMAC signature header. Required when webhookSecret or partnerKey is configured for the Shopee ChannelAccount.":
    "Header chữ ký HMAC webhook. Bắt buộc khi Shopee ChannelAccount có cấu hình webhookSecret hoặc partnerKey.",
  "Receive TikTok Shop customer-service webhook payloads. Supported text message events are mapped into the normalized inbound handler. Outbound send is intentionally gated until Partner Center send-message contract is verified.":
    "Nhận payload webhook customer-service từ TikTok Shop. Các event tin nhắn text được hỗ trợ sẽ được map vào normalized inbound handler. Gửi outbound được khóa có chủ ý cho đến khi xác minh contract send-message trong Partner Center.",
  "Webhook HMAC signature header. Required when webhookSecret or appSecret is configured for the TikTok Shop ChannelAccount. Confirm the exact official signature header/rule in Partner Center.":
    "Header chữ ký HMAC webhook. Bắt buộc khi TikTok Shop ChannelAccount có cấu hình webhookSecret hoặc appSecret. Cần xác nhận header/quy tắc chữ ký chính thức trong Partner Center.",
  "Verify the shared Meta webhook callback for Facebook Messenger and Instagram Direct Messaging. If hub.mode is subscribe and hub.verify_token matches Channels -> Accounts -> Facebook/Instagram or META_VERIFY_TOKEN, the route returns hub.challenge as plain text.":
    "Xác minh callback webhook Meta dùng chung cho Facebook Messenger và Instagram Direct Messaging. Nếu hub.mode là subscribe và hub.verify_token khớp với Kênh liên hệ -> Tài khoản -> Facebook/Instagram hoặc META_VERIFY_TOKEN, route trả hub.challenge dạng plain text.",
  "Receive the shared Meta webhook callback. The request body shown here is a real Facebook payload for Try it convenience; see the Facebook Messenger and Instagram Direct Messaging sections for separate platform-specific payload examples.":
    "Nhận callback webhook Meta dùng chung. Request body ở đây là payload Facebook thật để tiện dùng Try it; xem section Facebook Messenger và Instagram Direct Messaging để có ví dụ payload riêng từng nền tảng.",
  "Always use subscribe. Meta sends this value when verifying the webhook callback.":
    "Luôn dùng subscribe. Meta gửi giá trị này khi xác minh webhook callback.",
  "Required when META_APP_SECRET or a channel appSecret is configured. Invalid signatures return 401.":
    "Bắt buộc khi có cấu hình META_APP_SECRET hoặc appSecret của kênh. Chữ ký không hợp lệ trả 401.",
  "Webhook receives Facebook payload in Instagram docs: use only the shared webhook Try it endpoint; platform examples are documentation-only examples.":
    "Webhook nhận payload Facebook trong phần tài liệu Instagram: chỉ dùng endpoint Try it của webhook dùng chung; ví dụ từng nền tảng chỉ là ví dụ tài liệu.",
  "Required config: Verify Token, Page Access Token, Graph Version v25.0, and optional Page ID/App Secret.":
    "Cấu hình bắt buộc: Verify Token, Page Access Token, Graph Version v25.0, và tùy chọn Page ID/App Secret.",
  "Required config: Verify Token, Instagram Access Token, Graph Version v25.0, and optional Business Account ID/App Secret.":
    "Cấu hình bắt buộc: Verify Token, Instagram Access Token, Graph Version v25.0, và tùy chọn Business Account ID/App Secret.",
  "Runtime status: available through /api/chat and public widget/API flows.":
    "Trạng thái runtime: khả dụng qua /api/chat và các luồng public widget/API.",
  "Inbound support: available for website/API/direct chat requests.":
    "Hỗ trợ inbound: khả dụng cho request từ website, API hoặc chat trực tiếp.",
  "Outbound support: internal response returned to caller; no external platform credential needed.":
    "Hỗ trợ outbound: phản hồi nội bộ được trả về cho caller; không cần credential nền tảng bên ngoài.",
  "Auth/config support: API key or app session depending on caller.":
    "Hỗ trợ xác thực/cấu hình: dùng API key hoặc app session tùy caller.",
  "Needs real credential: no platform credential needed beyond app deployment/auth.":
    "Cần credential thật: không cần credential nền tảng ngoài phần deploy/auth của app.",
  "Production readiness: ready if deployment, AI provider, Knowledge Base, rate-limit, and monitoring are stable.":
    "Mức sẵn sàng production: sẵn sàng nếu deploy, AI provider, Knowledge Base, rate-limit và monitoring ổn định.",
  "Runtime status: available in current Meta webhook/send flow.":
    "Trạng thái runtime: khả dụng trong luồng webhook/send Meta hiện tại.",
  "Inbound support: shared Meta webhook /api/webhooks/meta handles Facebook page messages.":
    "Hỗ trợ inbound: webhook Meta dùng chung /api/webhooks/meta xử lý tin nhắn Facebook Page.",
  "Outbound support: available through Meta send API when page token and permissions are valid.":
    "Hỗ trợ outbound: khả dụng qua Meta Send API khi page token và quyền hợp lệ.",
  "Auth/config support: verify token, page access token, page id, app secret, graph version.":
    "Hỗ trợ xác thực/cấu hình: verify token, page access token, page id, app secret, graph version.",
  "Needs real credential: Meta app, Facebook Page admin access, page token, webhook verification.":
    "Cần credential thật: Meta app, quyền admin Facebook Page, page token và xác minh webhook.",
  "Production readiness: near-ready after real Meta E2E, app review/permissions, signature verification, and no-secret logging checks.":
    "Mức sẵn sàng production: gần sẵn sàng sau khi pass E2E Meta thật, app review/quyền, xác minh chữ ký và kiểm tra log không lộ secret.",
  "Runtime status: available via the shared Meta flow.":
    "Trạng thái runtime: khả dụng qua luồng Meta dùng chung.",
  "Inbound support: shared Meta webhook /api/webhooks/meta handles Instagram messaging payloads.":
    "Hỗ trợ inbound: webhook Meta dùng chung /api/webhooks/meta xử lý payload tin nhắn Instagram.",
  "Outbound support: available when Instagram access token, permissions, and account eligibility are valid.":
    "Hỗ trợ outbound: khả dụng khi Instagram access token, quyền và điều kiện tài khoản hợp lệ.",
  "Auth/config support: verify token, Instagram access token, business/account id, app secret, graph version.":
    "Hỗ trợ xác thực/cấu hình: verify token, Instagram access token, business/account id, app secret, graph version.",
  "Needs real credential: Instagram Business/Creator account, Meta app permissions, Instagram messaging access.":
    "Cần credential thật: tài khoản Instagram Business/Creator, quyền Meta app và quyền nhắn tin Instagram.",
  "Production readiness: near-ready after real Instagram E2E and Meta review/permission checks.":
    "Mức sẵn sàng production: gần sẵn sàng sau khi pass E2E Instagram thật và kiểm tra review/quyền Meta.",
  "Runtime status: available through Python relay/session-cookie style integration.":
    "Trạng thái runtime: khả dụng qua tích hợp Python relay/session-cookie.",
  "Inbound support: /api/channels/zalo/incoming accepts relay payloads and scopes messages by account when accountId is present.":
    "Hỗ trợ inbound: /api/channels/zalo/incoming nhận payload từ relay và tách phạm vi tin nhắn theo account khi có accountId.",
  "Outbound support: available through the relay/send helpers when the session is valid.":
    "Hỗ trợ outbound: khả dụng qua relay/send helper khi session hợp lệ.",
  "Auth/config support: cookies/session input, optional relaySecret, python command, script path, account/OA id.":
    "Hỗ trợ xác thực/cấu hình: cookies/session input, relaySecret tùy chọn, python command, script path, account/OA id.",
  "Needs real credential: valid Zalo session/cookies and relay runtime; relaySecret is recommended for production safety.":
    "Cần credential thật: session/cookies Zalo hợp lệ và runtime relay; nên cấu hình relaySecret để an toàn hơn trong production.",
  "Production readiness: fallback/demo/current operational mode, not an official Zalo OA API integration.":
    "Mức sẵn sàng production: là chế độ fallback/demo/vận hành hiện tại, không phải tích hợp Zalo OA API chính thức.",
  "Runtime status: planned/config-ready only; official OA adapter is not implemented in the current product flow.":
    "Trạng thái runtime: mới ở mức lên kế hoạch/sẵn sàng cấu hình; adapter OA chính thức chưa triển khai trong luồng sản phẩm hiện tại.",
  "Inbound support: not implemented for official OA API.":
    "Hỗ trợ inbound: chưa triển khai cho OA API chính thức.",
  "Outbound support: not implemented for official OA API.":
    "Hỗ trợ outbound: chưa triển khai cho OA API chính thức.",
  "Auth/config support: should be designed separately if the team chooses official OA.":
    "Hỗ trợ xác thực/cấu hình: cần thiết kế riêng nếu team chọn hướng OA chính thức.",
  "Needs real credential: official OA credentials and approval from Zalo.":
    "Cần credential thật: credential OA chính thức và phê duyệt từ Zalo.",
  "Production readiness: future phase, not current runtime.":
    "Mức sẵn sàng production: phase tương lai, chưa thuộc runtime hiện tại.",
  "Runtime status: pre-E2E ready with account config, auth start/callback, token helper, webhook receiver, normalized inbound, and send adapter scaffold.":
    "Trạng thái runtime: sẵn sàng trước E2E với cấu hình account, auth start/callback, token helper, webhook receiver, normalized inbound và scaffold send adapter.",
  "Inbound support: /api/webhooks/shopee parses supported buyer text events and hands them to the normalized flow.":
    "Hỗ trợ inbound: /api/webhooks/shopee parse các event text của người mua được hỗ trợ và chuyển vào normalized flow.",
  "Outbound support: send adapter exists but must be verified with a real Shopee Partner App/shop and approved chat scope.":
    "Hỗ trợ outbound: đã có send adapter nhưng phải xác minh bằng Shopee Partner App/shop thật và scope chat được duyệt.",
  "Auth/config support: Partner ID, Partner Key, shop authorization callback, access token, refresh token, webhook secret.":
    "Hỗ trợ xác thực/cấu hình: Partner ID, Partner Key, callback ủy quyền shop, access token, refresh token, webhook secret.",
  "Needs real credential: legitimate Shopee Seller account and Shopee Open Platform Partner App.":
    "Cần credential thật: tài khoản Shopee Seller hợp lệ và Shopee Open Platform Partner App.",
  "Production readiness: not ready until real Seller/Partner E2E passes auth, webhook, receive, send, token refresh, idempotency, and fallback checks.":
    "Mức sẵn sàng production: chưa sẵn sàng cho đến khi E2E Seller/Partner thật pass auth, webhook, receive, send, token refresh, idempotency và fallback.",
  "Runtime status: pre-E2E inbound scaffold.":
    "Trạng thái runtime: scaffold inbound trước E2E.",
  "Inbound support: /api/webhooks/tiktok-shop accepts customer-service style message payloads and maps text into normalized inbound flow.":
    "Hỗ trợ inbound: /api/webhooks/tiktok-shop nhận payload tin nhắn kiểu customer-service và map text vào normalized inbound flow.",
  "Outbound support: not finalized; send-message endpoint/scope must be verified in TikTok Shop Partner Center.":
    "Hỗ trợ outbound: chưa chốt; endpoint/scope send-message phải được xác minh trong TikTok Shop Partner Center.",
  "Auth/config support: account config and secret masking exist; OAuth/callback contract is not finalized.":
    "Hỗ trợ xác thực/cấu hình: đã có account config và mask secret; contract OAuth/callback chưa chốt.",
  "Needs real credential: legitimate TikTok Shop Seller account plus Partner Center/Open Platform app.":
    "Cần credential thật: tài khoản TikTok Shop Seller hợp lệ và app Partner Center/Open Platform.",
  "Production readiness: no. It requires Partner Center contract verification, real webhook payload, send-message API, token refresh, idempotency, and E2E buyer chat test.":
    "Mức sẵn sàng production: chưa. Cần xác minh contract Partner Center, payload webhook thật, Send Message API, token refresh, idempotency và test buyer chat E2E.",
  "Runtime status: available in current implementation through whatsapp-web.js / WhatsApp Web style runtime.":
    "Trạng thái runtime: khả dụng trong triển khai hiện tại qua runtime kiểu whatsapp-web.js / WhatsApp Web.",
  "Inbound support: available when the local WhatsApp client is connected and message events are received.":
    "Hỗ trợ inbound: khả dụng khi WhatsApp client local đã kết nối và nhận được event tin nhắn.",
  "Outbound support: available through the current WhatsApp client send helper.":
    "Hỗ trợ outbound: khả dụng qua helper gửi của WhatsApp client hiện tại.",
  "Auth/config support: QR/session based current flow; Cloud API multi-account is not the current implementation.":
    "Hỗ trợ xác thực/cấu hình: luồng hiện tại dựa trên QR/session; Cloud API multi-account chưa phải triển khai hiện tại.",
  "Needs real credential: phone/session/QR connection and stable runtime host.":
    "Cần credential thật: điện thoại/session/kết nối QR và host runtime ổn định.",
  "Production readiness: partial; depends on session stability and should be reassessed before customer go-live.":
    "Mức sẵn sàng production: một phần; phụ thuộc độ ổn định session và cần đánh giá lại trước go-live cho khách.",
  "Runtime status: available for SMTP/IMAP style configuration in current implementation.":
    "Trạng thái runtime: khả dụng cho cấu hình kiểu SMTP/IMAP trong triển khai hiện tại.",
  "Inbound support: depends on configured mailbox polling/IMAP flow in environment.":
    "Hỗ trợ inbound: phụ thuộc luồng polling mailbox/IMAP được cấu hình trong môi trường.",
  "Outbound support: available through SMTP send helper when settings are valid.":
    "Hỗ trợ outbound: khả dụng qua SMTP send helper khi settings hợp lệ.",
  "Auth/config support: SMTP/IMAP host, ports, user, password/from address.":
    "Hỗ trợ xác thực/cấu hình: SMTP/IMAP host, port, user, password/from address.",
  "Needs real credential: customer mailbox credentials or app password.":
    "Cần credential thật: credential mailbox của khách hoặc app password.",
  "Production readiness: available after real mailbox send/receive test and spam/deliverability review.":
    "Mức sẵn sàng production: khả dụng sau khi test gửi/nhận mailbox thật và review spam/deliverability.",
  "Runtime status: available if Twilio settings are configured.":
    "Trạng thái runtime: khả dụng nếu đã cấu hình Twilio settings.",
  "Inbound support: /api/channels/phone/incoming and gather/status routes support Twilio voice flow.":
    "Hỗ trợ inbound: /api/channels/phone/incoming và các route gather/status hỗ trợ luồng Twilio voice.",
  "Outbound support: voice response/TwiML path exists; full call operations depend on Twilio credentials and phone number.":
    "Hỗ trợ outbound: đã có đường voice response/TwiML; vận hành cuộc gọi đầy đủ phụ thuộc credential Twilio và số điện thoại.",
  "Auth/config support: Twilio SID, token, phone number, callback URLs, optional voice provider settings.":
    "Hỗ trợ xác thực/cấu hình: Twilio SID, token, số điện thoại, callback URL và cấu hình voice provider tùy chọn.",
  "Needs real credential: Twilio account, phone number, webhook URLs, valid signatures.":
    "Cần credential thật: tài khoản Twilio, số điện thoại, webhook URL và chữ ký hợp lệ.",
  "Production readiness: available after real call E2E, signature verification, and fallback handling.":
    "Mức sẵn sàng production: khả dụng sau khi pass E2E cuộc gọi thật, xác minh chữ ký và xử lý fallback.",
  "Inbound support: /api/channels/sms maps inbound SMS into normalized inbound flow.":
    "Hỗ trợ inbound: /api/channels/sms map SMS inbound vào normalized inbound flow.",
  "Outbound support: TwiML response path and Twilio send helper are available when configured.":
    "Hỗ trợ outbound: đường phản hồi TwiML và Twilio send helper khả dụng khi đã cấu hình.",
  "Auth/config support: Twilio SID, token, phone number, webhook signature validation.":
    "Hỗ trợ xác thực/cấu hình: Twilio SID, token, số điện thoại và xác thực chữ ký webhook.",
  "Needs real credential: Twilio account, SMS-capable number, public webhook URL.":
    "Cần credential thật: tài khoản Twilio, số hỗ trợ SMS và webhook URL public.",
  "Production readiness: available after real SMS send/receive E2E and opt-in/compliance review.":
    "Mức sẵn sàng production: khả dụng sau khi pass E2E gửi/nhận SMS thật và review opt-in/compliance.",
  "Runtime status: available for bot webhook style text messages.":
    "Trạng thái runtime: khả dụng cho tin nhắn text theo kiểu bot webhook.",
  "Inbound support: /api/channels/telegram maps text messages into normalized inbound flow.":
    "Hỗ trợ inbound: /api/channels/telegram map tin nhắn text vào normalized inbound flow.",
  "Outbound support: Bot API sendMessage is used when bot token is configured.":
    "Hỗ trợ outbound: dùng Bot API sendMessage khi đã cấu hình bot token.",
  "Auth/config support: Telegram bot token and webhook registration.":
    "Hỗ trợ xác thực/cấu hình: Telegram bot token và đăng ký webhook.",
  "Needs real credential: Telegram bot token and public webhook URL.":
    "Cần credential thật: Telegram bot token và webhook URL public.",
  "Production readiness: available after real bot E2E and webhook delivery/retry review.":
    "Mức sẵn sàng production: khả dụng sau khi pass E2E bot thật và review webhook delivery/retry.",
  "config_saved: configuration was saved, but authorization and real webhook/chat verification have not finished.":
    "config_saved: cấu hình đã được lưu, nhưng chưa hoàn tất ủy quyền và xác minh webhook/chat thật.",
  "authorization_required: an admin must open the platform authorization/approval screen and grant access.":
    "authorization_required: admin cần mở màn hình ủy quyền/phê duyệt của nền tảng và cấp quyền.",
  "authorized: token/account/shop/page id exists, but webhook receive and outbound send are not proven yet.":
    "authorized: đã có token/account/shop/page id, nhưng chưa chứng minh được webhook receive và outbound send.",
  "webhook_pending: webhook is expected but no valid real webhook has been accepted yet.":
    "webhook_pending: đang chờ webhook, nhưng chưa nhận webhook thật hợp lệ.",
  "webhook_verified: a valid webhook request reached the app and passed parsing/signature checks.":
    "webhook_verified: request webhook hợp lệ đã tới app và pass parse/signature check.",
  "chat_receive_verified: a real or accepted test customer message was parsed and entered the normalized inbound flow.":
    "chat_receive_verified: tin nhắn khách thật hoặc test được chấp nhận đã được parse và đi vào normalized inbound flow.",
  "chat_send_verified: the app successfully delivered a reply back to the external platform.":
    "chat_send_verified: app đã gửi phản hồi thành công về nền tảng bên ngoài.",
  "production_ready: only use after auth, webhook, receive, send, token refresh, idempotency, rate-limit/backoff, monitoring, and human fallback are verified.":
    "production_ready: chỉ dùng sau khi đã xác minh auth, webhook, receive, send, token refresh, idempotency, rate-limit/backoff, monitoring và human fallback.",
  "error: account or channel needs operator review; do not treat it as connected.":
    "error: account hoặc channel cần operator kiểm tra; không xem là đã kết nối.",
  "Do not promise production readiness from config_saved or authorized alone.":
    "Không hứa production-ready chỉ dựa vào config_saved hoặc authorized.",
  "Do not mark Shopee/TikTok Shop production-ready without a real Seller/Partner Center E2E test.":
    "Không đánh dấu Shopee/TikTok Shop production-ready nếu chưa có test E2E thật với Seller/Partner Center.",
  "Do not store raw webhook payloads, raw buyer messages, tokens, signatures, or keys in debug metadata.":
    "Không lưu raw webhook payload, raw buyer message, token, chữ ký hoặc key trong debug metadata.",
  "When in doubt, show the current stage and the next missing verification step instead of saying connected.":
    "Khi chưa chắc, hãy hiển thị stage hiện tại và bước xác minh còn thiếu thay vì nói đã connected.",
  "Confirm the platform account exists and belongs to the customer.":
    "Xác nhận tài khoản nền tảng tồn tại và thuộc về khách hàng.",
  "Confirm developer/partner app exists and is approved enough for the tested feature.":
    "Xác nhận developer/partner app tồn tại và đã được duyệt đủ cho tính năng cần test.",
  "Confirm callback/webhook uses a public HTTPS URL, not localhost.":
    "Xác nhận callback/webhook dùng URL HTTPS public, không dùng localhost.",
  "Add the ChannelAccount or channel config in LinhKienLed1000.":
    "Thêm ChannelAccount hoặc cấu hình kênh trong LinhKienLed1000.",
  "Save config and verify secrets are masked in UI/API responses.":
    "Lưu cấu hình và xác nhận secret được mask trong phản hồi UI/API.",
  "Authorize/connect where the platform supports OAuth or shop/page approval.":
    "Ủy quyền/kết nối ở nơi nền tảng hỗ trợ OAuth hoặc phê duyệt shop/page.",
  "Configure webhook URL in the platform console.":
    "Cấu hình webhook URL trong console của nền tảng.",
  "Send a real user/customer message from the platform.":
    "Gửi một tin nhắn người dùng/khách hàng thật từ nền tảng.",
  "Confirm safe webhook debug metadata updates without raw message text or secrets.":
    "Xác nhận debug metadata của webhook được cập nhật an toàn, không có raw message text hoặc secret.",
  "Confirm a conversation is created with correct channel and channelAccountId where applicable.":
    "Xác nhận hội thoại được tạo đúng channel và channelAccountId nếu có.",
  "Confirm bot response is generated from the correct Knowledge Base context.":
    "Xác nhận phản hồi bot được tạo từ đúng ngữ cảnh Knowledge Base.",
  "Confirm outbound reply is delivered back to the platform.":
    "Xác nhận phản hồi outbound được gửi trả về nền tảng.",
  "Confirm no secret/token/signature/raw buyer PII appears in UI, logs, or screenshots.":
    "Xác nhận không có secret/token/chữ ký/raw PII của người mua xuất hiện trong UI, log hoặc ảnh chụp.",
  "Confirm retry/idempotency behavior does not duplicate replies.":
    "Xác nhận cơ chế retry/idempotency không tạo phản hồi trùng.",
  "Confirm token refresh or credential rotation behavior before go-live.":
    "Xác nhận token refresh hoặc credential rotation trước go-live.",
  "Verify /api/webhooks/meta with Meta's hub.challenge flow.":
    "Xác minh /api/webhooks/meta bằng luồng hub.challenge của Meta.",
  "Send a Facebook Page message and confirm channel=facebook conversation plus outbound reply.":
    "Gửi tin nhắn vào Facebook Page và xác nhận có hội thoại channel=facebook cùng phản hồi outbound.",
  "Send an Instagram DM and confirm channel=instagram conversation plus outbound reply.":
    "Gửi Instagram DM và xác nhận có hội thoại channel=instagram cùng phản hồi outbound.",
  "Check x-hub-signature-256 verification when appSecret is configured.":
    "Kiểm tra xác minh x-hub-signature-256 khi đã cấu hình appSecret.",
  "Confirm Meta app mode, app review, page/account permissions, and token lifetime for production users.":
    "Xác nhận Meta app mode, app review, quyền page/account và vòng đời token cho production users.",
  "Start the Python relay with valid session/cookies for the intended Zalo account.":
    "Khởi động Python relay với session/cookies hợp lệ cho tài khoản Zalo cần dùng.",
  "Configure relaySecret and verify the relay sends x-zalo-relay-secret.":
    "Cấu hình relaySecret và xác minh relay gửi header x-zalo-relay-secret.",
  "Send a real Zalo message and confirm /api/channels/zalo/incoming receives account-scoped payload.":
    "Gửi tin nhắn Zalo thật và xác nhận /api/channels/zalo/incoming nhận payload có scope theo account.",
  "Confirm conversation channel=zalo and outbound relay reply works.":
    "Xác nhận hội thoại channel=zalo và phản hồi outbound qua relay hoạt động.",
  "Remember this is the Python relay/session-cookie path, not official OA API.":
    "Lưu ý đây là hướng Python relay/session-cookie, không phải OA API chính thức.",
  "Save Partner ID/Partner Key in Channels -> Accounts -> Shopee.":
    "Lưu Partner ID/Partner Key tại Kênh liên hệ -> Tài khoản -> Shopee.",
  "Approve the app in Shopee and verify callback stores tokens with status=authorized.":
    "Phê duyệt app trong Shopee và xác minh callback lưu token với trạng thái authorized.",
  "Configure webhook to /api/webhooks/shopee and send a buyer chat message.":
    "Cấu hình webhook tới /api/webhooks/shopee và gửi một tin nhắn buyer chat.",
  "Confirm webhook_verified, chat_receive_verified, and chat_send_verified before any production claim.":
    "Xác nhận webhook_verified, chat_receive_verified và chat_send_verified trước mọi tuyên bố production.",
  "Confirm Customer Service/Conversation/Message scopes and exact OAuth/webhook/signature/send-message contract in Partner Center.":
    "Xác nhận scope Customer Service/Conversation/Message và contract OAuth/webhook/signature/send-message chính xác trong Partner Center.",
  "Configure webhook to /api/webhooks/tiktok-shop if Partner Center allows it.":
    "Cấu hình webhook tới /api/webhooks/tiktok-shop nếu Partner Center cho phép.",
  "Do not claim outbound support until a real send-message API test succeeds.":
    "Không tuyên bố đã hỗ trợ outbound cho đến khi test Send Message API thật thành công.",
  "Do not mark production-ready until OAuth, webhook receive, chat receive, chat send, and retry/idempotency are proven.":
    "Không đánh dấu production-ready cho đến khi chứng minh được OAuth, webhook receive, chat receive, chat send và retry/idempotency.",
  "Open Meta for Developers, then open Apps. If the customer already has a Meta App, use that app instead of creating a duplicate.":
    "Mở Meta for Developers, sau đó mở Apps. Nếu khách đã có Meta App phù hợp, dùng app đó thay vì tạo trùng.",
  "Create an app only if there is no suitable existing app for this business.":
    "Chỉ tạo app mới nếu doanh nghiệp chưa có app phù hợp.",
  "Inside the app, add or configure the Messenger product for Facebook Messenger.":
    "Trong app, thêm hoặc cấu hình product Messenger cho Facebook Messenger.",
  "Inside the same app, add or configure the Instagram product/API flow for Instagram Direct Messaging.":
    "Trong cùng app, thêm hoặc cấu hình product/API flow Instagram cho Instagram Direct Messaging.",
  "Open App settings and copy the App Secret only if LinhKienLed1000 will verify webhook signatures in this environment.":
    "Mở App settings và copy App Secret chỉ khi LinhKienLed1000 sẽ xác minh chữ ký webhook trong môi trường này.",
  "Do not confuse App ID with Page ID. App ID identifies the Meta Developer App; Page ID identifies the Facebook Page.":
    "Không nhầm App ID với Page ID. App ID định danh Meta Developer App; Page ID định danh Facebook Page.",
  "Create or choose the Facebook Page that customers will message.":
    "Tạo hoặc chọn Facebook Page mà khách hàng sẽ nhắn vào.",
  "Confirm the setup user can manage the Page in Meta/Facebook business tools.":
    "Xác nhận người cấu hình có quyền quản lý Page trong công cụ business của Meta/Facebook.",
  "If the Page is new, finish basic Page setup first: name, category, contact info, and Messenger availability.":
    "Nếu Page mới, hoàn tất cấu hình cơ bản trước: tên, danh mục, thông tin liên hệ và khả năng dùng Messenger.",
  "In Meta Dashboard, select this Page when configuring the Messenger product.":
    "Trong Meta Dashboard, chọn Page này khi cấu hình product Messenger.",
  "Optional Page ID can be copied from Page settings or looked up with Graph API after you have a Page Access Token.":
    "Page ID tùy chọn có thể copy từ Page settings hoặc tra bằng Graph API sau khi có Page Access Token.",
  "In the Meta Developer App, open the Messenger or Messenger API setup area.":
    "Trong Meta Developer App, mở khu vực cấu hình Messenger hoặc Messenger API.",
  "Select the Facebook Page that LinhKienLed1000 should reply from.":
    "Chọn Facebook Page mà LinhKienLed1000 sẽ dùng để trả lời.",
  "Generate or copy the Page Access Token for that Page.":
    "Tạo hoặc copy Page Access Token của Page đó.",
  "Paste it into LinhKienLed1000 Channels -> Accounts -> Facebook -> Page Access Token.":
    "Dán vào LinhKienLed1000 tại Kênh liên hệ -> Tài khoản -> Facebook -> Page Access Token.",
  "Optional Page ID lookup: call https://graph.facebook.com/v25.0/me?fields=id,name&access_token=YOUR_FACEBOOK_PAGE_ACCESS_TOKEN and use the returned id.":
    "Tra Page ID tùy chọn: gọi https://graph.facebook.com/v25.0/me?fields=id,name&access_token=YOUR_FACEBOOK_PAGE_ACCESS_TOKEN và dùng id được trả về.",
  "If the token later returns 401 or 403, regenerate it or check permissions/app mode/review in Meta Dashboard.":
    "Nếu token sau đó trả 401 hoặc 403, hãy tạo lại token hoặc kiểm tra quyền/app mode/review trong Meta Dashboard.",
  "Save the Facebook account config before testing Meta verification.":
    "Lưu cấu hình account Facebook trước khi test xác minh Meta.",
  "In Meta Dashboard webhook settings, set Callback URL to <APP_ORIGIN>/api/webhooks/meta.":
    "Trong phần webhook settings của Meta Dashboard, đặt Callback URL là <APP_ORIGIN>/api/webhooks/meta.",
  "Set Verify Token in Meta Dashboard to exactly the same value saved in LinhKienLed1000.":
    "Đặt Verify Token trong Meta Dashboard đúng bằng giá trị đã lưu trong LinhKienLed1000.",
  "Subscribe the Facebook Page/webhook to the Messenger message events required by the app.":
    "Subscribe Facebook Page/webhook vào các event tin nhắn Messenger mà app cần.",
  "Send a real message to the Facebook Page and confirm LinhKienLed1000 creates a conversation with channel=facebook.":
    "Gửi tin nhắn thật vào Facebook Page và xác nhận LinhKienLed1000 tạo hội thoại channel=facebook.",
  "Use an Instagram Business or Creator account according to Meta's current requirements.":
    "Dùng tài khoản Instagram Business hoặc Creator theo yêu cầu hiện tại của Meta.",
  "Confirm the setup user can manage the Instagram account and any related business assets required by Meta.":
    "Xác nhận người cấu hình có quyền quản lý tài khoản Instagram và các business asset liên quan mà Meta yêu cầu.",
  "Use Instagram API with Instagram Login / Direct Messaging. Instagram Basic Display API is not enough for chatbot messaging.":
    "Dùng Instagram API with Instagram Login / Direct Messaging. Instagram Basic Display API không đủ cho chatbot messaging.",
  "If the account is new or not eligible, complete Meta's account/business setup first before connecting LinhKienLed1000.":
    "Nếu tài khoản mới hoặc chưa đủ điều kiện, hoàn tất cấu hình account/business của Meta trước khi kết nối LinhKienLed1000.",
  "Do not reuse a Facebook Page Access Token as the Instagram Access Token for this direct Instagram flow.":
    "Không dùng lại Facebook Page Access Token làm Instagram Access Token cho luồng Instagram trực tiếp này.",
  "Complete the authorization/login step for the Instagram account that should receive messages.":
    "Hoàn tất bước authorization/login cho tài khoản Instagram sẽ nhận tin nhắn.",
  "Copy the Instagram Access Token produced by that flow.":
    "Copy Instagram Access Token được tạo từ luồng đó.",
  "Paste it into LinhKienLed1000 Channels -> Accounts -> Instagram -> Access Token.":
    "Dán vào LinhKienLed1000 tại Kênh liên hệ -> Tài khoản -> Instagram -> Access Token.",
  "In development mode, only admins, developers, or testers may be able to interact with the Meta App.":
    "Ở development mode, chỉ admin, developer hoặc tester có thể tương tác với Meta App.",
  "If internal testers can send messages but real customers cannot, check Meta App Review, required permissions, app mode, and business verification requirements.":
    "Nếu tester nội bộ gửi được tin nhưng khách thật không gửi được, kiểm tra Meta App Review, quyền cần thiết, app mode và yêu cầu business verification.",
  "Do not treat a successful local webhook test as full production approval. It only proves LinhKienLed1000 can receive the payload shape.":
    "Không xem test webhook local thành công là đã được duyệt production đầy đủ. Nó chỉ chứng minh LinhKienLed1000 nhận được dạng payload.",
  "Channel config checks should show hasPageAccessToken/hasAccessToken and hasAppSecret without exposing raw secret values.":
    "Kiểm tra cấu hình kênh nên hiển thị hasPageAccessToken/hasAccessToken và hasAppSecret mà không lộ raw secret.",
  "If AI reply is not sent, check both channel delivery config and the AI provider/API key config. Webhook receive and chatbot reply are two separate steps.":
    "Nếu AI không gửi phản hồi, kiểm tra cả cấu hình gửi của kênh và cấu hình AI provider/API key. Nhận webhook và chatbot trả lời là hai bước riêng.",
  "Webhook verify fails: check callback URL, public HTTPS access, exact Verify Token match, and whether the app server is running.":
    "Webhook verify fail: kiểm tra callback URL, truy cập HTTPS public, Verify Token khớp tuyệt đối và server app có đang chạy không.",
  "Bot does not reply: check the access token, channel config, AI provider/API key, and server logs.":
    "Bot không trả lời: kiểm tra access token, cấu hình kênh, AI provider/API key và server logs.",
  "401 or 403 from Meta: token may be expired, missing permission, blocked by app mode/review, or tied to the wrong account/page.":
    "Meta trả 401 hoặc 403: token có thể hết hạn, thiếu quyền, bị app mode/review chặn hoặc gắn sai account/page.",
  "Facebook Page ID is empty: acceptable if the Page Access Token works with /me/messages.":
    "Facebook Page ID trống: chấp nhận được nếu Page Access Token hoạt động với /me/messages.",
  "Instagram token does not work: confirm it is from the Instagram API with Instagram Login / Direct Messaging flow, not Basic Display API.":
    "Instagram token không hoạt động: xác nhận token đến từ Instagram API with Instagram Login / Direct Messaging, không phải Basic Display API.",
  "If any token is exposed, rotate or revoke it in Meta Developer Dashboard and update the matching LinhKienLed1000 account in Channels -> Accounts.":
    "Nếu token bị lộ, hãy rotate hoặc revoke trong Meta Developer Dashboard rồi cập nhật account tương ứng trong LinhKienLed1000 tại Kênh liên hệ -> Tài khoản.",
  "ChannelAccount supports type=shopee and can store one or more Shopee shops.":
    "ChannelAccount hỗ trợ type=shopee và có thể lưu một hoặc nhiều shop Shopee.",
  "The account form supports Shop ID, Partner ID, Access Token, Refresh Token, and Partner Key.":
    "Form account hỗ trợ Shop ID, Partner ID, Access Token, Refresh Token và Partner Key.",
  "GET responses mask Shopee secrets with flags such as hasAccessToken, hasRefreshToken, and hasPartnerKey.":
    "Phản hồi GET mask secret Shopee bằng các cờ như hasAccessToken, hasRefreshToken và hasPartnerKey.",
  "NormalizedInboundMessage already has channel=shopee and the Shopee webhook route maps buyer messages into that shared handler.":
    "NormalizedInboundMessage đã có channel=shopee và route webhook Shopee map tin nhắn người mua vào handler dùng chung đó.",
  "/api/webhooks/shopee receives Shopee push/webhook payloads and processes supported text chat events.":
    "/api/webhooks/shopee nhận payload push/webhook Shopee và xử lý các event chat text được hỗ trợ.",
  "The Shopee send-message adapter signs outbound calls and attempts to send the AI response back to the buyer chat.":
    "Shopee send-message adapter ký outbound call và thử gửi phản hồi AI lại buyer chat.",
  "Use an existing legitimate LED1000/customer-owned Shopee Seller account. This app does not create Shopee shops and a normal buyer account is not enough.":
    "Dùng tài khoản Shopee Seller hợp lệ có sẵn thuộc LED1000/khách hàng. App này không tạo shop Shopee và tài khoản buyer thường là không đủ.",
  "Make sure the setup user has admin permission for the Shopee shop that will receive customer chat.":
    "Đảm bảo người cấu hình có quyền admin cho shop Shopee sẽ nhận chat khách hàng.",
  "Create or obtain a Shopee Open Platform developer/partner account. If Shopee requires seller, tax, identity, or business verification, complete that process inside Shopee/Seller Center; the app cannot bypass it and must not use fake verification data.":
    "Tạo hoặc có sẵn tài khoản developer/partner Shopee Open Platform. Nếu Shopee yêu cầu xác minh seller, thuế, danh tính hoặc doanh nghiệp, hoàn tất trong Shopee/Seller Center; app không thể bỏ qua và không được dùng dữ liệu xác minh giả.",
  "Create a partner app in Shopee Open Platform for LinhKienLed1000.":
    "Tạo partner app trong Shopee Open Platform cho LinhKienLed1000.",
  "Prepare the public HTTPS app URL. In production use the deployed customer domain; for local verification use an HTTPS tunnel only for testing.":
    "Chuẩn bị app URL HTTPS public. Production dùng domain đã deploy của khách; xác minh local chỉ dùng HTTPS tunnel để test.",
  "Use a public HTTPS domain. Localhost only works through a temporary HTTPS tunnel for testing.":
    "Dùng domain HTTPS public. Localhost chỉ hoạt động qua HTTPS tunnel tạm thời để test.",
  "Open auth start /api/channels/shopee/auth/start?accountId=<channelAccountId> through the app, not by manually calling callback.":
    "Mở auth start /api/channels/shopee/auth/start?accountId=<channelAccountId> thông qua app, không gọi callback thủ công.",
  "Send/capture a real customer-service message payload and confirm safe debug metadata plus normalized conversation creation.":
    "Gửi/ghi nhận payload tin nhắn customer-service thật và xác nhận debug metadata an toàn cùng việc tạo normalized conversation.",
  "Only complete outbound reply after send-message endpoint/scope are verified with the real Partner Center app.":
    "Chỉ hoàn tất outbound reply sau khi endpoint/scope send-message được xác minh với app Partner Center thật.",
  "This section is for expectation-setting with lead/customer. The app can store config and process messages, but it cannot override platform rules.":
    "Phần này dùng để thống nhất kỳ vọng với lead/khách hàng. App có thể lưu cấu hình và xử lý tin nhắn, nhưng không thể vượt qua quy định của nền tảng.",
  "The app cannot create a Seller shop, Facebook Page, Instagram account, Zalo account, or Telegram bot on behalf of the customer.":
    "App không thể tạo Seller shop, Facebook Page, tài khoản Instagram, tài khoản Zalo hoặc Telegram bot thay cho khách hàng.",
  "The app cannot bypass seller verification, tax verification, bank verification, identity checks, or business verification required by Shopee, TikTok Shop, Meta, Zalo, Twilio, or any provider.":
    "App không thể bỏ qua xác minh seller, thuế, ngân hàng, danh tính hoặc doanh nghiệp do Shopee, TikTok Shop, Meta, Zalo, Twilio hoặc nhà cung cấp khác yêu cầu.",
  "The app cannot bypass Meta app review, TikTok Shop Partner Center approval, Shopee Open Platform approval, or Zalo official API approval.":
    "App không thể bỏ qua Meta app review, phê duyệt TikTok Shop Partner Center, phê duyệt Shopee Open Platform hoặc phê duyệt API chính thức của Zalo.",
  "The app cannot grant API scopes that the platform has not approved for the customer app/account.":
    "App không thể tự cấp API scope mà nền tảng chưa phê duyệt cho app/account của khách.",
  "The app cannot guarantee gated Partner Console endpoints work until a real approved app/account is used.":
    "App không thể bảo đảm endpoint bị khóa trong Partner Console hoạt động cho đến khi dùng app/account thật đã được duyệt.",
  "The app should not store raw payloads, raw buyer messages, raw tokens, raw signatures, app secrets, partner keys, or refresh tokens in visible debug metadata.":
    "App không nên lưu raw payload, raw buyer message, raw token, raw signature, app secret, partner key hoặc refresh token trong debug metadata hiển thị.",
  "The app cannot guarantee price, stock, VAT, or warranty accuracy unless the customer uploads verified Knowledge Base data for those topics.":
    "App không thể bảo đảm độ chính xác giá, tồn kho, VAT hoặc bảo hành nếu khách chưa upload dữ liệu Knowledge Base đã xác minh cho các chủ đề đó.",
  "Copy this when reporting status to lead/customer. Adjust platform names depending on what credentials the customer is ready to provide.":
    "Copy phần này khi báo trạng thái cho lead/khách hàng. Điều chỉnh tên nền tảng tùy credential khách đã sẵn sàng cung cấp.",
  "Vietnamese handoff message": "Tin nhắn bàn giao tiếng Việt",
  "Implemented: account config, secret masking, normalized inbound, webhook routes for supported flows, Shopee/TikTok docs and tests.":
    "Đã triển khai: account config, secret masking, normalized inbound, webhook route cho các luồng được hỗ trợ, tài liệu và test Shopee/TikTok.",
  "Not yet production claim: marketplace OAuth/send contracts that require real Partner/Seller console access.":
    "Chưa tuyên bố production: các contract OAuth/send của marketplace vẫn cần quyền truy cập Partner/Seller console thật.",
  "Next action: collect real credentials, configure public HTTPS callback/webhook URLs, run platform-specific E2E tests, then mark only verified channels as production_ready.":
    "Bước tiếp theo: thu thập credential thật, cấu hình callback/webhook URL HTTPS public, chạy E2E từng nền tảng, rồi chỉ đánh dấu production_ready cho kênh đã xác minh.",
  "Auth start: GET /api/channels/shopee/auth/start?accountId=<channelAccountId>. Use this route from the app so the accountId is attached correctly.":
    "Auth start: GET /api/channels/shopee/auth/start?accountId=<channelAccountId>. Dùng route này từ app để accountId được gắn đúng.",
  "Callback: GET /api/channels/shopee/auth/callback. Users should not call callback by hand; Shopee calls it after seller approval.":
    "Callback: GET /api/channels/shopee/auth/callback. Người dùng không nên gọi callback thủ công; Shopee sẽ gọi sau khi seller phê duyệt.",
  "Redirect URL base: https://<your-app-domain>/api/channels/shopee/auth/callback.":
    "Redirect URL base: https://<your-app-domain>/api/channels/shopee/auth/callback.",
  "The actual callback must include accountId. Do not call the callback by hand; save the Shopee account in LinhKienLed1000 and use the generated auth start URL so accountId is attached correctly.":
    "Callback thật phải có accountId. Không gọi callback thủ công; hãy lưu account Shopee trong LinhKienLed1000 và dùng auth start URL được tạo để accountId được gắn đúng.",
  "Webhook URL: https://<your-app-domain>/api/webhooks/shopee.":
    "Webhook URL: https://<your-app-domain>/api/webhooks/shopee.",
  "config_saved: shop/account placeholder and non-secret config were saved, but authorization has not started.":
    "config_saved: placeholder shop/account và cấu hình không phải secret đã lưu, nhưng chưa bắt đầu ủy quyền.",
  "authorization_required: admin clicked connect and must finish Shopee Seller authorization in Shopee.":
    "authorization_required: admin đã bấm kết nối và cần hoàn tất ủy quyền Shopee Seller trong Shopee.",
  "authorized: access_token, refresh_token, and shop_id were saved after Shopee callback; webhook/chat are not verified yet.":
    "authorized: access_token, refresh_token và shop_id đã lưu sau callback Shopee; webhook/chat chưa được xác minh.",
  "chat_receive_verified: a Shopee buyer chat payload reached the normalized inbound flow.":
    "chat_receive_verified: payload buyer chat Shopee đã tới normalized inbound flow.",
  "chat_send_verified: the app attempted and confirmed a send-message API call succeeded for a buyer chat.":
    "chat_send_verified: app đã thử và xác nhận một lệnh Send Message API thành công cho buyer chat.",
  "production_ready: only use after scopes, webhook, receive, send, token refresh, logs, and staff handoff have been verified with the customer shop.":
    "production_ready: chỉ dùng sau khi scope, webhook, receive, send, token refresh, log và staff handoff đã được xác minh với shop của khách.",
  "error: the account needs operator review. Do not treat it as connected.":
    "error: account cần operator kiểm tra. Không xem là đã kết nối.",
  "Partner ID: public numeric/app identifier from the Shopee Open Platform partner app.":
    "Partner ID: mã numeric/app public từ partner app Shopee Open Platform.",
  "Partner Key: secret key used to sign Shopee API requests. Store it only in masked secret config.":
    "Partner Key: secret key dùng để ký request Shopee API. Chỉ lưu trong cấu hình secret được mask.",
  "Shop ID: Shopee shop identifier after the seller authorizes the partner app.":
    "Shop ID: định danh shop Shopee sau khi seller ủy quyền partner app.",
  "Access Token: token used for signed shop API calls after authorization.":
    "Access Token: token dùng cho API call shop đã ký sau khi ủy quyền.",
  "Refresh Token: token used to rotate/refresh the access token before expiry.":
    "Refresh Token: token dùng để rotate/refresh access token trước khi hết hạn.",
  "Redirect URL: public URL Shopee redirects to after seller authorization. Use <APP_ORIGIN>/api/channels/shopee/auth/callback?accountId=<CHANNEL_ACCOUNT_ID> unless a custom redirectUrl is configured.":
    "Redirect URL: URL public mà Shopee redirect về sau khi seller ủy quyền. Dùng <APP_ORIGIN>/api/channels/shopee/auth/callback?accountId=<CHANNEL_ACCOUNT_ID> trừ khi có redirectUrl tùy chỉnh.",
  "Webhook/Push URL: public HTTPS endpoint Shopee calls for events. Use <APP_ORIGIN>/api/webhooks/shopee.":
    "Webhook/Push URL: endpoint HTTPS public mà Shopee gọi khi có event. Dùng <APP_ORIGIN>/api/webhooks/shopee.",
  "1. Open Channels -> Accounts -> Add Shopee.":
    "1. Mở Kênh liên hệ -> Tài khoản -> Thêm Shopee.",
  "2. Enter a display name and Shop ID placeholder if known.":
    "2. Nhập tên hiển thị và Shop ID placeholder nếu đã biết.",
  "3. Enter Partner ID and Partner Key from Shopee Open Platform. Do not paste these into logs or screenshots.":
    "3. Nhập Partner ID và Partner Key từ Shopee Open Platform. Không dán các giá trị này vào log hoặc ảnh chụp.",
  "4. Save the config. The status should be config_saved.":
    "4. Lưu cấu hình. Trạng thái nên là config_saved.",
  "5. Click Ủy quyền shop/Kết nối. The browser redirects to Shopee authorization.":
    "5. Bấm Ủy quyền shop/Kết nối. Trình duyệt sẽ redirect sang trang ủy quyền Shopee.",
  "6. Log in as the legitimate Shopee Seller/admin and approve the Partner App.":
    "6. Đăng nhập bằng Shopee Seller/admin hợp lệ và phê duyệt Partner App.",
  "7. After callback, the app stores access_token, refresh_token, and shop_id. The status should be authorized, not production-ready.":
    "7. Sau callback, app lưu access_token, refresh_token và shop_id. Trạng thái nên là authorized, chưa phải production-ready.",
  "8. Configure the webhook URL in Shopee Open Platform.":
    "8. Cấu hình webhook URL trong Shopee Open Platform.",
  "9. Send a buyer message test from Shopee chat.":
    "9. Gửi thử một tin nhắn buyer từ Shopee chat.",
  "10. Check status/debug: webhook_verified, chat_receive_verified, and chat_send_verified should appear as each stage succeeds.":
    "10. Kiểm tra status/debug: webhook_verified, chat_receive_verified và chat_send_verified sẽ xuất hiện khi từng bước thành công.",
  "Shopee signing helper builds OpenAPI v2-style HMAC signatures for auth, token, and signed API calls.":
    "Shopee signing helper tạo chữ ký HMAC kiểu OpenAPI v2 cho auth, token và các API call đã ký.",
  "Tokens are stored per ChannelAccount config and masked in admin/API responses. After successful token exchange the account status is authorized, which only means credentials were saved.":
    "Token được lưu theo từng ChannelAccount config và được mask trong phản hồi admin/API. Sau khi đổi token thành công, trạng thái account là authorized, nghĩa là credential đã lưu chứ chưa production-ready.",
  "Token refresh helper is available and the send adapter checks tokenExpiresAt before sending; if the token is near expiry it attempts refresh-on-demand without logging tokens.":
    "Token refresh helper đã có và send adapter kiểm tra tokenExpiresAt trước khi gửi; nếu token gần hết hạn, nó thử refresh-on-demand mà không log token.",
  "No scheduler/cron is included yet. Production should add a cron/queue after token lifetime is verified in Shopee console.":
    "Chưa có scheduler/cron. Production nên thêm cron/queue sau khi xác minh vòng đời token trong Shopee console.",
  "Incoming buyer text events are mapped into NormalizedInboundMessage with channel=shopee.":
    "Event text inbound của người mua được map vào NormalizedInboundMessage với channel=shopee.",
  "Call processNormalizedInboundMessage() to create/update customer conversation and get the AI response.":
    "Gọi processNormalizedInboundMessage() để tạo/cập nhật hội thoại khách hàng và lấy phản hồi AI.",
  "Shopee outbound send-message adapter signs and sends the AI response back to the buyer chat.":
    "Shopee outbound send-message adapter ký request và gửi phản hồi AI lại buyer chat.",
  "Idempotency key helper exists for channel + shop_id + message_id/conversation_id and is stored as safe metadata. Durable storage-backed dedupe is still required before production go-live.":
    "Idempotency key helper đã có cho channel + shop_id + message_id/conversation_id và được lưu dạng metadata an toàn. Vẫn cần dedupe có lưu trữ bền vững trước production go-live.",
  "Known gap: rate-limit/backoff and production alerting should be tuned after real Shopee response codes are observed.":
    "Khoảng trống hiện tại: rate-limit/backoff và production alerting cần tinh chỉnh sau khi quan sát response code Shopee thật.",
  "Buyer sends message in Shopee chat.":
    "Người mua gửi tin trong Shopee chat.",
  "Shopee Push/Webchat Push calls <APP_ORIGIN>/api/webhooks/shopee.":
    "Shopee Push/Webchat Push gọi <APP_ORIGIN>/api/webhooks/shopee.",
  "LinhKienLed1000 verifies request signature and finds ChannelAccount by shop_id.":
    "LinhKienLed1000 xác minh chữ ký request và tìm ChannelAccount theo shop_id.",
  "Shopee payload maps to NormalizedInboundMessage: channel=shopee, channelAccountId, externalCustomerId, customerContact=shopee:<buyer_id>, externalConversationId, platformMessageId, text.":
    "Payload Shopee được map thành NormalizedInboundMessage: channel=shopee, channelAccountId, externalCustomerId, customerContact=shopee:<buyer_id>, externalConversationId, platformMessageId, text.",
  "processNormalizedInboundMessage() resolves customer, finds or creates the conversation, calls chat(), and returns the AI response.":
    "processNormalizedInboundMessage() resolve customer, tìm hoặc tạo hội thoại, gọi chat() và trả về phản hồi AI.",
  "Shopee send adapter signs a send-message API request and sends the bot response back to Shopee.":
    "Shopee send adapter ký request Send Message API và gửi phản hồi bot lại Shopee.",
  "The Conversations page shows platform=Shopee, shop/account name, buyer identity, status, and the message history.":
    "Trang Hội thoại hiển thị platform=Shopee, tên shop/account, định danh người mua, trạng thái và lịch sử tin nhắn.",
  "Unit test Shopee signing helper with official examples from Shopee console/docs.":
    "Unit test Shopee signing helper bằng ví dụ chính thức từ Shopee console/docs.",
  "Unit test token refresh without printing tokens.":
    "Unit test token refresh mà không in token.",
  "API test webhook signature rejection for invalid/missing signature.":
    "API test việc từ chối webhook khi chữ ký sai/thiếu.",
  "API test incoming chat payload creates a conversation with channel=shopee and channelAccountId set.":
    "API test payload chat inbound tạo hội thoại với channel=shopee và có channelAccountId.",
  "API test duplicate event id is ignored or does not send a second reply.":
    "API test event id trùng bị bỏ qua hoặc không gửi phản hồi lần hai.",
  "API test outbound send adapter builds signed request with the correct shop_id/access_token but never logs secrets.":
    "API test outbound send adapter tạo request đã ký với shop_id/access_token đúng nhưng không log secret.",
  "End-to-end test with a real Shopee test shop: buyer sends message -> bot creates conversation -> bot sends reply.":
    "Test end-to-end với shop Shopee test thật: buyer gửi tin -> bot tạo hội thoại -> bot gửi phản hồi.",
  "Cannot create partner app: the business may need a verified Shopee Open Platform partner/developer account.":
    "Không tạo được partner app: doanh nghiệp có thể cần tài khoản partner/developer Shopee Open Platform đã xác minh.",
  "Seller authorization fails: check redirect URL, app status, region, and shop admin permission.":
    "Ủy quyền seller fail: kiểm tra redirect URL, trạng thái app, region và quyền admin shop.",
  "401/403 from Shopee: token expired, app lacks scope, signature is wrong, or shop authorization was revoked.":
    "Shopee trả 401/403: token hết hạn, app thiếu scope, chữ ký sai hoặc ủy quyền shop đã bị thu hồi.",
  "Webhook not received: check public HTTPS URL, Shopee push configuration, firewall, tunnel, and app approval state.":
    "Không nhận webhook: kiểm tra URL HTTPS public, cấu hình Shopee push, firewall, tunnel và trạng thái duyệt app.",
  "Webhook received but no bot reply: check payload mapping, AI provider/API key, Knowledge Base data, and Shopee send-message scope.":
    "Nhận webhook nhưng bot không trả lời: kiểm tra payload mapping, AI provider/API key, Knowledge Base data và scope send-message Shopee.",
  "Bot replies twice: check webhook retry idempotency by event id/message id.":
    "Bot trả lời hai lần: kiểm tra idempotency retry webhook theo event id/message id.",
  "Can read product/order data but cannot chat: chat/customer-service API may require separate scope or approval.":
    "Đọc được product/order nhưng không chat được: API chat/customer-service có thể cần scope hoặc phê duyệt riêng.",
  "Endpoint/path names for seller chat must be verified in the real Shopee Partner Console/docs for the customer app and region.":
    "Tên endpoint/path cho seller chat phải được xác minh trong Shopee Partner Console/docs thật theo app và region của khách.",
  "Webhook payload shape should be captured safely from a real test event before treating parser behavior as final.":
    "Dạng payload webhook nên được ghi nhận an toàn từ event test thật trước khi xem parser là cuối cùng.",
  "Chat/customer-service scope may require separate Shopee approval even if product/order APIs work.":
    "Scope chat/customer-service có thể cần Shopee phê duyệt riêng dù API product/order đã hoạt động.",
  "Durable storage-backed idempotency/dedupe remains a production requirement before live operation.":
    "Idempotency/dedupe có lưu trữ bền vững vẫn là yêu cầu production trước khi vận hành thật.",
  "Rate-limit/backoff and production alerting should be tuned after real Shopee response codes are observed.":
    "Rate-limit/backoff và production alerting cần tinh chỉnh sau khi quan sát response code Shopee thật.",
  "ChannelAccount supports type=tiktok_shop and can store one or more TikTok Shop seller/shop accounts.":
    "ChannelAccount hỗ trợ type=tiktok_shop và có thể lưu một hoặc nhiều tài khoản seller/shop TikTok Shop.",
  "The account form supports Shop/Seller ID, App/Client key, App secret, access token, refresh token, webhook secret, API base URL, auth base URL, and send message path.":
    "Form account hỗ trợ Shop/Seller ID, App/Client key, App secret, access token, refresh token, webhook secret, API base URL, auth base URL và send message path.",
  "Outbound send back to TikTok Shop is intentionally not marked production-ready until exact Partner Center Customer Service API contract is verified with a real app/shop.":
    "Gửi outbound về TikTok Shop được cố ý chưa đánh dấu production-ready cho đến khi contract Customer Service API trong Partner Center được xác minh bằng app/shop thật.",
  "Create or obtain a legitimate TikTok Shop Seller account for the customer. A normal TikTok user account is not enough.":
    "Tạo hoặc có sẵn tài khoản TikTok Shop Seller hợp lệ cho khách hàng. Tài khoản TikTok thường là không đủ.",
  "Make sure the operator has admin permission for the shop/seller account.":
    "Đảm bảo operator có quyền admin với tài khoản shop/seller.",
  "Create or obtain a TikTok Shop Partner Center/Open Platform app for LinhKienLed1000.":
    "Tạo hoặc có sẵn app TikTok Shop Partner Center/Open Platform cho LinhKienLed1000.",
  "Request/confirm Customer Service or buyer chat messaging scopes in Partner Center.":
    "Yêu cầu/xác nhận scope Customer Service hoặc buyer chat messaging trong Partner Center.",
  "Prepare a public HTTPS app URL. For local testing, use a temporary HTTPS tunnel only for testing.":
    "Chuẩn bị app URL HTTPS public. Test local thì chỉ dùng HTTPS tunnel tạm thời để test.",
  "account config: implemented through ChannelAccount type=tiktok_shop.":
    "account config: đã triển khai qua ChannelAccount type=tiktok_shop.",
  "secret masking: implemented with hasAccessToken, hasRefreshToken, hasAppSecret, and hasWebhookSecret flags.":
    "secret masking: đã triển khai bằng các cờ hasAccessToken, hasRefreshToken, hasAppSecret và hasWebhookSecret.",
  "safe debug metadata: implemented without storing raw payloads or raw message text.":
    "safe debug metadata: đã triển khai mà không lưu raw payload hoặc raw message text.",
  "normalized inbound flow: implemented with channel=tiktok_shop.":
    "normalized inbound flow: đã triển khai với channel=tiktok_shop.",
  "mock/local tests: implemented for parser, signature helper, account config, and webhook route.":
    "mock/local tests: đã triển khai cho parser, signature helper, account config và webhook route.",
  "OAuth/callback: requires Partner Center contract verification before implementation can be finalized.":
    "OAuth/callback: cần xác minh contract trong Partner Center trước khi chốt triển khai.",
  "outbound send-message: requires Partner Center contract verification before production use.":
    "outbound send-message: cần xác minh contract trong Partner Center trước khi dùng production.",
  "production-ready: no, not until real Partner Center E2E passes.":
    "production-ready: chưa, cho đến khi pass E2E thật với Partner Center.",
  "Webhook URL: https://<your-app-domain>/api/webhooks/tiktok-shop.":
    "Webhook URL: https://<your-app-domain>/api/webhooks/tiktok-shop.",
  "Authorization/callback URL: verify the exact TikTok Shop Partner Center OAuth flow first, then configure the app callback URL that matches the final implementation.":
    "Authorization/callback URL: xác minh chính xác luồng OAuth của TikTok Shop Partner Center trước, sau đó cấu hình app callback URL khớp với triển khai cuối.",
  "Localhost does not work for real TikTok webhooks. Use deployed HTTPS or a temporary HTTPS tunnel for testing.":
    "Localhost không hoạt động với webhook TikTok thật. Dùng HTTPS đã deploy hoặc HTTPS tunnel tạm thời để test.",
  "shopId: stable TikTok Shop id when Partner Center exposes it.":
    "shopId: ID TikTok Shop ổn định khi Partner Center cung cấp.",
  "sellerId: seller/account id if this is the stable id exposed by TikTok Shop APIs.":
    "sellerId: ID seller/account nếu đây là ID ổn định do TikTok Shop API cung cấp.",
  "appKey / clientKey: public app/client identifier from Partner Center.":
    "appKey / clientKey: định danh app/client public từ Partner Center.",
  "appSecret / clientSecret: secret credential; store only as masked secret.":
    "appSecret / clientSecret: credential bí mật; chỉ lưu dưới dạng secret được mask.",
  "accessToken: token for authorized API calls after real OAuth/token exchange.":
    "accessToken: token dùng cho API call đã authorized sau khi OAuth/đổi token thật.",
  "refreshToken: token used to rotate access token when TikTok Shop provides it.":
    "refreshToken: token dùng để rotate access token khi TikTok Shop cung cấp.",
  "webhookSecret: signing secret or equivalent verification material.":
    "webhookSecret: signing secret hoặc vật liệu xác minh tương đương.",
  "integrationStatus: current stage such as config_saved, authorization_required, webhook_verified, chat_receive_verified, or production_ready.":
    "integrationStatus: stage hiện tại như config_saved, authorization_required, webhook_verified, chat_receive_verified hoặc production_ready.",
  "lastWebhookAt, lastWebhookParseStatus, lastChatReceiveAt, lastChatSendAt: safe debug timestamps/status only.":
    "lastWebhookAt, lastWebhookParseStatus, lastChatReceiveAt, lastChatSendAt: chỉ là timestamp/status debug an toàn.",
  "sendMessagePath: pending/verified send-message path. Leave unset until Partner Center confirms the endpoint.":
    "sendMessagePath: path send-message đang chờ/xác minh. Để trống cho đến khi Partner Center xác nhận endpoint.",
  "1. Open Channels -> Accounts -> Add TikTok Shop.":
    "1. Mở Kênh liên hệ -> Tài khoản -> Thêm TikTok Shop.",
  "2. Enter display name and Shop/Seller ID.":
    "2. Nhập tên hiển thị và Shop/Seller ID.",
  "3. Enter App/Client key and App secret from Partner Center. Do not expose these in logs or screenshots.":
    "3. Nhập App/Client key và App secret từ Partner Center. Không để lộ các giá trị này trong log hoặc ảnh chụp.",
  "5. Click Ủy quyền shop. Current behavior keeps status at authorization_required until the exact Partner Center auth flow is verified.":
    "5. Bấm Ủy quyền shop. Hành vi hiện tại giữ trạng thái authorization_required cho đến khi xác minh đúng luồng auth của Partner Center.",
  "6. Configure webhook URL in Partner Center and send a real/test buyer message payload.":
    "6. Cấu hình webhook URL trong Partner Center và gửi payload tin nhắn buyer thật/test.",
  "7. Check safe debug fields on the account: webhook_verified and chat_receive_verified indicate inbound receive works. chat_send_verified should only be used after outbound send API is verified.":
    "7. Kiểm tra các field debug an toàn trên account: webhook_verified và chat_receive_verified cho biết inbound receive hoạt động. Chỉ dùng chat_send_verified sau khi outbound send API được xác minh.",
  "Buyer sends message in TikTok Shop customer service chat.":
    "Người mua gửi tin trong customer service chat của TikTok Shop.",
  "TikTok Shop webhook calls <APP_ORIGIN>/api/webhooks/tiktok-shop.":
    "Webhook TikTok Shop gọi <APP_ORIGIN>/api/webhooks/tiktok-shop.",
  "LinhKienLed1000 verifies signature when webhookSecret/appSecret is configured and finds ChannelAccount by shop_id/seller_id.":
    "LinhKienLed1000 xác minh chữ ký khi có webhookSecret/appSecret và tìm ChannelAccount theo shop_id/seller_id.",
  "Payload maps to NormalizedInboundMessage: channel=tiktok_shop, channelAccountId, externalCustomerId, customerContact=tiktok_shop:<shop_id>:<buyer_id>, externalConversationId, platformMessageId, text.":
    "Payload được map thành NormalizedInboundMessage: channel=tiktok_shop, channelAccountId, externalCustomerId, customerContact=tiktok_shop:<shop_id>:<buyer_id>, externalConversationId, platformMessageId, text.",
  "After Partner Center send endpoint is verified, a send adapter should deliver the response back to TikTok Shop buyer chat.":
    "Sau khi endpoint gửi của Partner Center được xác minh, send adapter sẽ gửi phản hồi lại buyer chat TikTok Shop.",
  "TikTok Shop should not be expected to behave like Facebook/Instagram until Partner Center access confirms Customer Service API and Send Message contract.":
    "Không nên kỳ vọng TikTok Shop hoạt động như Facebook/Instagram cho đến khi quyền Partner Center xác nhận Customer Service API và contract Send Message.",
  "A saved TikTok Shop account means config exists; it does not mean OAuth, webhook signature, receive, or send has passed.":
    "Tài khoản TikTok Shop đã lưu nghĩa là có config; chưa có nghĩa OAuth, webhook signature, receive hoặc send đã pass.",
  "If Partner Center does not grant customer-service/message scopes, the app cannot force buyer-chat automation.":
    "Nếu Partner Center không cấp scope customer-service/message, app không thể ép tự động hóa buyer-chat.",
  "Any seller verification, business verification, tax, or bank requirements must be completed in TikTok Shop/Seller Center by the customer.":
    "Mọi yêu cầu xác minh seller, doanh nghiệp, thuế hoặc ngân hàng phải được khách hoàn tất trong TikTok Shop/Seller Center.",
  "Scope: this section is the API reference for the shared Meta callback. For key/token setup steps, start from Meta Setup Guide.":
    "Phạm vi: section này là API reference cho callback Meta dùng chung. Với các bước cấu hình key/token, hãy bắt đầu từ Hướng dẫn cấu hình Meta.",
  "Callback URL: Facebook Messenger and Instagram Direct Messaging share <APP_ORIGIN>/api/webhooks/meta.":
    "Callback URL: Facebook Messenger và Instagram Direct Messaging dùng chung <APP_ORIGIN>/api/webhooks/meta.",
  "Shared flow: Meta webhook -> parse payload -> detect platform -> resolveCustomer -> find/create Conversation -> chat(conversation.id, text) -> send reply.":
    "Luồng dùng chung: Meta webhook -> parse payload -> nhận diện nền tảng -> resolveCustomer -> tìm/tạo Conversation -> chat(conversation.id, text) -> gửi phản hồi.",
  "Platform detection: Facebook uses object=page; Instagram uses object=instagram.":
    "Nhận diện nền tảng: Facebook dùng object=page; Instagram dùng object=instagram.",
  "Supported events: currently supported = text messages. Ignored = echo, non-text, delivery/read receipts, and reactions.":
    "Event được hỗ trợ: hiện hỗ trợ tin nhắn text. Bỏ qua echo, non-text, delivery/read receipt và reaction.",
  "Security: x-hub-signature-256 is verified when META_APP_SECRET or a channel appSecret is configured.":
    "Bảo mật: x-hub-signature-256 được xác minh khi có cấu hình META_APP_SECRET hoặc appSecret của kênh.",
  "Webhook verification: GET verification uses hub.mode=subscribe, hub.verify_token, and hub.challenge.":
    "Xác minh webhook: GET verification dùng hub.mode=subscribe, hub.verify_token và hub.challenge.",
  "Try it note: POST Try it uses a Facebook object=page payload only as a runnable sample. Copy Instagram payloads from the Instagram Direct Messaging section.":
    "Ghi chú Try it: POST Try it dùng payload Facebook object=page chỉ để có mẫu chạy được. Hãy copy payload Instagram từ section Instagram Direct Messaging.",
  "In LinhKienLed1000 Channels -> Accounts -> Facebook, add or edit the Page account and fill Verify Token, Page Access Token, Graph Version, optional Page ID, and App Secret.":
    "Trong LinhKienLed1000, vào Kênh liên hệ -> Tài khoản -> Facebook, thêm hoặc sửa Page account rồi nhập Verify Token, Page Access Token, Graph Version, Page ID tùy chọn và App Secret.",
  "In the Meta Developer App, open the Instagram API with Instagram Login setup flow.":
    "Trong Meta Developer App, mở luồng cấu hình Instagram API with Instagram Login.",
  "Configure the app/account according to Meta's Instagram Direct Messaging requirements.":
    "Cấu hình app/account theo yêu cầu Instagram Direct Messaging của Meta.",
  "Optional Business Account ID is metadata for checking/debugging. Webhook recipient.id can also help confirm which Instagram account received a message.":
    "Business Account ID là metadata tùy chọn để kiểm tra/debug. Webhook recipient.id cũng có thể giúp xác nhận tài khoản Instagram nào đã nhận tin.",
  "In LinhKienLed1000 Channels -> Accounts -> Instagram, add or edit the Business account and fill Verify Token, Access Token, Graph Version, optional Business Account ID, and App Secret.":
    "Trong LinhKienLed1000, vào Kênh liên hệ -> Tài khoản -> Instagram, thêm hoặc sửa Business account rồi nhập Verify Token, Access Token, Graph Version, Business Account ID tùy chọn và App Secret.",
  "In Meta Dashboard webhook settings, use the same shared callback URL: <APP_ORIGIN>/api/webhooks/meta.":
    "Trong webhook settings của Meta Dashboard, dùng cùng callback URL dùng chung: <APP_ORIGIN>/api/webhooks/meta.",
  "Subscribe the required Instagram messaging/webhook events in Meta Dashboard.":
    "Subscribe các event Instagram messaging/webhook cần thiết trong Meta Dashboard.",
  "Before going live for a customer, review the official Meta docs for the current permission and review requirements for Messenger and Instagram Direct Messaging.":
    "Trước khi go-live cho khách, review tài liệu Meta chính thức về quyền và yêu cầu review hiện tại cho Messenger và Instagram Direct Messaging.",
  "Meta webhook verification succeeds when Meta sends hub.mode=subscribe and LinhKienLed1000 returns hub.challenge as plain text.":
    "Xác minh webhook Meta thành công khi Meta gửi hub.mode=subscribe và LinhKienLed1000 trả hub.challenge dạng plain text.",
  "Facebook test succeeds when a Messenger message creates or updates a conversation with channel=facebook.":
    "Test Facebook thành công khi tin nhắn Messenger tạo hoặc cập nhật hội thoại với channel=facebook.",
  "Instagram test succeeds when an Instagram DM creates or updates a conversation with channel=instagram.":
    "Test Instagram thành công khi Instagram DM tạo hoặc cập nhật hội thoại với channel=instagram.",
  "Open Messenger Platform docs when creating/configuring the Facebook Messenger product.":
    "Mở tài liệu Messenger Platform khi tạo/cấu hình product Facebook Messenger.",
  "Open Messenger Webhooks docs when choosing webhook fields/events and verifying callback behavior.":
    "Mở tài liệu Messenger Webhooks khi chọn field/event webhook và xác minh hành vi callback.",
  "Open Messenger Send API docs when debugging Facebook outbound replies.":
    "Mở tài liệu Messenger Send API khi debug phản hồi outbound Facebook.",
  "Open Instagram Platform docs when checking account eligibility and Instagram API requirements.":
    "Mở tài liệu Instagram Platform khi kiểm tra điều kiện tài khoản và yêu cầu Instagram API.",
  "Open Instagram API with Instagram Login docs when generating or validating Instagram access tokens.":
    "Mở tài liệu Instagram API with Instagram Login khi tạo hoặc xác thực Instagram access token.",
  "Open Graph API Webhooks docs when Meta changes webhook dashboard screens or verification wording.":
    "Mở tài liệu Graph API Webhooks khi Meta thay đổi màn hình webhook dashboard hoặc wording xác minh.",
  "Facebook Webhook Payload": "Payload Webhook Facebook",
  "Facebook Channel Config": "Cấu hình kênh Facebook",
  "Instagram Webhook Payload": "Payload Webhook Instagram",
  "Instagram Channel Config": "Cấu hình kênh Instagram",
  "Meta for Developers Apps": "Meta for Developers Apps",
  "Graph API Webhooks": "Graph API Webhooks",
  "Messenger Platform": "Messenger Platform",
  "Messenger Webhooks": "Messenger Webhooks",
  "Messenger Send API": "Messenger Send API",
  "Instagram Platform": "Instagram Platform",
  "Instagram API with Instagram Login": "Instagram API with Instagram Login",
  "Instagram API Get Started": "Instagram API Get Started",
  "Business Login for Instagram": "Business Login for Instagram",
  "Shopee Open Platform": "Shopee Open Platform",
  "Shopee API Calls": "Shopee API Calls",
  "Shopee Push Mechanism": "Shopee Push Mechanism",
  "Shopee Authorization Process": "Shopee Authorization Process",
  "Shopee Order Management": "Shopee Order Management",
  "Shopee Product Price Guide": "Shopee Product Price Guide",
  "Shopee Platform Partner Rules": "Shopee Platform Partner Rules",
  "TikTok Shop Partner Center": "TikTok Shop Partner Center",
  "TikTok Shop Customer Service API Overview": "TikTok Shop Customer Service API Overview",
  "TikTok Shop Authorization Overview": "TikTok Shop Authorization Overview",
  "TikTok Webhooks Overview": "TikTok Webhooks Overview",
  "Check the API health status. Returns uptime and database connectivity status.":
    "Kiểm tra trạng thái sức khỏe API. Trả về uptime và trạng thái kết nối database.",
  "How do I reset my password?": "Làm sao để đặt lại mật khẩu?",
  "To reset your password, go to Settings > Security and click 'Reset Password'...":
    "Để đặt lại mật khẩu, vào Cài đặt > Bảo mật và bấm 'Đặt lại mật khẩu'...",
  "Customer asked about password reset.": "Khách hỏi về việc đặt lại mật khẩu.",
  "User reports 403 error when accessing the main dashboard.":
    "Người dùng báo lỗi 403 khi truy cập dashboard chính.",
  "Fixed permission configuration for the user.": "Đã sửa cấu hình quyền cho người dùng.",
  "Go to Settings > Security...": "Vào Cài đặt > Bảo mật...",
  "How to update billing info": "Cách cập nhật thông tin thanh toán",
  "Navigate to Account > Billing and click 'Update Payment Method'...":
    "Vào Tài khoản > Thanh toán và bấm 'Cập nhật phương thức thanh toán'...",
  "Welcome to Acme! How can we assist you?": "Chào mừng đến Acme! Chúng tôi có thể hỗ trợ gì cho bạn?",
  "Slack notifications": "Thông báo Slack",
  "Slack notification": "Thông báo Slack",
  "Channels -> Accounts -> Facebook -> Verify Token.":
    "Kênh liên hệ -> Tài khoản -> Facebook -> Verify Token.",
  "Channels -> Accounts -> Facebook -> Page Access Token.":
    "Kênh liên hệ -> Tài khoản -> Facebook -> Page Access Token.",
  "Channels -> Accounts -> Facebook -> Page ID, optional.":
    "Kênh liên hệ -> Tài khoản -> Facebook -> Page ID, tùy chọn.",
  "Channels -> Accounts -> Facebook -> Graph Version.":
    "Kênh liên hệ -> Tài khoản -> Facebook -> Graph Version.",
  "Channels -> Accounts -> Facebook -> App Secret, required for production webhook signature checks.":
    "Kênh liên hệ -> Tài khoản -> Facebook -> App Secret, bắt buộc để kiểm tra chữ ký webhook production.",
  "Channels -> Accounts -> Instagram -> Verify Token.":
    "Kênh liên hệ -> Tài khoản -> Instagram -> Verify Token.",
  "Channels -> Accounts -> Instagram -> Access Token.":
    "Kênh liên hệ -> Tài khoản -> Instagram -> Access Token.",
  "Channels -> Accounts -> Instagram -> Business Account ID, optional.":
    "Kênh liên hệ -> Tài khoản -> Instagram -> Business Account ID, tùy chọn.",
  "Channels -> Accounts -> Instagram -> Graph Version.":
    "Kênh liên hệ -> Tài khoản -> Instagram -> Graph Version.",
  "Channels -> Accounts -> Instagram -> App Secret, required for production webhook signature checks.":
    "Kênh liên hệ -> Tài khoản -> Instagram -> App Secret, bắt buộc để kiểm tra chữ ký webhook production.",
  "Scope: this section documents Facebook channel config APIs and Facebook payload examples. For step-by-step setup and where to paste values, use Meta Setup Guide.":
    "Phạm vi: section này mô tả API cấu hình kênh Facebook và ví dụ payload Facebook. Với hướng dẫn từng bước và vị trí nhập giá trị, dùng Hướng dẫn cấu hình Meta.",
  "Facebook payload mapping: sender.id -> customer PSID, recipient.id -> Facebook Page ID, customerContact -> facebook:<psid>.":
    "Mapping payload Facebook: sender.id -> PSID khách hàng, recipient.id -> Facebook Page ID, customerContact -> facebook:<psid>.",
  "Security: GET channel responses never return raw pageAccessToken or appSecret. Blank or masked secret fields preserve the existing secret on save.":
    "Bảo mật: phản hồi GET channel không bao giờ trả raw pageAccessToken hoặc appSecret. Field secret để trống hoặc bị mask sẽ giữ secret hiện có khi lưu.",
  "Local POST test: curl -X POST \"http://localhost:3000/api/webhooks/meta\" -H \"Content-Type: application/json\" -d \"{\\\"object\\\":\\\"page\\\",\\\"entry\\\":[{\\\"messaging\\\":[{\\\"sender\\\":{\\\"id\\\":\\\"USER_PSID_TEST\\\"},\\\"recipient\\\":{\\\"id\\\":\\\"PAGE_ID_TEST\\\"},\\\"message\\\":{\\\"text\\\":\\\"hello facebook\\\"}}]}]}\"":
    "Test POST local: curl -X POST \"http://localhost:3000/api/webhooks/meta\" -H \"Content-Type: application/json\" -d \"{\\\"object\\\":\\\"page\\\",\\\"entry\\\":[{\\\"messaging\\\":[{\\\"sender\\\":{\\\"id\\\":\\\"USER_PSID_TEST\\\"},\\\"recipient\\\":{\\\"id\\\":\\\"PAGE_ID_TEST\\\"},\\\"message\\\":{\\\"text\\\":\\\"hello facebook\\\"}}]}]}\"",
  "Get sanitized Facebook channel config. Use type=facebook. Raw pageAccessToken and appSecret are never returned.":
    "Lấy cấu hình kênh Facebook đã sanitize. Dùng type=facebook. Raw pageAccessToken và appSecret không bao giờ được trả về.",
  "Create or update Facebook channel config. Blank or masked pageAccessToken/appSecret values preserve existing secrets.":
    "Tạo hoặc cập nhật cấu hình kênh Facebook. Giá trị pageAccessToken/appSecret để trống hoặc bị mask sẽ giữ secret hiện có.",
  "Scope: this section documents Instagram channel config APIs and Instagram payload examples. For step-by-step setup and where to paste values, use Meta Setup Guide.":
    "Phạm vi: section này mô tả API cấu hình kênh Instagram và ví dụ payload Instagram. Với hướng dẫn từng bước và vị trí nhập giá trị, dùng Hướng dẫn cấu hình Meta.",
  "Important: this integration targets Instagram Direct Messaging API / Instagram API with Instagram Login.":
    "Quan trọng: tích hợp này nhắm tới Instagram Direct Messaging API / Instagram API with Instagram Login.",
  "Business Account ID: optional metadata in LinhKienLed1000. The webhook payload recipient.id can help confirm which Instagram business/account received the message.":
    "Business Account ID: metadata tùy chọn trong LinhKienLed1000. recipient.id trong payload webhook giúp xác nhận business/account Instagram nào nhận tin nhắn.",
  "Instagram payload mapping: sender.id -> Instagram sender id, recipient.id -> Instagram business/account id, customerContact -> instagram:<sender_id>.":
    "Mapping payload Instagram: sender.id -> Instagram sender id, recipient.id -> Instagram business/account id, customerContact -> instagram:<sender_id>.",
  "Security: GET channel responses never return raw accessToken or appSecret. Blank or masked secret fields preserve the existing secret on save.":
    "Bảo mật: phản hồi GET channel không bao giờ trả raw accessToken hoặc appSecret. Field secret để trống hoặc bị mask sẽ giữ secret hiện có khi lưu.",
  "Local POST test: curl -X POST \"http://localhost:3000/api/webhooks/meta\" -H \"Content-Type: application/json\" -d \"{\\\"object\\\":\\\"instagram\\\",\\\"entry\\\":[{\\\"messaging\\\":[{\\\"sender\\\":{\\\"id\\\":\\\"IG_SENDER_TEST\\\"},\\\"recipient\\\":{\\\"id\\\":\\\"IG_BUSINESS_TEST\\\"},\\\"message\\\":{\\\"text\\\":\\\"hello instagram\\\"}}]}]}\"":
    "Test POST local: curl -X POST \"http://localhost:3000/api/webhooks/meta\" -H \"Content-Type: application/json\" -d \"{\\\"object\\\":\\\"instagram\\\",\\\"entry\\\":[{\\\"messaging\\\":[{\\\"sender\\\":{\\\"id\\\":\\\"IG_SENDER_TEST\\\"},\\\"recipient\\\":{\\\"id\\\":\\\"IG_BUSINESS_TEST\\\"},\\\"message\\\":{\\\"text\\\":\\\"hello instagram\\\"}}]}]}\"",
  "Get sanitized Instagram channel config. Use type=instagram. Raw accessToken and appSecret are never returned.":
    "Lấy cấu hình kênh Instagram đã sanitize. Dùng type=instagram. Raw accessToken và appSecret không bao giờ được trả về.",
  "Update Instagram channel config. Blank or masked accessToken/appSecret values preserve existing secrets.":
    "Cập nhật cấu hình kênh Instagram. Giá trị accessToken/appSecret để trống hoặc bị mask sẽ giữ secret hiện có.",
  "Export data in CSV or JSON format. Supports exporting conversations, tickets, knowledge base entries, and customers.":
    "Xuất dữ liệu ở định dạng CSV hoặc JSON. Hỗ trợ xuất hội thoại, ticket, mục Kho kiến thức và khách hàng.",
  "Returns CSV or JSON file as download": "Trả về file CSV hoặc JSON để tải xuống",
  "processNormalizedInboundMessage() resolves customer, finds or creates conversation, calls chat(), and returns the AI response.":
    "processNormalizedInboundMessage() resolve customer, tìm hoặc tạo hội thoại, gọi chat() và trả về phản hồi AI.",
  'Local POST test: curl -X POST \\"http://localhost:3000/api/webhooks/meta\\" -H \\"Content-Type: application/json\\" -d \\"{\\\\\\"object\\\\\\":\\\\\\"page\\\\\\",\\\\\\"entry\\\\\\":[{\\\\\\"messaging\\\\\\":[{\\\\\\"sender\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"USER_PSID_TEST\\\\\\"},\\\\\\"recipient\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"PAGE_ID_TEST\\\\\\"},\\\\\\"message\\\\\\":{\\\\\\"text\\\\\\":\\\\\\"hello facebook\\\\\\"}}]}]}\\"':
    'Test POST local: curl -X POST \\"http://localhost:3000/api/webhooks/meta\\" -H \\"Content-Type: application/json\\" -d \\"{\\\\\\"object\\\\\\":\\\\\\"page\\\\\\",\\\\\\"entry\\\\\\":[{\\\\\\"messaging\\\\\\":[{\\\\\\"sender\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"USER_PSID_TEST\\\\\\"},\\\\\\"recipient\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"PAGE_ID_TEST\\\\\\"},\\\\\\"message\\\\\\":{\\\\\\"text\\\\\\":\\\\\\"hello facebook\\\\\\"}}]}]}\\"',
  'Local POST test: curl -X POST \\"http://localhost:3000/api/webhooks/meta\\" -H \\"Content-Type: application/json\\" -d \\"{\\\\\\"object\\\\\\":\\\\\\"instagram\\\\\\",\\\\\\"entry\\\\\\":[{\\\\\\"messaging\\\\\\":[{\\\\\\"sender\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"IG_SENDER_TEST\\\\\\"},\\\\\\"recipient\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"IG_BUSINESS_TEST\\\\\\"},\\\\\\"message\\\\\\":{\\\\\\"text\\\\\\":\\\\\\"hello instagram\\\\\\"}}]}]}\\"':
    'Test POST local: curl -X POST \\"http://localhost:3000/api/webhooks/meta\\" -H \\"Content-Type: application/json\\" -d \\"{\\\\\\"object\\\\\\":\\\\\\"instagram\\\\\\",\\\\\\"entry\\\\\\":[{\\\\\\"messaging\\\\\\":[{\\\\\\"sender\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"IG_SENDER_TEST\\\\\\"},\\\\\\"recipient\\\\\\":{\\\\\\"id\\\\\\":\\\\\\"IG_BUSINESS_TEST\\\\\\"},\\\\\\"message\\\\\\":{\\\\\\"text\\\\\\":\\\\\\"hello instagram\\\\\\"}}]}]}\\"',
};

const guideTitleVi: Record<string, string> = {
  "Web widget / API": "Web widget / API",
  "Facebook Messenger": "Facebook Messenger",
  "Instagram Direct Messaging": "Instagram Direct Messaging",
  "Zalo Python relay": "Zalo Python relay",
  "Zalo Official OA": "Zalo Official OA",
  Shopee: "Shopee",
  "TikTok Shop": "TikTok Shop",
  WhatsApp: "WhatsApp",
  Email: "Email",
  "Phone / Twilio voice": "Điện thoại / Twilio voice",
  "SMS / Twilio": "SMS / Twilio",
  Telegram: "Telegram",
  "Status meanings": "Ý nghĩa trạng thái",
  "Operator rules": "Quy tắc vận hành",
  "General E2E checklist": "Checklist E2E chung",
  "Meta E2E": "E2E Meta",
  "Zalo E2E": "E2E Zalo",
  "Shopee E2E": "E2E Shopee",
  "TikTok Shop E2E": "E2E TikTok Shop",
  "Credential and permission limits": "Giới hạn credential và quyền nền tảng",
  "Suggested message": "Tin nhắn gợi ý",
  "1. Before you start": "1. Trước khi bắt đầu",
  "2. Understand what each Meta value means": "2. Hiểu ý nghĩa từng giá trị Meta",
  "3. Where to paste in LinhKienLed1000": "3. Nhập vào đâu trong LinhKienLed1000",
  "4. Create or choose the Meta Developer App": "4. Tạo hoặc chọn Meta Developer App",
  "5. Prepare the Facebook Page": "5. Chuẩn bị Facebook Page",
  "6. Get the Facebook Page Access Token": "6. Lấy Facebook Page Access Token",
  "7. Configure Facebook Messenger webhook": "7. Cấu hình webhook Facebook Messenger",
  "8. Prepare the Instagram account": "8. Chuẩn bị tài khoản Instagram",
  "9. Get the Instagram Access Token": "9. Lấy Instagram Access Token",
  "10. Configure Instagram Direct Messaging webhook": "10. Cấu hình webhook Instagram Direct Messaging",
  "11. Production note": "11. Ghi chú production",
  "12. How to know setup is working": "12. Cách biết cấu hình đã hoạt động",
  "13. Common troubleshooting": "13. Lỗi thường gặp",
  "14. When to open the official Meta docs": "14. Khi nào cần mở tài liệu Meta chính thức",
  "1. What exists in LinhKienLed1000 today": "1. Hiện LinhKienLed1000 đã có gì",
  "2. Shopee prerequisites": "2. Điều kiện cần cho Shopee",
  "3. URLs to configure": "3. Các URL cần cấu hình",
  "4. Connection state labels used by this app": "4. Nhãn trạng thái kết nối trong app",
  "5. Understand Shopee values": "5. Hiểu các giá trị Shopee",
  "6. In-app steps": "6. Các bước trong app",
  "7. Runtime pieces implemented in this app": "7. Các phần runtime đã triển khai",
  "8. Target runtime flow after implementation": "8. Luồng runtime mục tiêu",
  "9. Testing checklist": "9. Checklist kiểm thử",
  "10. Troubleshooting": "10. Khắc phục lỗi",
  "11. Go-live gate": "11. Điều kiện go-live",
  "12. Shopee limitations": "12. Giới hạn Shopee",
  "1A. Current app status details": "1A. Chi tiết trạng thái hiện tại",
  "2. Prerequisites": "2. Điều kiện cần",
  "3A. TikTok Shop config fields": "3A. Các field cấu hình TikTok Shop",
  "4. In-app steps": "4. Các bước trong app",
  "5. Runtime flow target": "5. Luồng runtime mục tiêu",
  "6. Go-live gate": "6. Điều kiện go-live",
  "7. TikTok Shop expectation setting": "7. Kỳ vọng thực tế với TikTok Shop",
};

const phraseTranslations: [RegExp, string][] = [
  [/^Runtime status:/, "Trạng thái runtime:"],
  [/^Inbound support:/, "Hỗ trợ inbound:"],
  [/^Outbound support:/, "Hỗ trợ outbound:"],
  [/^Auth\/config support:/, "Hỗ trợ xác thực/cấu hình:"],
  [/^Needs real credential:/, "Cần credential thật:"],
  [/^Production readiness:/, "Mức sẵn sàng production:"],
  [/^Required config:/, "Cấu hình bắt buộc:"],
  [/^Optional /, "Tùy chọn "],
  [/^Confirm /, "Xác nhận "],
  [/^Configure /, "Cấu hình "],
  [/^Send /, "Gửi "],
  [/^Check /, "Kiểm tra "],
  [/^Do not /, "Không "],
  [/^If /, "Nếu "],
  [/^Use /, "Dùng "],
  [/^Add /, "Thêm "],
  [/^Save /, "Lưu "],
  [/^Authorize\/connect /, "Ủy quyền/kết nối "],
  [/^Verify /, "Xác minh "],
  [/^Start /, "Khởi động "],
  [/^Remember /, "Lưu ý "],
];

function translateText(text: string, language: DocsLanguage) {
  if (language === "en") return text;
  if (commonTextVi[text]) return commonTextVi[text];
  if (sectionNameVi[text]) return sectionNameVi[text];
  if (guideTitleVi[text]) return guideTitleVi[text];

  for (const [pattern, replacement] of phraseTranslations) {
    if (pattern.test(text)) return text.replace(pattern, replacement);
  }

  return text;
}

function useDocsUi(language: DocsLanguage) {
  return docsUiText[language];
}

// ---------------------------------------------------------------------------
// API Sections Data
// ---------------------------------------------------------------------------

const apiSections: ApiSection[] = [
  {
    id: "channel-readiness-matrix",
    name: "Channel Readiness Matrix",
    icon: Check,
    notes: [
      "This matrix is the high-level truth for lead/customer discussion. It separates implemented code from production readiness.",
      "Authorized is not the same as production-ready. Connected is not proof that a real customer can receive a bot reply.",
      "Any marketplace or social channel should pass a real end-to-end test before being called production-ready.",
    ],
    guideGroups: [
      {
        title: "Web widget / API",
        items: [
          "Runtime status: available through /api/chat and public widget/API flows.",
          "Inbound support: available for website/API/direct chat requests.",
          "Outbound support: internal response returned to caller; no external platform credential needed.",
          "Auth/config support: API key or app session depending on caller.",
          "Needs real credential: no platform credential needed beyond app deployment/auth.",
          "Production readiness: ready if deployment, AI provider, Knowledge Base, rate-limit, and monitoring are stable.",
        ],
      },
      {
        title: "Facebook Messenger",
        items: [
          "Runtime status: available in current Meta webhook/send flow.",
          "Inbound support: shared Meta webhook /api/webhooks/meta handles Facebook page messages.",
          "Outbound support: available through Meta send API when page token and permissions are valid.",
          "Auth/config support: verify token, page access token, page id, app secret, graph version.",
          "Needs real credential: Meta app, Facebook Page admin access, page token, webhook verification.",
          "Production readiness: near-ready after real Meta E2E, app review/permissions, signature verification, and no-secret logging checks.",
        ],
      },
      {
        title: "Instagram Direct Messaging",
        items: [
          "Runtime status: available via the shared Meta flow.",
          "Inbound support: shared Meta webhook /api/webhooks/meta handles Instagram messaging payloads.",
          "Outbound support: available when Instagram access token, permissions, and account eligibility are valid.",
          "Auth/config support: verify token, Instagram access token, business/account id, app secret, graph version.",
          "Needs real credential: Instagram Business/Creator account, Meta app permissions, Instagram messaging access.",
          "Production readiness: near-ready after real Instagram E2E and Meta review/permission checks.",
        ],
      },
      {
        title: "Zalo Python relay",
        items: [
          "Runtime status: available through Python relay/session-cookie style integration.",
          "Inbound support: /api/channels/zalo/incoming accepts relay payloads and scopes messages by account when accountId is present.",
          "Outbound support: available through the relay/send helpers when the session is valid.",
          "Auth/config support: cookies/session input, optional relaySecret, python command, script path, account/OA id.",
          "Needs real credential: valid Zalo session/cookies and relay runtime; relaySecret is recommended for production safety.",
          "Production readiness: fallback/demo/current operational mode, not an official Zalo OA API integration.",
        ],
      },
      {
        title: "Zalo Official OA",
        items: [
          "Runtime status: planned/config-ready only; official OA adapter is not implemented in the current product flow.",
          "Inbound support: not implemented for official OA API.",
          "Outbound support: not implemented for official OA API.",
          "Auth/config support: should be designed separately if the team chooses official OA.",
          "Needs real credential: official OA credentials and approval from Zalo.",
          "Production readiness: future phase, not current runtime.",
        ],
      },
      {
        title: "Shopee",
        items: [
          "Runtime status: pre-E2E ready with account config, auth start/callback, token helper, webhook receiver, normalized inbound, and send adapter scaffold.",
          "Inbound support: /api/webhooks/shopee parses supported buyer text events and hands them to the normalized flow.",
          "Outbound support: send adapter exists but must be verified with a real Shopee Partner App/shop and approved chat scope.",
          "Auth/config support: Partner ID, Partner Key, shop authorization callback, access token, refresh token, webhook secret.",
          "Needs real credential: legitimate Shopee Seller account and Shopee Open Platform Partner App.",
          "Production readiness: not ready until real Seller/Partner E2E passes auth, webhook, receive, send, token refresh, idempotency, and fallback checks.",
        ],
      },
      {
        title: "TikTok Shop",
        items: [
          "Runtime status: pre-E2E inbound scaffold.",
          "Inbound support: /api/webhooks/tiktok-shop accepts customer-service style message payloads and maps text into normalized inbound flow.",
          "Outbound support: not finalized; send-message endpoint/scope must be verified in TikTok Shop Partner Center.",
          "Auth/config support: account config and secret masking exist; OAuth/callback contract is not finalized.",
          "Needs real credential: legitimate TikTok Shop Seller account plus Partner Center/Open Platform app.",
          "Production readiness: no. It requires Partner Center contract verification, real webhook payload, send-message API, token refresh, idempotency, and E2E buyer chat test.",
        ],
      },
      {
        title: "WhatsApp",
        items: [
          "Runtime status: available in current implementation through whatsapp-web.js / WhatsApp Web style runtime.",
          "Inbound support: available when the local WhatsApp client is connected and message events are received.",
          "Outbound support: available through the current WhatsApp client send helper.",
          "Auth/config support: QR/session based current flow; Cloud API multi-account is not the current implementation.",
          "Needs real credential: phone/session/QR connection and stable runtime host.",
          "Production readiness: partial; depends on session stability and should be reassessed before customer go-live.",
        ],
      },
      {
        title: "Email",
        items: [
          "Runtime status: available for SMTP/IMAP style configuration in current implementation.",
          "Inbound support: depends on configured mailbox polling/IMAP flow in environment.",
          "Outbound support: available through SMTP send helper when settings are valid.",
          "Auth/config support: SMTP/IMAP host, ports, user, password/from address.",
          "Needs real credential: customer mailbox credentials or app password.",
          "Production readiness: available after real mailbox send/receive test and spam/deliverability review.",
        ],
      },
      {
        title: "Phone / Twilio voice",
        items: [
          "Runtime status: available if Twilio settings are configured.",
          "Inbound support: /api/channels/phone/incoming and gather/status routes support Twilio voice flow.",
          "Outbound support: voice response/TwiML path exists; full call operations depend on Twilio credentials and phone number.",
          "Auth/config support: Twilio SID, token, phone number, callback URLs, optional voice provider settings.",
          "Needs real credential: Twilio account, phone number, webhook URLs, valid signatures.",
          "Production readiness: available after real call E2E, signature verification, and fallback handling.",
        ],
      },
      {
        title: "SMS / Twilio",
        items: [
          "Runtime status: available if Twilio SMS settings are configured.",
          "Inbound support: /api/channels/sms maps inbound SMS into normalized inbound flow.",
          "Outbound support: TwiML response path and Twilio send helper are available when configured.",
          "Auth/config support: Twilio SID, token, phone number, webhook signature validation.",
          "Needs real credential: Twilio account, SMS-capable number, public webhook URL.",
          "Production readiness: available after real SMS send/receive E2E and opt-in/compliance review.",
        ],
      },
      {
        title: "Telegram",
        items: [
          "Runtime status: available for bot webhook style text messages.",
          "Inbound support: /api/channels/telegram maps text messages into normalized inbound flow.",
          "Outbound support: Bot API sendMessage is used when bot token is configured.",
          "Auth/config support: Telegram bot token and webhook registration.",
          "Needs real credential: Telegram bot token and public webhook URL.",
          "Production readiness: available after real bot E2E and webhook delivery/retry review.",
        ],
      },
    ],
    endpoints: [],
  },
  {
    id: "connection-status-definitions",
    name: "Connection Status Definitions",
    icon: Key,
    notes: [
      "These labels describe integration progress, not business approval. A channel can be authorized but still not ready for real customers.",
      "Authorized != production-ready. Connected != bot has replied successfully on the external platform.",
    ],
    guideGroups: [
      {
        title: "Status meanings",
        items: [
          "config_saved: configuration was saved, but authorization and real webhook/chat verification have not finished.",
          "authorization_required: an admin must open the platform authorization/approval screen and grant access.",
          "authorized: token/account/shop/page id exists, but webhook receive and outbound send are not proven yet.",
          "webhook_pending: webhook is expected but no valid real webhook has been accepted yet.",
          "webhook_verified: a valid webhook request reached the app and passed parsing/signature checks.",
          "chat_receive_verified: a real or accepted test customer message was parsed and entered the normalized inbound flow.",
          "chat_send_verified: the app successfully delivered a reply back to the external platform.",
          "production_ready: only use after auth, webhook, receive, send, token refresh, idempotency, rate-limit/backoff, monitoring, and human fallback are verified.",
          "error: account or channel needs operator review; do not treat it as connected.",
        ],
      },
      {
        title: "Operator rules",
        items: [
          "Do not promise production readiness from config_saved or authorized alone.",
          "Do not mark Shopee/TikTok Shop production-ready without a real Seller/Partner Center E2E test.",
          "Do not store raw webhook payloads, raw buyer messages, tokens, signatures, or keys in debug metadata.",
          "When in doubt, show the current stage and the next missing verification step instead of saying connected.",
        ],
      },
    ],
    endpoints: [],
  },
  {
    id: "user-guide-vi",
    name: "Hướng Dẫn Sử Dụng",
    icon: BookOpen,
    notes: [
      "Mục này dành cho người vận hành nội bộ hoặc lead bàn giao. Các phần API reference bên dưới vẫn giữ cấu trúc kỹ thuật để dev tích hợp.",
      "Không dán token, app secret, partner key, cookie, refresh token hoặc API key vào ảnh chụp màn hình, chat nhóm, ticket công khai hoặc tài liệu bàn giao không bảo mật.",
      "Cấu hình đã lưu không đồng nghĩa với production-ready. Mỗi kênh phải qua kiểm thử E2E thật trước khi mở cho khách hàng thật.",
    ],
    guideGroups: [
      {
        title: "1. Dữ liệu đăng nhập và API được lưu ở đâu",
        items: [
          "AI/Gemini API key: lưu trong bảng Settings.aiApiKey và được cấu hình tại Cài đặt -> Cấu hình AI.",
          "Email/Twilio/WhatsApp mặc định: lưu trong bảng Settings hoặc Channel.config tùy luồng hiện tại.",
          "Facebook Page, Instagram Business, Zalo account, Shopee shop, TikTok Shop: lưu theo từng tài khoản trong bảng ChannelAccount.config.",
          "API key để hệ thống khác gọi vào app: lưu trong bảng ApiKey và quản lý tại Admin -> API keys.",
          "Hội thoại phát sinh từ nhiều page/shop/OA được gắn Conversation.channelAccountId để biết khách đến từ tài khoản nào.",
        ],
      },
      {
        title: "2. Nguyên tắc bảo mật khi cấu hình",
        items: [
          "Secret được lưu server-side và khi trả về UI chỉ hiện cờ hasAccessToken, hasAppSecret, hasWebhookSecret hoặc hasCookiesInput.",
          "Khi sửa account, để trống ô secret nếu muốn giữ secret cũ; hệ thống sẽ preserve secret hiện có.",
          "Webhook production phải có secret/signature: Meta app secret, Shopee/TikTok webhook secret hoặc partner/app secret, Twilio auth token, Zalo relay secret.",
          "Nếu lộ token hoặc secret, phải revoke/rotate trên nền tảng gốc trước, sau đó cập nhật lại trong LinhKienLed1000.",
          "Hiện tại secret được lưu trong database; chưa có lớp mã hóa-at-rest riêng cho JSON config. Vì vậy quyền truy cập database phải được kiểm soát chặt.",
        ],
      },
      {
        title: "3. Quy trình thêm kênh mới",
        items: [
          "Vào Kênh liên hệ để xem tổng quan trạng thái các kênh.",
          "Vào Kênh liên hệ -> Tài khoản kết nối để thêm Facebook Page, Instagram, Zalo, Shopee hoặc TikTok Shop.",
          "Nhập tên hiển thị rõ ràng, ví dụ LED1000 Facebook HCM hoặc LED1000 Shopee Official, để nhân viên nhận biết nguồn hội thoại.",
          "Lưu cấu hình trước, sau đó bấm Kết nối hoặc Ủy quyền shop nếu nền tảng yêu cầu OAuth/approval.",
          "Chỉ xem là sẵn sàng khi trạng thái đã qua webhook receive, chat receive, chat send và nhân viên xác nhận thấy tin nhắn thật trên nền tảng.",
        ],
      },
      {
        title: "4. Quy trình nạp dữ liệu cho chatbot",
        items: [
          "Vào Kho kiến thức để tạo danh mục như Hồ sơ doanh nghiệp, Bảng giá, Tồn kho, Chính sách bảo hành, VAT, Catalogue, Tư vấn kỹ thuật.",
          "Upload file của khách vào đúng danh mục. Với file phức tạp như PDF scan, bảng giá nhiều sheet hoặc catalogue có ảnh, dùng chế độ đọc bằng Gemini và review preview trước khi import.",
          "Không dùng dữ liệu mock/demo để báo giá thật. Dữ liệu crawl website hoặc mock chỉ dùng test pipeline.",
          "Sau khi import, hỏi thử các câu về sản phẩm, giá, tồn kho, bảo hành, VAT và tình huống ngoài ngành để kiểm tra RAG không bịa.",
          "Nếu bot báo chưa có dữ liệu, cần bổ sung file chính thức thay vì sửa prompt để ép bot trả lời.",
        ],
      },
      {
        title: "5. Kiểm thử trước khi bàn giao",
        items: [
          "Test chatbot nội bộ qua /api/chat hoặc widget để chắc AI key, model fallback và Knowledge Base hoạt động.",
          "Test từng kênh thật: khách gửi tin -> app tạo hội thoại -> AI hoặc nhân viên trả lời -> khách nhận được tin trên nền tảng.",
          "Test tạo/chuyển ticket khi khách cần báo giá chính thức, kiểm tồn kho, VAT, công trình hoặc hỗ trợ nhân viên.",
          "Kiểm tra trang Hội thoại hiển thị đúng nền tảng, tên tài khoản kết nối, mã khách và trạng thái xử lý.",
          "Kiểm tra Go-live/Channel readiness: không đánh dấu production-ready nếu chưa có seller/page/app thật và webhook/send thật.",
        ],
      },
      {
        title: "6. Câu trả lời ngắn cho lead/khách",
        items: [
          "Thông tin login account và API key đã được lưu trong database theo Settings, Channel, ChannelAccount hoặc ApiKey tùy loại.",
          "Các secret không trả raw về UI; UI chỉ hiện trạng thái đã có/chưa có secret.",
          "Facebook/Instagram/Zalo/Shopee/TikTok Shop dùng mô hình nhiều tài khoản, mỗi page/shop/OA là một ChannelAccount riêng.",
          "Shopee đã có scaffold auth/webhook/send nhưng vẫn cần Seller/Partner App thật để xác minh E2E.",
          "TikTok Shop đã có account storage và inbound webhook scaffold; outbound send còn chờ xác minh contract trong Partner Center.",
        ],
      },
    ],
    endpoints: [],
  },
  {
    id: "real-e2e-testing-checklist",
    name: "Real E2E Testing Checklist",
    icon: Webhook,
    notes: [
      "Use this checklist when lead/customer provides real platform credentials. It is intentionally platform-neutral first, then platform-specific.",
      "The goal is to prove the full path: platform customer message -> webhook/inbound -> conversation -> AI response -> outbound reply -> safe logs/fallback.",
    ],
    guideGroups: [
      {
        title: "General E2E checklist",
        items: [
          "Confirm the platform account exists and belongs to the customer.",
          "Confirm developer/partner app exists and is approved enough for the tested feature.",
          "Confirm callback/webhook uses a public HTTPS URL, not localhost.",
          "Add the ChannelAccount or channel config in LinhKienLed1000.",
          "Save config and verify secrets are masked in UI/API responses.",
          "Authorize/connect where the platform supports OAuth or shop/page approval.",
          "Configure webhook URL in the platform console.",
          "Send a real user/customer message from the platform.",
          "Confirm safe webhook debug metadata updates without raw message text or secrets.",
          "Confirm a conversation is created with correct channel and channelAccountId where applicable.",
          "Confirm bot response is generated from the correct Knowledge Base context.",
          "Confirm outbound reply is delivered back to the platform.",
          "Confirm no secret/token/signature/raw buyer PII appears in UI, logs, or screenshots.",
          "Confirm retry/idempotency behavior does not duplicate replies.",
          "Confirm token refresh or credential rotation behavior before go-live.",
        ],
      },
      {
        title: "Meta E2E",
        items: [
          "Verify /api/webhooks/meta with Meta's hub.challenge flow.",
          "Send a Facebook Page message and confirm channel=facebook conversation plus outbound reply.",
          "Send an Instagram DM and confirm channel=instagram conversation plus outbound reply.",
          "Check x-hub-signature-256 verification when appSecret is configured.",
          "Confirm Meta app mode, app review, page/account permissions, and token lifetime for production users.",
        ],
      },
      {
        title: "Zalo E2E",
        items: [
          "Start the Python relay with valid session/cookies for the intended Zalo account.",
          "Configure relaySecret and verify the relay sends x-zalo-relay-secret.",
          "Send a real Zalo message and confirm /api/channels/zalo/incoming receives account-scoped payload.",
          "Confirm conversation channel=zalo and outbound relay reply works.",
          "Remember this is the Python relay/session-cookie path, not official OA API.",
        ],
      },
      {
        title: "Shopee E2E",
        items: [
          "Use a legitimate Shopee Seller account and Open Platform Partner App.",
          "Save Partner ID/Partner Key in Channels -> Accounts -> Shopee.",
          "Open auth start /api/channels/shopee/auth/start?accountId=<channelAccountId> through the app, not by manually calling callback.",
          "Approve the app in Shopee and verify callback stores tokens with status=authorized.",
          "Configure webhook to /api/webhooks/shopee and send a buyer chat message.",
          "Confirm webhook_verified, chat_receive_verified, and chat_send_verified before any production claim.",
        ],
      },
      {
        title: "TikTok Shop E2E",
        items: [
          "Use a legitimate TikTok Shop Seller account and Partner Center/Open Platform app.",
          "Confirm Customer Service/Conversation/Message scopes and exact OAuth/webhook/signature/send-message contract in Partner Center.",
          "Save Shop/Seller ID, App/Client key, App secret, tokens, and webhookSecret when available.",
          "Configure webhook to /api/webhooks/tiktok-shop if Partner Center allows it.",
          "Send/capture a real customer-service message payload and confirm safe debug metadata plus normalized conversation creation.",
          "Only complete outbound reply after send-message endpoint/scope are verified with the real Partner Center app.",
        ],
      },
    ],
    endpoints: [],
  },
  {
    id: "platform-bypass-limits",
    name: "What This App Cannot Bypass",
    icon: BookOpen,
    notes: [
      "This section is for expectation-setting with lead/customer. The app can store config and process messages, but it cannot override platform rules.",
    ],
    guideGroups: [
      {
        title: "Hard platform limits",
        items: [
          "The app cannot create a Seller shop, Facebook Page, Instagram account, Zalo account, or Telegram bot on behalf of the customer.",
          "The app cannot bypass seller verification, tax verification, bank verification, identity checks, or business verification required by Shopee, TikTok Shop, Meta, Zalo, Twilio, or any provider.",
          "The app cannot bypass Meta app review, TikTok Shop Partner Center approval, Shopee Open Platform approval, or Zalo official API approval.",
          "The app cannot grant API scopes that the platform has not approved for the customer app/account.",
          "The app cannot guarantee gated Partner Console endpoints work until a real approved app/account is used.",
          "The app should not store raw payloads, raw buyer messages, raw tokens, raw signatures, app secrets, partner keys, or refresh tokens in visible debug metadata.",
          "The app cannot guarantee price, stock, VAT, or warranty accuracy unless the customer uploads verified Knowledge Base data for those topics.",
        ],
      },
    ],
    endpoints: [],
  },
  {
    id: "lead-handoff-message",
    name: "Suggested Handoff Message",
    icon: Users,
    notes: [
      "Copy this when reporting status to lead/customer. Adjust platform names depending on what credentials the customer is ready to provide.",
    ],
    guideGroups: [
      {
        title: "Vietnamese handoff message",
        items: [
          "Em đã hoàn thiện phần nền tảng multi-channel/multi-account ở mức pre-E2E. Facebook/Instagram/Zalo relay có runtime hiện tại; Shopee đã có auth/callback/webhook/send scaffold; TikTok Shop đã có config + webhook inbound + normalized flow nhưng cần Partner Center thật để xác minh OAuth/send-message contract. Bước tiếp theo cần account/app thật để test E2E từng nền tảng trước khi gọi production-ready.",
        ],
      },
      {
        title: "Short technical summary",
        items: [
          "Implemented: account config, secret masking, normalized inbound, webhook routes for supported flows, Shopee/TikTok docs and tests.",
          "Not yet production claim: marketplace OAuth/send contracts that require real Partner/Seller console access.",
          "Next action: collect real credentials, configure public HTTPS callback/webhook URLs, run platform-specific E2E tests, then mark only verified channels as production_ready.",
        ],
      },
    ],
    endpoints: [],
  },
  {
    id: "chat",
    name: "Chat",
    icon: MessageSquare,
    endpoints: [
      {
        method: "POST",
        path: "/api/chat",
        description:
          "Send a message and get an AI-generated response. The AI uses your knowledge base and conversation history to generate relevant answers.",
        requestBody: {
          message: "How do I reset my password?",
          conversationId: "conv_abc123",
          channel: "web",
          customerName: "John Doe",
        },
        responseExample: {
          reply: "To reset your password, go to Settings > Security and click 'Reset Password'...",
          conversationId: "conv_abc123",
          messageId: "msg_xyz789",
        },
        params: [],
      },
    ],
  },
  {
    id: "conversations",
    name: "Conversations",
    icon: MessagesSquare,
    endpoints: [
      {
        method: "GET",
        path: "/api/conversations",
        description: "List all conversations with optional filtering by status or channel.",
        responseExample: [
          {
            id: "conv_abc123",
            channel: "web",
            customerName: "John Doe",
            status: "active",
            createdAt: "2026-04-01T10:00:00Z",
          },
        ],
        queryParams: [
          {
            name: "status",
            type: "string",
            required: false,
            description: "Filter by status: active, closed, archived",
          },
          {
            name: "channel",
            type: "string",
            required: false,
            description: "Filter by channel: web, whatsapp, email, phone",
          },
        ],
      },
      {
        method: "POST",
        path: "/api/conversations",
        description: "Create a new conversation.",
        requestBody: {
          channel: "web",
          customerName: "Jane Smith",
          customerContact: "jane@example.com",
        },
        responseExample: {
          id: "conv_def456",
          channel: "web",
          customerName: "Jane Smith",
          status: "active",
          createdAt: "2026-04-01T10:00:00Z",
        },
      },
      {
        method: "GET",
        path: "/api/conversations/:id",
        description: "Get a specific conversation with its messages.",
        responseExample: {
          id: "conv_abc123",
          channel: "web",
          customerName: "John Doe",
          status: "active",
          messages: [
            { id: "msg_1", role: "user", content: "Hello", createdAt: "2026-04-01T10:00:00Z" },
            {
              id: "msg_2",
              role: "assistant",
              content: "Hi! How can I help?",
              createdAt: "2026-04-01T10:00:01Z",
            },
          ],
        },
        params: [{ name: "id", type: "string", required: true, description: "Conversation ID" }],
      },
      {
        method: "PUT",
        path: "/api/conversations/:id",
        description: "Update a conversation's status, customer info, or metadata.",
        requestBody: {
          status: "closed",
          satisfaction: 5,
          summary: "Customer asked about password reset.",
        },
        responseExample: {
          id: "conv_abc123",
          status: "closed",
          satisfaction: 5,
          updatedAt: "2026-04-01T12:00:00Z",
        },
        params: [{ name: "id", type: "string", required: true, description: "Conversation ID" }],
      },
      {
        method: "DELETE",
        path: "/api/conversations/:id",
        description: "Delete a conversation and all its messages.",
        responseExample: { ok: true },
        params: [{ name: "id", type: "string", required: true, description: "Conversation ID" }],
      },
      {
        method: "POST",
        path: "/api/conversations/:id/messages",
        description: "Add a message to an existing conversation.",
        requestBody: {
          role: "user",
          content: "I need help with billing",
        },
        responseExample: {
          id: "msg_new123",
          conversationId: "conv_abc123",
          role: "user",
          content: "I need help with billing",
          createdAt: "2026-04-01T10:05:00Z",
        },
        params: [{ name: "id", type: "string", required: true, description: "Conversation ID" }],
      },
    ],
  },
  {
    id: "tickets",
    name: "Tickets",
    icon: Ticket,
    endpoints: [
      {
        method: "GET",
        path: "/api/tickets",
        description: "List all tickets with optional filtering.",
        responseExample: [
          {
            id: "tkt_abc123",
            title: "Login issue",
            status: "open",
            priority: "high",
            createdAt: "2026-04-01T10:00:00Z",
          },
        ],
        queryParams: [
          {
            name: "status",
            type: "string",
            required: false,
            description: "Filter by status: open, in_progress, resolved, closed",
          },
          {
            name: "priority",
            type: "string",
            required: false,
            description: "Filter by priority: low, medium, high, urgent",
          },
        ],
      },
      {
        method: "POST",
        path: "/api/tickets",
        description: "Create a new support ticket.",
        requestBody: {
          title: "Cannot access dashboard",
          description: "User reports 403 error when accessing the main dashboard.",
          priority: "high",
          departmentId: "dept_abc",
        },
        responseExample: {
          id: "tkt_new456",
          title: "Cannot access dashboard",
          status: "open",
          priority: "high",
          createdAt: "2026-04-01T10:00:00Z",
        },
      },
      {
        method: "GET",
        path: "/api/tickets/:id",
        description: "Get a specific ticket with related conversation and assignment details.",
        responseExample: {
          id: "tkt_abc123",
          title: "Login issue",
          status: "open",
          priority: "high",
          department: { id: "dept_1", name: "Engineering" },
          assignedTo: { id: "mem_1", name: "Alice" },
        },
        params: [{ name: "id", type: "string", required: true, description: "Ticket ID" }],
      },
      {
        method: "PUT",
        path: "/api/tickets/:id",
        description: "Update a ticket's status, priority, assignment, or resolution.",
        requestBody: {
          status: "resolved",
          resolution: "Fixed permission configuration for the user.",
        },
        responseExample: {
          id: "tkt_abc123",
          status: "resolved",
          resolution: "Fixed permission configuration for the user.",
          updatedAt: "2026-04-01T12:00:00Z",
        },
        params: [{ name: "id", type: "string", required: true, description: "Ticket ID" }],
      },
      {
        method: "DELETE",
        path: "/api/tickets/:id",
        description: "Delete a ticket permanently.",
        responseExample: { ok: true },
        params: [{ name: "id", type: "string", required: true, description: "Ticket ID" }],
      },
    ],
  },
  {
    id: "knowledge",
    name: "Knowledge Base",
    icon: BookOpen,
    endpoints: [
      {
        method: "GET",
        path: "/api/knowledge/categories",
        description: "List all knowledge base categories with entry counts.",
        responseExample: [
          { id: "cat_1", name: "FAQ", description: "Frequently asked questions", entryCount: 12 },
        ],
      },
      {
        method: "POST",
        path: "/api/knowledge/categories",
        description: "Create a new knowledge base category.",
        requestBody: {
          name: "Troubleshooting",
          description: "Common troubleshooting guides",
          icon: "wrench",
          color: "#E67E22",
        },
        responseExample: {
          id: "cat_new1",
          name: "Troubleshooting",
          description: "Common troubleshooting guides",
          createdAt: "2026-04-01T10:00:00Z",
        },
      },
      {
        method: "GET",
        path: "/api/knowledge/entries",
        description: "List knowledge base entries, optionally filtered by category.",
        responseExample: [
          {
            id: "entry_1",
            title: "How to reset password",
            content: "Go to Settings > Security...",
            categoryId: "cat_1",
            isActive: true,
          },
        ],
        queryParams: [
          {
            name: "categoryId",
            type: "string",
            required: false,
            description: "Filter by category ID",
          },
        ],
      },
      {
        method: "POST",
        path: "/api/knowledge/entries",
        description: "Create a new knowledge base entry.",
        requestBody: {
          categoryId: "cat_1",
          title: "How to update billing info",
          content: "Navigate to Account > Billing and click 'Update Payment Method'...",
          priority: 1,
        },
        responseExample: {
          id: "entry_new1",
          title: "How to update billing info",
          categoryId: "cat_1",
          isActive: true,
          createdAt: "2026-04-01T10:00:00Z",
        },
      },
    ],
  },
  {
    id: "settings",
    name: "Settings",
    icon: Users,
    endpoints: [
      {
        method: "GET",
        path: "/api/settings",
        description: "Get the current application settings.",
        responseExample: {
          businessName: "LED1000 / Linh Kiện LED1000",
          welcomeMessage:
            "Xin chào! LED1000 có thể hỗ trợ bạn tìm đèn LED, nguồn điện, linh kiện hoặc phụ kiện phù hợp.",
          tone: "friendly",
          aiProvider: "gemini",
          aiModel: "gemini-2.5-flash",
        },
      },
      {
        method: "PUT",
        path: "/api/settings",
        description: "Update application settings. Only include the fields you want to change.",
        requestBody: {
          businessName: "Acme Support",
          welcomeMessage: "Welcome to Acme! How can we assist you?",
          tone: "professional",
        },
        responseExample: {
          businessName: "Acme Support",
          welcomeMessage: "Welcome to Acme! How can we assist you?",
          tone: "professional",
          updatedAt: "2026-04-01T12:00:00Z",
        },
      },
    ],
  },
  {
    id: "webhooks",
    name: "Webhooks",
    icon: Webhook,
    endpoints: [
      {
        method: "GET",
        path: "/api/webhooks",
        description: "List all configured webhooks.",
        responseExample: [
          {
            id: "wh_abc123",
            name: "Slack notifications",
            url: "https://hooks.slack.com/services/...",
            method: "POST",
            triggerOn: "ticket_created",
            isActive: true,
          },
        ],
      },
      {
        method: "POST",
        path: "/api/webhooks",
        description: "Create a new webhook.",
        requestBody: {
          name: "Slack notification",
          url: "https://hooks.slack.com/services/T00/B00/xxx",
          method: "POST",
          headers: { "Content-Type": "application/json" },
          triggerOn: "ticket_created",
        },
        responseExample: {
          id: "wh_new456",
          name: "Slack notification",
          url: "https://hooks.slack.com/services/T00/B00/xxx",
          triggerOn: "ticket_created",
          isActive: true,
          createdAt: "2026-04-01T10:00:00Z",
        },
      },
    ],
  },
  {
    id: "meta-setup-guide",
    name: "Meta Setup Guide",
    icon: Key,
    notes: [
      "This guide is for admins or customers who need to connect Facebook Messenger and Instagram Direct Messaging for the first time.",
      "Both Facebook and Instagram use the same callback URL in LinhKienLed1000: <APP_ORIGIN>/api/webhooks/meta.",
      "Use this guide to understand what each key/token is, where it comes from, and where to paste it in Channels -> Accounts.",
      "Meta Dashboard screens may change. Use the official Meta docs links as the source of truth for exact button names and review requirements.",
      "Never paste real access tokens or app secrets into chat, screenshots, public docs, logs, or Git commits.",
    ],
    guideGroups: [
      {
        title: "1. Before you start",
        items: [
          "Confirm the business has a Facebook Page for Messenger. A personal Facebook profile is not enough for this integration.",
          "Confirm the business has an Instagram Business or Creator account for Instagram Direct Messaging.",
          "Make sure the person doing setup has admin/manage access to the Meta App, Facebook Page, and Instagram account.",
          "Prepare the public app URL. In production this is the customer domain; in local testing use a public HTTPS tunnel such as ngrok.",
          "Decide one Verify Token string, for example led1000-meta-verify-token. This is not provided by Meta; you create it and paste the same value into LinhKienLed1000 and Meta Dashboard.",
          "Facebook and Instagram can use the same Verify Token for simplicity, or separate Verify Tokens if configured separately. The value entered in Meta Dashboard must match the value saved in the corresponding LinhKienLed1000 channel settings.",
          "Keep Page Access Token, Instagram Access Token, and App Secret private. Do not send real values in chat, screenshots, public docs, or commits.",
        ],
      },
      {
        title: "2. Understand what each Meta value means",
        items: [
          "Meta Developer App: the container in developers.facebook.com where products, webhook callback, app secret, and permissions are configured.",
          "Facebook Page: the public page customers message through Messenger. It is different from the Meta Developer App.",
          "Instagram Business or Creator Account: the Instagram account customers message through Direct Messaging.",
          "Callback URL: the LinhKienLed1000 webhook URL Meta calls. Use <APP_ORIGIN>/api/webhooks/meta for both Facebook and Instagram.",
          "Verify Token: a shared text value used only when Meta verifies the callback URL. LinhKienLed1000 checks hub.verify_token against this value.",
          "Access Token: the secret credential LinhKienLed1000 uses to send replies back to Facebook or Instagram.",
          "App Secret: the Meta App secret used to validate x-hub-signature-256 on webhook POST requests.",
          "Graph Version: the Meta Graph API version used for send/config calls, for example v25.0.",
        ],
      },
      {
        title: "3. Where to paste in LinhKienLed1000",
        items: [
          "Channels -> Accounts -> Facebook -> Verify Token.",
          "Channels -> Accounts -> Facebook -> Page Access Token.",
          "Channels -> Accounts -> Facebook -> Page ID, optional.",
          "Channels -> Accounts -> Facebook -> Graph Version.",
          "Channels -> Accounts -> Facebook -> App Secret, required for production webhook signature checks.",
          "Channels -> Accounts -> Instagram -> Verify Token.",
          "Channels -> Accounts -> Instagram -> Access Token.",
          "Channels -> Accounts -> Instagram -> Business Account ID, optional.",
          "Channels -> Accounts -> Instagram -> Graph Version.",
          "Channels -> Accounts -> Instagram -> App Secret, required for production webhook signature checks.",
        ],
      },
      {
        title: "4. Create or choose the Meta Developer App",
        items: [
          "Open Meta for Developers, then open Apps. If the customer already has a Meta App, use that app instead of creating a duplicate.",
          "Create an app only if there is no suitable existing app for this business.",
          "Inside the app, add or configure the Messenger product for Facebook Messenger.",
          "Inside the same app, add or configure the Instagram product/API flow for Instagram Direct Messaging.",
          "Open App settings and copy the App Secret only if LinhKienLed1000 will verify webhook signatures in this environment.",
          "Do not confuse App ID with Page ID. App ID identifies the Meta Developer App; Page ID identifies the Facebook Page.",
        ],
      },
      {
        title: "5. Prepare the Facebook Page",
        items: [
          "Create or choose the Facebook Page that customers will message.",
          "Confirm the setup user can manage the Page in Meta/Facebook business tools.",
          "If the Page is new, finish basic Page setup first: name, category, contact info, and Messenger availability.",
          "In Meta Dashboard, select this Page when configuring the Messenger product.",
          "Optional Page ID can be copied from Page settings or looked up with Graph API after you have a Page Access Token.",
        ],
      },
      {
        title: "6. Get the Facebook Page Access Token",
        items: [
          "In the Meta Developer App, open the Messenger or Messenger API setup area.",
          "Select the Facebook Page that LinhKienLed1000 should reply from.",
          "Generate or copy the Page Access Token for that Page.",
          "Paste it into LinhKienLed1000 Channels -> Accounts -> Facebook -> Page Access Token.",
          "Optional Page ID lookup: call https://graph.facebook.com/v25.0/me?fields=id,name&access_token=YOUR_FACEBOOK_PAGE_ACCESS_TOKEN and use the returned id.",
          "If the token later returns 401 or 403, regenerate it or check permissions/app mode/review in Meta Dashboard.",
        ],
      },
      {
        title: "7. Configure Facebook Messenger webhook",
        items: [
          "In LinhKienLed1000 Channels -> Accounts -> Facebook, add or edit the Page account and fill Verify Token, Page Access Token, Graph Version, optional Page ID, and App Secret.",
          "Save the Facebook account config before testing Meta verification.",
          "In Meta Dashboard webhook settings, set Callback URL to <APP_ORIGIN>/api/webhooks/meta.",
          "Set Verify Token in Meta Dashboard to exactly the same value saved in LinhKienLed1000.",
          "Subscribe the Facebook Page/webhook to the Messenger message events required by the app.",
          "Send a real message to the Facebook Page and confirm LinhKienLed1000 creates a conversation with channel=facebook.",
        ],
      },
      {
        title: "8. Prepare the Instagram account",
        items: [
          "Use an Instagram Business or Creator account according to Meta's current requirements.",
          "Confirm the setup user can manage the Instagram account and any related business assets required by Meta.",
          "Use Instagram API with Instagram Login / Direct Messaging. Instagram Basic Display API is not enough for chatbot messaging.",
          "If the account is new or not eligible, complete Meta's account/business setup first before connecting LinhKienLed1000.",
          "Do not reuse a Facebook Page Access Token as the Instagram Access Token for this direct Instagram flow.",
        ],
      },
      {
        title: "9. Get the Instagram Access Token",
        items: [
          "In the Meta Developer App, open the Instagram API with Instagram Login setup flow.",
          "Configure the app/account according to Meta's Instagram Direct Messaging requirements.",
          "Complete the authorization/login step for the Instagram account that should receive messages.",
          "Copy the Instagram Access Token produced by that flow.",
          "Paste it into LinhKienLed1000 Channels -> Accounts -> Instagram -> Access Token.",
          "Optional Business Account ID is metadata for checking/debugging. Webhook recipient.id can also help confirm which Instagram account received a message.",
        ],
      },
      {
        title: "10. Configure Instagram Direct Messaging webhook",
        items: [
          "In LinhKienLed1000 Channels -> Accounts -> Instagram, add or edit the Business account and fill Verify Token, Access Token, Graph Version, optional Business Account ID, and App Secret.",
          "Save the Instagram account config before testing Meta verification.",
          "In Meta Dashboard webhook settings, use the same shared callback URL: <APP_ORIGIN>/api/webhooks/meta.",
          "Set Verify Token in Meta Dashboard to exactly the same value saved in LinhKienLed1000.",
          "Subscribe the required Instagram messaging/webhook events in Meta Dashboard.",
          "Send a real DM to the Instagram account and confirm LinhKienLed1000 creates a conversation with channel=instagram.",
        ],
      },
      {
        title: "11. Production note",
        items: [
          "In development mode, only admins, developers, or testers may be able to interact with the Meta App.",
          "If internal testers can send messages but real customers cannot, check Meta App Review, required permissions, app mode, and business verification requirements.",
          "Before going live for a customer, review the official Meta docs for the current permission and review requirements for Messenger and Instagram Direct Messaging.",
          "Do not treat a successful local webhook test as full production approval. It only proves LinhKienLed1000 can receive the payload shape.",
        ],
      },
      {
        title: "12. How to know setup is working",
        items: [
          "Meta webhook verification succeeds when Meta sends hub.mode=subscribe and LinhKienLed1000 returns hub.challenge as plain text.",
          "Facebook test succeeds when a Messenger message creates or updates a conversation with channel=facebook.",
          "Instagram test succeeds when an Instagram DM creates or updates a conversation with channel=instagram.",
          "Channel config checks should show hasPageAccessToken/hasAccessToken and hasAppSecret without exposing raw secret values.",
          "If AI reply is not sent, check both channel delivery config and the AI provider/API key config. Webhook receive and chatbot reply are two separate steps.",
        ],
      },
      {
        title: "13. Common troubleshooting",
        items: [
          "Webhook verify fails: check callback URL, public HTTPS access, exact Verify Token match, and whether the app server is running.",
          "Webhook receives Facebook payload in Instagram docs: use only the shared webhook Try it endpoint; platform examples are documentation-only examples.",
          "Bot does not reply: check the access token, channel config, AI provider/API key, and server logs.",
          "401 or 403 from Meta: token may be expired, missing permission, blocked by app mode/review, or tied to the wrong account/page.",
          "Facebook Page ID is empty: acceptable if the Page Access Token works with /me/messages.",
          "Instagram token does not work: confirm it is from the Instagram API with Instagram Login / Direct Messaging flow, not Basic Display API.",
          "If any token is exposed, rotate or revoke it in Meta Developer Dashboard and update the matching LinhKienLed1000 account in Channels -> Accounts.",
        ],
      },
      {
        title: "14. When to open the official Meta docs",
        items: [
          "Open Messenger Platform docs when creating/configuring the Facebook Messenger product.",
          "Open Messenger Webhooks docs when choosing webhook fields/events and verifying callback behavior.",
          "Open Messenger Send API docs when debugging Facebook outbound replies.",
          "Open Instagram Platform docs when checking account eligibility and Instagram API requirements.",
          "Open Instagram API with Instagram Login docs when generating or validating Instagram access tokens.",
          "Open Graph API Webhooks docs when Meta changes webhook dashboard screens or verification wording.",
        ],
      },
    ],
    links: [
      {
        label: "Meta for Developers Apps",
        url: "https://developers.facebook.com/apps/",
      },
      {
        label: "Graph API Webhooks",
        url: "https://developers.facebook.com/docs/graph-api/webhooks",
      },
      {
        label: "Messenger Platform",
        url: "https://developers.facebook.com/docs/messenger-platform",
      },
      {
        label: "Messenger Webhooks",
        url: "https://developers.facebook.com/docs/messenger-platform/webhooks",
      },
      {
        label: "Messenger Send API",
        url: "https://developers.facebook.com/docs/messenger-platform/send-messages",
      },
      {
        label: "Instagram Platform",
        url: "https://developers.facebook.com/docs/instagram-platform",
      },
      {
        label: "Instagram API with Instagram Login",
        url: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login",
      },
      {
        label: "Instagram API Get Started",
        url: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started",
      },
      {
        label: "Business Login for Instagram",
        url: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login",
      },
    ],
    endpoints: [],
  },
  {
    id: "shopee-setup-guide",
    name: "Shopee Setup Guide",
    icon: Download,
    notes: [
      "Current app status: Shopee runtime scaffolding is implemented: account config, shop authorization start/callback, token exchange/refresh helper, webhook receiver, tolerant chat payload parser, normalized inbound handoff, and outbound send adapter. A saved or authorized account is not the same as production-ready; final verification still requires a real Shopee Partner App, an existing legitimate Seller shop, approved scopes, and an end-to-end buyer chat test.",
      "Goal status: To make the bot answer real Shopee buyers, LED1000 needs an existing legitimate Shopee Seller/admin account, Shopee Open Platform partner app, approved scopes, and a real end-to-end buyer message test.",
      "Official docs status: Shopee Open Platform docs and exact scopes can be gated by partner login. Treat the official docs and partner console as the source of truth for endpoint names, permission review, token lifetime, and message policy.",
      "Security: Never paste real partner_key, access_token, refresh_token, request signatures, tax/business verification data, or buyer personal data into chat, screenshots, public docs, logs, or Git commits.",
    ],
    guideGroups: [
      {
        title: "1. What exists in LinhKienLed1000 today",
        items: [
          "ChannelAccount supports type=shopee and can store one or more Shopee shops.",
          "The account form supports Shop ID, Partner ID, Access Token, Refresh Token, and Partner Key.",
          "GET responses mask Shopee secrets with flags such as hasAccessToken, hasRefreshToken, and hasPartnerKey.",
          "NormalizedInboundMessage already has channel=shopee and the Shopee webhook route maps buyer messages into that shared handler.",
          "/api/webhooks/shopee receives Shopee push/webhook payloads and processes supported text chat events.",
          "The Shopee send-message adapter signs outbound calls and attempts to send the AI response back to the buyer chat.",
        ],
      },
      {
        title: "2. Shopee prerequisites",
        items: [
          "Use an existing legitimate LED1000/customer-owned Shopee Seller account. This app does not create Shopee shops and a normal buyer account is not enough.",
          "Make sure the setup user has admin permission for the Shopee shop that will receive customer chat.",
          "Create or obtain a Shopee Open Platform developer/partner account. If Shopee requires seller, tax, identity, or business verification, complete that process inside Shopee/Seller Center; the app cannot bypass it and must not use fake verification data.",
          "Create a partner app in Shopee Open Platform for LinhKienLed1000.",
          "Prepare the public HTTPS app URL. In production use the deployed customer domain; for local verification use an HTTPS tunnel only for testing.",
          "Confirm the required modules/scopes in Shopee Open Platform: shop authorization, product/listing, order, push/webhook, and chat/customer-service messaging if available for the app.",
          "Confirm Shopee policy allows automatic replies for this shop/app category before enabling fully automated chatbot replies.",
        ],
      },
      {
        title: "3. URLs to configure",
        items: [
          "Auth start: GET /api/channels/shopee/auth/start?accountId=<channelAccountId>. Use this route from the app so the accountId is attached correctly.",
          "Callback: GET /api/channels/shopee/auth/callback. Users should not call callback by hand; Shopee calls it after seller approval.",
          "Redirect URL base: https://<your-app-domain>/api/channels/shopee/auth/callback.",
          "The actual callback must include accountId. Do not call the callback by hand; save the Shopee account in LinhKienLed1000 and use the generated auth start URL so accountId is attached correctly.",
          "Webhook URL: https://<your-app-domain>/api/webhooks/shopee.",
          "Use a public HTTPS domain. Localhost only works through a temporary HTTPS tunnel for testing.",
        ],
      },
      {
        title: "4. Connection state labels used by this app",
        items: [
          "config_saved: shop/account placeholder and non-secret config were saved, but authorization has not started.",
          "authorization_required: admin clicked connect and must finish Shopee Seller authorization in Shopee.",
          "authorized: access_token, refresh_token, and shop_id were saved after Shopee callback; webhook/chat are not verified yet.",
          "webhook_verified: a signed Shopee webhook was accepted. This is not enough by itself for chat production readiness.",
          "chat_receive_verified: a Shopee buyer chat payload reached the normalized inbound flow.",
          "chat_send_verified: the app attempted and confirmed a send-message API call succeeded for a buyer chat.",
          "production_ready: only use after scopes, webhook, receive, send, token refresh, logs, and staff handoff have been verified with the customer shop.",
          "error: the account needs operator review. Do not treat it as connected.",
        ],
      },
      {
        title: "5. Understand Shopee values",
        items: [
          "Partner ID: public numeric/app identifier from the Shopee Open Platform partner app.",
          "Partner Key: secret key used to sign Shopee API requests. Store it only in masked secret config.",
          "Shop ID: Shopee shop identifier after the seller authorizes the partner app.",
          "Access Token: token used for signed shop API calls after authorization.",
          "Refresh Token: token used to rotate/refresh the access token before expiry.",
          "Redirect URL: public URL Shopee redirects to after seller authorization. Use <APP_ORIGIN>/api/channels/shopee/auth/callback?accountId=<CHANNEL_ACCOUNT_ID> unless a custom redirectUrl is configured.",
          "Webhook/Push URL: public HTTPS endpoint Shopee calls for events. Use <APP_ORIGIN>/api/webhooks/shopee.",
        ],
      },
      {
        title: "6. In-app steps",
        items: [
          "1. Open Channels -> Accounts -> Add Shopee.",
          "2. Enter a display name and Shop ID placeholder if known.",
          "3. Enter Partner ID and Partner Key from Shopee Open Platform. Do not paste these into logs or screenshots.",
          "4. Save the config. The status should be config_saved.",
          "5. Click Ủy quyền shop/Kết nối. The browser redirects to Shopee authorization.",
          "6. Log in as the legitimate Shopee Seller/admin and approve the Partner App.",
          "7. After callback, the app stores access_token, refresh_token, and shop_id. The status should be authorized, not production-ready.",
          "8. Configure the webhook URL in Shopee Open Platform.",
          "9. Send a buyer message test from Shopee chat.",
          "10. Check status/debug: webhook_verified, chat_receive_verified, and chat_send_verified should appear as each stage succeeds.",
        ],
      },
      {
        title: "7. Runtime pieces implemented in this app",
        items: [
          "Shopee signing helper builds OpenAPI v2-style HMAC signatures for auth, token, and signed API calls.",
          "/api/channels/shopee/auth/start redirects the admin browser to Shopee shop authorization.",
          "/api/channels/shopee/auth/callback exchanges the authorization code for access_token, refresh_token, and shop_id.",
          "Tokens are stored per ChannelAccount config and masked in admin/API responses. After successful token exchange the account status is authorized, which only means credentials were saved.",
          "Token refresh helper is available and the send adapter checks tokenExpiresAt before sending; if the token is near expiry it attempts refresh-on-demand without logging tokens.",
          "No scheduler/cron is included yet. Production should add a cron/queue after token lifetime is verified in Shopee console.",
          "/api/webhooks/shopee receives events and verifies HMAC signatures when webhookSecret or partnerKey is configured.",
          "Incoming buyer text events are mapped into NormalizedInboundMessage with channel=shopee.",
          "Call processNormalizedInboundMessage() to create/update customer conversation and get the AI response.",
          "Shopee outbound send-message adapter signs and sends the AI response back to the buyer chat.",
          "Idempotency key helper exists for channel + shop_id + message_id/conversation_id and is stored as safe metadata. Durable storage-backed dedupe is still required before production go-live.",
          "Known gap: rate-limit/backoff and production alerting should be tuned after real Shopee response codes are observed.",
        ],
      },
      {
        title: "8. Target runtime flow after implementation",
        items: [
          "Buyer sends message in Shopee chat.",
          "Shopee Push/Webchat Push calls <APP_ORIGIN>/api/webhooks/shopee.",
          "LinhKienLed1000 verifies request signature and finds ChannelAccount by shop_id.",
          "Shopee payload maps to NormalizedInboundMessage: channel=shopee, channelAccountId, externalCustomerId, customerContact=shopee:<buyer_id>, externalConversationId, platformMessageId, text.",
          "processNormalizedInboundMessage() resolves customer, finds or creates the conversation, calls chat(), and returns the AI response.",
          "Shopee send adapter signs a send-message API request and sends the bot response back to Shopee.",
          "The Conversations page shows platform=Shopee, shop/account name, buyer identity, status, and the message history.",
        ],
      },
      {
        title: "9. Testing checklist",
        items: [
          "Unit test Shopee signing helper with official examples from Shopee console/docs.",
          "Unit test token refresh without printing tokens.",
          "API test webhook signature rejection for invalid/missing signature.",
          "API test incoming chat payload creates a conversation with channel=shopee and channelAccountId set.",
          "API test duplicate event id is ignored or does not send a second reply.",
          "API test outbound send adapter builds signed request with the correct shop_id/access_token but never logs secrets.",
          "End-to-end test with a real Shopee test shop: buyer sends message -> bot creates conversation -> bot sends reply.",
        ],
      },
      {
        title: "10. Troubleshooting",
        items: [
          "Cannot create partner app: the business may need a verified Shopee Open Platform partner/developer account.",
          "Seller authorization fails: check redirect URL, app status, region, and shop admin permission.",
          "401/403 from Shopee: token expired, app lacks scope, signature is wrong, or shop authorization was revoked.",
          "Webhook not received: check public HTTPS URL, Shopee push configuration, firewall, tunnel, and app approval state.",
          "Webhook received but no bot reply: check payload mapping, AI provider/API key, Knowledge Base data, and Shopee send-message scope.",
          "Bot replies twice: check webhook retry idempotency by event id/message id.",
          "Can read product/order data but cannot chat: chat/customer-service API may require separate scope or approval.",
        ],
      },
      {
        title: "11. Go-live gate",
        items: [
          "Do not tell the customer Shopee chatbot is production-ready until a real buyer message test passes end to end: webhook received, conversation created, AI response generated, and reply sent back to Shopee.",
          "Confirm exact Shopee scopes and automated messaging policy inside the customer partner console.",
          "Confirm token refresh works for more than one token cycle; send adapter has refresh-on-demand, but production still needs scheduler/monitoring.",
          "Confirm webhook signature verification is enabled in production.",
          "Confirm logs never expose partner_key, access_token, refresh_token, signatures, or raw buyer personal data.",
          "Confirm durable idempotency/dedupe is enabled so Shopee webhook retries do not create duplicate bot replies.",
          "Confirm rate-limit/backoff plan for Shopee API failures.",
          "Confirm staff handoff/ticket creation works for messages the bot cannot answer safely.",
        ],
      },
      {
        title: "12. Shopee limitations",
        items: [
          "Endpoint/path names for seller chat must be verified in the real Shopee Partner Console/docs for the customer app and region.",
          "Webhook payload shape should be captured safely from a real test event before treating parser behavior as final.",
          "Chat/customer-service scope may require separate Shopee approval even if product/order APIs work.",
          "Durable storage-backed idempotency/dedupe remains a production requirement before live operation.",
          "Rate-limit/backoff and production alerting should be tuned after real Shopee response codes are observed.",
        ],
      },
    ],
    links: [
      {
        label: "Shopee Open Platform",
        url: "https://open.shopee.com/",
      },
      {
        label: "Shopee API Calls",
        url: "https://open.shopee.com/developer-guide/16",
      },
      {
        label: "Shopee Push Mechanism",
        url: "https://open.shopee.com/developer-guide/18",
      },
      {
        label: "Shopee Authorization Process",
        url: "https://open.shopee.com/developer-guide/20",
      },
      {
        label: "Shopee Order Management",
        url: "https://open.shopee.com/developer-guide/229",
      },
      {
        label: "Shopee Product Price Guide",
        url: "https://open.shopee.com/developer-guide/223",
      },
      {
        label: "Shopee Platform Partner Rules",
        url: "https://open.shopee.com/developer-guide/34",
      },
    ],
    endpoints: [
      {
        method: "GET",
        path: "/api/channels/shopee/auth/start",
        description:
          "Start Shopee shop authorization for a saved Shopee ChannelAccount. This route redirects the admin browser to Shopee Open Platform authorization.",
        queryParams: [
          {
            name: "accountId",
            type: "string",
            required: true,
            description: "Internal ChannelAccount id for the Shopee shop placeholder/config.",
          },
        ],
        responseExample: "302 Redirect to Shopee authorization URL",
      },
      {
        method: "GET",
        path: "/api/channels/shopee/auth/callback",
        description:
          "Shopee redirects here after seller authorization. The route exchanges code + shop_id for access_token and refresh_token, stores them in the Shopee ChannelAccount, then redirects back to /channels/accounts.",
        queryParams: [
          { name: "accountId", type: "string", required: true, description: "Internal ChannelAccount id." },
          { name: "code", type: "string", required: true, description: "Authorization code returned by Shopee." },
          { name: "shop_id", type: "string", required: true, description: "Authorized Shopee shop id." },
        ],
        responseExample: "302 Redirect to /channels/accounts?channel=shopee&status=authorized",
      },
      {
        method: "POST",
        path: "/api/webhooks/shopee",
        description:
          "Receive Shopee push/webhook payloads. Supported text chat events are mapped into the normalized inbound handler, then the Shopee send adapter attempts to reply to the buyer chat.",
        headers: [
          {
            name: "authorization / x-shopee-signature / x-shopee-hmac-sha256 / x-shopee-sign",
            type: "header",
            required: false,
            description:
              "Webhook HMAC signature header. Required when webhookSecret or partnerKey is configured for the Shopee ChannelAccount.",
          },
        ],
        requestBody: {
          code: "chat_push",
          shop_id: 1001,
          data: {
            buyer_id: 2002,
            conversation_id: "conv-1",
            message_id: "msg-1",
            message: { text: "Có LED dây COB không?" },
          },
        },
        responseExample: { ok: true, received: 1, processed: 1, sent: 1 },
      },
    ],
  },
  {
    id: "tiktok-shop-setup-guide",
    name: "TikTok Shop Setup Guide",
    icon: Download,
    notes: [
      "Current app status: TikTok Shop account storage, masked config, webhook receiver, tolerant customer-message parser, and normalized inbound handoff are implemented. Real auth URL, scopes, exact webhook payload/signature, and outbound send endpoint must be verified in TikTok Shop Partner Center before production.",
      "Use TikTok Shop Partner Center/Open Platform for seller customer-service chat. TikTok for Developers and TikTok Business API are not the right surface for Seller Center buyer chat.",
      "Security: never paste real appSecret, access_token, refresh_token, webhook signatures, request bodies, or buyer personal data into chat, screenshots, public docs, logs, or Git commits.",
    ],
    guideGroups: [
      {
        title: "1. What exists in LinhKienLed1000 today",
        items: [
          "ChannelAccount supports type=tiktok_shop and can store one or more TikTok Shop seller/shop accounts.",
          "The account form supports Shop/Seller ID, App/Client key, App secret, access token, refresh token, webhook secret, API base URL, auth base URL, and send message path.",
          "GET responses mask TikTok Shop secrets with flags such as hasAccessToken, hasRefreshToken, hasAppSecret, and hasWebhookSecret.",
          "POST /api/webhooks/tiktok-shop accepts mocked/Partner-Center-style customer-service message payloads and maps text messages into NormalizedInboundMessage with channel=tiktok_shop.",
          "Outbound send back to TikTok Shop is intentionally not marked production-ready until exact Partner Center Customer Service API contract is verified with a real app/shop.",
        ],
      },
      {
        title: "2. Prerequisites",
        items: [
          "Create or obtain a legitimate TikTok Shop Seller account for the customer. A normal TikTok user account is not enough.",
          "Make sure the operator has admin permission for the shop/seller account.",
          "Create or obtain a TikTok Shop Partner Center/Open Platform app for LinhKienLed1000.",
          "Request/confirm Customer Service or buyer chat messaging scopes in Partner Center.",
          "Prepare a public HTTPS app URL. For local testing, use a temporary HTTPS tunnel only for testing.",
          "Confirm the official authorization URL, callback URL, webhook event name such as NEW_MESSAGE, signature header/rule, token lifetime, and send-message endpoint in Partner Center.",
        ],
      },
      {
        title: "1A. Current app status details",
        items: [
          "account config: implemented through ChannelAccount type=tiktok_shop.",
          "secret masking: implemented with hasAccessToken, hasRefreshToken, hasAppSecret, and hasWebhookSecret flags.",
          "webhook inbound route: implemented at POST /api/webhooks/tiktok-shop.",
          "safe debug metadata: implemented without storing raw payloads or raw message text.",
          "normalized inbound flow: implemented with channel=tiktok_shop.",
          "mock/local tests: implemented for parser, signature helper, account config, and webhook route.",
          "OAuth/callback: requires Partner Center contract verification before implementation can be finalized.",
          "outbound send-message: requires Partner Center contract verification before production use.",
          "production-ready: no, not until real Partner Center E2E passes.",
        ],
      },
      {
        title: "3. URLs to configure",
        items: [
          "Webhook URL: https://<your-app-domain>/api/webhooks/tiktok-shop.",
          "Authorization/callback URL: verify the exact TikTok Shop Partner Center OAuth flow first, then configure the app callback URL that matches the final implementation.",
          "Localhost does not work for real TikTok webhooks. Use deployed HTTPS or a temporary HTTPS tunnel for testing.",
        ],
      },
      {
        title: "3A. TikTok Shop config fields",
        items: [
          "shopId: stable TikTok Shop id when Partner Center exposes it.",
          "sellerId: seller/account id if this is the stable id exposed by TikTok Shop APIs.",
          "appKey / clientKey: public app/client identifier from Partner Center.",
          "appSecret / clientSecret: secret credential; store only as masked secret.",
          "accessToken: token for authorized API calls after real OAuth/token exchange.",
          "refreshToken: token used to rotate access token when TikTok Shop provides it.",
          "webhookSecret: signing secret or equivalent verification material.",
          "integrationStatus: current stage such as config_saved, authorization_required, webhook_verified, chat_receive_verified, or production_ready.",
          "lastWebhookAt, lastWebhookParseStatus, lastChatReceiveAt, lastChatSendAt: safe debug timestamps/status only.",
          "sendMessagePath: pending/verified send-message path. Leave unset until Partner Center confirms the endpoint.",
        ],
      },
      {
        title: "4. In-app steps",
        items: [
          "1. Open Channels -> Accounts -> Add TikTok Shop.",
          "2. Enter display name and Shop/Seller ID.",
          "3. Enter App/Client key and App secret from Partner Center. Do not expose these in logs or screenshots.",
          "4. Save the config. The status should be config_saved.",
          "5. Click Ủy quyền shop. Current behavior keeps status at authorization_required until the exact Partner Center auth flow is verified.",
          "6. Configure webhook URL in Partner Center and send a real/test buyer message payload.",
          "7. Check safe debug fields on the account: webhook_verified and chat_receive_verified indicate inbound receive works. chat_send_verified should only be used after outbound send API is verified.",
        ],
      },
      {
        title: "5. Runtime flow target",
        items: [
          "Buyer sends message in TikTok Shop customer service chat.",
          "TikTok Shop webhook calls <APP_ORIGIN>/api/webhooks/tiktok-shop.",
          "LinhKienLed1000 verifies signature when webhookSecret/appSecret is configured and finds ChannelAccount by shop_id/seller_id.",
          "Payload maps to NormalizedInboundMessage: channel=tiktok_shop, channelAccountId, externalCustomerId, customerContact=tiktok_shop:<shop_id>:<buyer_id>, externalConversationId, platformMessageId, text.",
          "processNormalizedInboundMessage() resolves customer, finds or creates conversation, calls chat(), and returns the AI response.",
          "After Partner Center send endpoint is verified, a send adapter should deliver the response back to TikTok Shop buyer chat.",
        ],
      },
      {
        title: "6. Go-live gate",
        items: [
          "Do not mark TikTok Shop production_ready until a real seller app/shop passes: OAuth/token exchange, webhook signature verification, inbound buyer message, normalized conversation creation, AI response, outbound send, retry/idempotency, and staff handoff.",
          "Confirm official Customer Service API scope and automated messaging policy in Partner Center.",
          "Confirm logs never expose appSecret, accessToken, refreshToken, signatures, raw payloads, raw buyer messages, or buyer personal data.",
          "Add durable idempotency storage before live operation so webhook retries do not create duplicate replies.",
        ],
      },
      {
        title: "7. TikTok Shop expectation setting",
        items: [
          "TikTok Shop should not be expected to behave like Facebook/Instagram until Partner Center access confirms Customer Service API and Send Message contract.",
          "A saved TikTok Shop account means config exists; it does not mean OAuth, webhook signature, receive, or send has passed.",
          "If Partner Center does not grant customer-service/message scopes, the app cannot force buyer-chat automation.",
          "Any seller verification, business verification, tax, or bank requirements must be completed in TikTok Shop/Seller Center by the customer.",
        ],
      },
    ],
    links: [
      {
        label: "TikTok Shop Partner Center",
        url: "https://partner.tiktokshop.com/",
      },
      {
        label: "TikTok Shop Customer Service API Overview",
        url: "https://partner.tiktokshop.com/docv2/page/customer-service-api-overview",
      },
      {
        label: "TikTok Shop Authorization Overview",
        url: "https://partner.tiktokshop.com/docv2/page/authorization-overview-202407",
      },
      {
        label: "TikTok Webhooks Overview",
        url: "https://developers.tiktok.com/doc/webhooks-overview/",
      },
    ],
    endpoints: [
      {
        method: "POST",
        path: "/api/webhooks/tiktok-shop",
        description:
          "Receive TikTok Shop customer-service webhook payloads. Supported text message events are mapped into the normalized inbound handler. Outbound send is intentionally gated until Partner Center send-message contract is verified.",
        headers: [
          {
            name: "authorization / x-tts-signature / x-tiktok-shop-signature / x-tiktok-hmac-sha256 / x-tiktok-sign",
            type: "header",
            required: false,
            description:
              "Webhook HMAC signature header. Required when webhookSecret or appSecret is configured for the TikTok Shop ChannelAccount. Confirm the exact official signature header/rule in Partner Center.",
          },
        ],
        requestBody: {
          type: "NEW_MESSAGE",
          shop_id: 1001,
          data: {
            buyer_id: 2002,
            conversation_id: "conv-1",
            message_id: "msg-1",
            message: { text: "Có đèn pha LED không?" },
          },
        },
        responseExample: { ok: true, received: 1, processed: 1, sent: 0 },
      },
    ],
  },
  {
    id: "meta-shared-webhook",
    name: "Meta Shared Webhook",
    icon: Webhook,
    notes: [
      "Scope: this section is the API reference for the shared Meta callback. For key/token setup steps, start from Meta Setup Guide.",
      "Callback URL: Facebook Messenger and Instagram Direct Messaging share <APP_ORIGIN>/api/webhooks/meta.",
      "Shared flow: Meta webhook -> parse payload -> detect platform -> resolveCustomer -> find/create Conversation -> chat(conversation.id, text) -> send reply.",
      "Platform detection: Facebook uses object=page; Instagram uses object=instagram.",
      "Supported events: currently supported = text messages. Ignored = echo, non-text, delivery/read receipts, and reactions.",
      "Security: x-hub-signature-256 is verified when META_APP_SECRET or a channel appSecret is configured.",
      "Webhook verification: GET verification uses hub.mode=subscribe, hub.verify_token, and hub.challenge.",
      "Try it note: POST Try it uses a Facebook object=page payload only as a runnable sample. Copy Instagram payloads from the Instagram Direct Messaging section.",
    ],
    endpoints: [
      {
        method: "GET",
        path: "/api/webhooks/meta",
        description:
          "Verify the shared Meta webhook callback for Facebook Messenger and Instagram Direct Messaging. If hub.mode is subscribe and hub.verify_token matches Channels -> Accounts -> Facebook/Instagram or META_VERIFY_TOKEN, the route returns hub.challenge as plain text.",
        queryParams: [
          {
            name: "hub.mode",
            type: "string",
            required: true,
            description:
              "Always use subscribe. Meta sends this value when verifying the webhook callback.",
            defaultValue: "subscribe",
          },
          {
            name: "hub.verify_token",
            type: "string",
            required: true,
            description: "Webhook verify token from Channels -> Accounts -> Facebook/Instagram or META_VERIFY_TOKEN.",
          },
          {
            name: "hub.challenge",
            type: "string",
            required: true,
            description: "Challenge string returned as text when verification succeeds.",
            defaultValue: "hello123",
          },
        ],
        responseExample: "hello123",
      },
      {
        method: "POST",
        path: "/api/webhooks/meta",
        description:
          "Receive the shared Meta webhook callback. The request body shown here is a real Facebook payload for Try it convenience; see the Facebook Messenger and Instagram Direct Messaging sections for separate platform-specific payload examples.",
        requestBody: {
          object: "page",
          entry: [
            {
              messaging: [
                {
                  sender: { id: "USER_PSID_TEST" },
                  recipient: { id: "PAGE_ID_TEST" },
                  message: { text: "hello facebook" },
                },
              ],
            },
          ],
        },
        responseExample: { ok: true, received: 1 },
        params: [],
        headers: [
          {
            name: "x-hub-signature-256",
            type: "header",
            required: false,
            description:
              "Required when META_APP_SECRET or a channel appSecret is configured. Invalid signatures return 401.",
          },
        ],
      },
    ],
  },
  {
    id: "facebook-messenger",
    name: "Facebook Messenger",
    icon: MessageSquare,
    notes: [
      "Scope: this section documents Facebook channel config APIs and Facebook payload examples. For step-by-step setup and where to paste values, use Meta Setup Guide.",
      "Required config: Verify Token, Page Access Token, Graph Version v25.0, and optional Page ID/App Secret.",
      "Page ID lookup, optional: curl \"https://graph.facebook.com/v25.0/me?fields=id,name&access_token=YOUR_FACEBOOK_PAGE_ACCESS_TOKEN\". The id in the response is the Page ID. Do not paste real tokens into shared logs.",
      "Facebook payload mapping: sender.id -> customer PSID, recipient.id -> Facebook Page ID, customerContact -> facebook:<psid>.",
      "Security: GET channel responses never return raw pageAccessToken or appSecret. Blank or masked secret fields preserve the existing secret on save.",
      "Local POST test: curl -X POST \"http://localhost:3000/api/webhooks/meta\" -H \"Content-Type: application/json\" -d \"{\\\"object\\\":\\\"page\\\",\\\"entry\\\":[{\\\"messaging\\\":[{\\\"sender\\\":{\\\"id\\\":\\\"USER_PSID_TEST\\\"},\\\"recipient\\\":{\\\"id\\\":\\\"PAGE_ID_TEST\\\"},\\\"message\\\":{\\\"text\\\":\\\"hello facebook\\\"}}]}]}\"",
    ],
    examples: [
      {
        label: "Facebook Webhook Payload",
        data: {
          object: "page",
          entry: [
            {
              messaging: [
                {
                  sender: { id: "USER_PSID" },
                  recipient: { id: "PAGE_ID" },
                  message: { text: "Hello from Facebook" },
                },
              ],
            },
          ],
        },
      },
      {
        label: "Facebook Channel Config",
        data: {
          type: "facebook",
          isActive: true,
          config: {
            verifyToken: "my-verify-token",
            pageAccessToken: "YOUR_FACEBOOK_PAGE_ACCESS_TOKEN",
            pageId: "OPTIONAL_PAGE_ID",
            graphVersion: "v25.0",
            appSecret: "YOUR_META_APP_SECRET",
          },
        },
      },
    ],
    links: [
      {
        label: "Messenger Platform",
        url: "https://developers.facebook.com/docs/messenger-platform",
      },
      {
        label: "Messenger Webhooks",
        url: "https://developers.facebook.com/docs/messenger-platform/webhooks",
      },
      {
        label: "Messenger Send API",
        url: "https://developers.facebook.com/docs/messenger-platform/send-messages",
      },
      {
        label: "Graph API Webhooks",
        url: "https://developers.facebook.com/docs/graph-api/webhooks",
      },
    ],
    endpoints: [
      {
        method: "GET",
        path: "/api/channels/:type",
        description:
          "Get sanitized Facebook channel config. Use type=facebook. Raw pageAccessToken and appSecret are never returned.",
        params: [
          {
            name: "type",
            type: "string",
            required: true,
            description: "Use facebook.",
            defaultValue: "facebook",
          },
        ],
        responseExample: {
          type: "facebook",
          isActive: true,
          config: {
            verifyToken: "my-verify-token",
            pageId: "OPTIONAL_PAGE_ID",
            graphVersion: "v25.0",
            hasPageAccessToken: true,
            hasAppSecret: true,
          },
        },
      },
      {
        method: "POST",
        path: "/api/channels",
        description:
          "Create or update Facebook channel config. Blank or masked pageAccessToken/appSecret values preserve existing secrets.",
        requestBody: {
          type: "facebook",
          isActive: true,
          config: {
            verifyToken: "my-verify-token",
            pageAccessToken: "YOUR_FACEBOOK_PAGE_ACCESS_TOKEN",
            pageId: "OPTIONAL_PAGE_ID",
            graphVersion: "v25.0",
            appSecret: "YOUR_META_APP_SECRET",
          },
        },
        responseExample: {
          type: "facebook",
          isActive: true,
          config: {
            verifyToken: "my-verify-token",
            pageId: "OPTIONAL_PAGE_ID",
            graphVersion: "v25.0",
            hasPageAccessToken: true,
            hasAppSecret: true,
          },
        },
      },
    ],
  },
  {
    id: "instagram-direct",
    name: "Instagram Direct Messaging",
    icon: MessagesSquare,
    notes: [
      "Scope: this section documents Instagram channel config APIs and Instagram payload examples. For step-by-step setup and where to paste values, use Meta Setup Guide.",
      "Required config: Verify Token, Instagram Access Token, Graph Version v25.0, and optional Business Account ID/App Secret.",
      "Important: this integration targets Instagram Direct Messaging API / Instagram API with Instagram Login.",
      "Do not use Instagram Basic Display API for chatbot messaging.",
      "Do not use a Facebook Page Access Token as the Instagram Access Token for the direct Instagram flow.",
      "Business Account ID: optional metadata in LinhKienLed1000. The webhook payload recipient.id can help confirm which Instagram business/account received the message.",
      "Instagram payload mapping: sender.id -> Instagram sender id, recipient.id -> Instagram business/account id, customerContact -> instagram:<sender_id>.",
      "Security: GET channel responses never return raw accessToken or appSecret. Blank or masked secret fields preserve the existing secret on save.",
      "Local POST test: curl -X POST \"http://localhost:3000/api/webhooks/meta\" -H \"Content-Type: application/json\" -d \"{\\\"object\\\":\\\"instagram\\\",\\\"entry\\\":[{\\\"messaging\\\":[{\\\"sender\\\":{\\\"id\\\":\\\"IG_SENDER_TEST\\\"},\\\"recipient\\\":{\\\"id\\\":\\\"IG_BUSINESS_TEST\\\"},\\\"message\\\":{\\\"text\\\":\\\"hello instagram\\\"}}]}]}\"",
    ],
    examples: [
      {
        label: "Instagram Webhook Payload",
        data: {
          object: "instagram",
          entry: [
            {
              messaging: [
                {
                  sender: { id: "IG_SENDER_ID" },
                  recipient: { id: "IG_BUSINESS_ID" },
                  message: { text: "Hello from Instagram" },
                },
              ],
            },
          ],
        },
      },
      {
        label: "Instagram Channel Config",
        data: {
          type: "instagram",
          isActive: true,
          config: {
            verifyToken: "my-verify-token",
            accessToken: "YOUR_INSTAGRAM_ACCESS_TOKEN",
            businessAccountId: "OPTIONAL_INSTAGRAM_BUSINESS_ACCOUNT_ID",
            graphVersion: "v25.0",
            appSecret: "YOUR_META_APP_SECRET",
          },
        },
      },
    ],
    links: [
      {
        label: "Instagram Platform",
        url: "https://developers.facebook.com/docs/instagram-platform",
      },
      {
        label: "Instagram API with Instagram Login",
        url: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login",
      },
      {
        label: "Business Login for Instagram",
        url: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login",
      },
      {
        label: "Instagram API Get Started",
        url: "https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started",
      },
    ],
    endpoints: [
      {
        method: "GET",
        path: "/api/channels/:type",
        description:
          "Get sanitized Instagram channel config. Use type=instagram. Raw accessToken and appSecret are never returned.",
        params: [
          {
            name: "type",
            type: "string",
            required: true,
            description: "Use instagram.",
            defaultValue: "instagram",
          },
        ],
        responseExample: {
          type: "instagram",
          isActive: true,
          config: {
            verifyToken: "my-verify-token",
            businessAccountId: "OPTIONAL_INSTAGRAM_BUSINESS_ACCOUNT_ID",
            graphVersion: "v25.0",
            hasAccessToken: true,
            hasAppSecret: true,
          },
        },
      },
      {
        method: "PUT",
        path: "/api/channels/:type",
        description:
          "Update Instagram channel config. Blank or masked accessToken/appSecret values preserve existing secrets.",
        params: [
          {
            name: "type",
            type: "string",
            required: true,
            description: "Use instagram.",
            defaultValue: "instagram",
          },
        ],
        requestBody: {
          isActive: true,
          config: {
            verifyToken: "my-verify-token",
            accessToken: "YOUR_INSTAGRAM_ACCESS_TOKEN",
            businessAccountId: "OPTIONAL_INSTAGRAM_BUSINESS_ACCOUNT_ID",
            graphVersion: "v25.0",
            appSecret: "YOUR_META_APP_SECRET",
          },
        },
        responseExample: {
          type: "instagram",
          isActive: true,
          config: {
            verifyToken: "my-verify-token",
            businessAccountId: "OPTIONAL_INSTAGRAM_BUSINESS_ACCOUNT_ID",
            graphVersion: "v25.0",
            hasAccessToken: true,
            hasAppSecret: true,
          },
        },
      },
    ],
  },
  {
    id: "export",
    name: "Export",
    icon: Download,
    endpoints: [
      {
        method: "GET",
        path: "/api/export",
        description:
          "Export data in CSV or JSON format. Supports exporting conversations, tickets, knowledge base entries, and customers.",
        responseExample: {
          note: "Returns CSV or JSON file as download",
        },
        queryParams: [
          {
            name: "type",
            type: "string",
            required: true,
            description: "Data type: conversations, tickets, knowledge, customers",
          },
          {
            name: "format",
            type: "string",
            required: true,
            description: "Output format: csv or json",
          },
        ],
      },
    ],
  },
  {
    id: "health",
    name: "Health Check",
    icon: Heart,
    endpoints: [
      {
        method: "GET",
        path: "/api/health",
        description:
          "Check the API health status. Returns uptime and database connectivity status.",
        responseExample: {
          status: "ok",
          uptime: 86400,
          database: "connected",
          timestamp: "2026-04-01T10:00:00Z",
        },
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Method Badge
// ---------------------------------------------------------------------------

const methodColors: Record<string, string> = {
  GET: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  POST: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  PUT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wide min-w-[56px] justify-center",
        methodColors[method] || "bg-gray-100 text-gray-800"
      )}
    >
      {method}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Code Block
// ---------------------------------------------------------------------------

function CodeBlock({
  data,
  label,
  language,
}: {
  data: unknown;
  label: string;
  language: DocsLanguage;
}) {
  const [copied, setCopied] = useState(false);
  const ui = useDocsUi(language);
  const text = JSON.stringify(data, null, 2);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <div className="relative group">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 dark:bg-gray-900 rounded-t-lg border border-gray-700">
        <span className="text-xs text-gray-400 font-medium">{label}</span>
        <button
          onClick={handleCopy}
          className="text-gray-400 hover:text-white transition-colors"
          title={ui.copyToClipboard}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 text-sm p-4 rounded-b-lg border border-t-0 border-gray-700 overflow-x-auto">
        <code>{text}</code>
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Try It Panel
// ---------------------------------------------------------------------------

function TryItPanel({ endpoint, language }: { endpoint: Endpoint; language: DocsLanguage }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const ui = useDocsUi(language);
  const allParams = useMemo(
    () => [...(endpoint.params || []), ...(endpoint.queryParams || [])],
    [endpoint.params, endpoint.queryParams]
  );
  const getDefaultParamValues = useCallback(() => {
    return allParams.reduce<Record<string, string>>((values, param) => {
      if (param.defaultValue) values[param.name] = param.defaultValue;
      return values;
    }, {});
  }, [allParams]);
  const [paramValues, setParamValues] = useState<Record<string, string>>(getDefaultParamValues);
  const [bodyText, setBodyText] = useState(
    endpoint.requestBody ? JSON.stringify(endpoint.requestBody, null, 2) : ""
  );

  useEffect(() => {
    setParamValues(getDefaultParamValues());
    setBodyText(endpoint.requestBody ? JSON.stringify(endpoint.requestBody, null, 2) : "");
    setResponse(null);
    setResponseStatus(null);
  }, [endpoint, getDefaultParamValues]);

  const handleSend = useCallback(async () => {
    setLoading(true);
    setResponse(null);
    setResponseStatus(null);

    try {
      let url = endpoint.path;

      // Replace path params
      if (endpoint.params) {
        for (const p of endpoint.params) {
          url = url.replace(`:${p.name}`, paramValues[p.name] || `{${p.name}}`);
        }
      }

      // Add query params
      if (endpoint.queryParams) {
        const qp = new URLSearchParams();
        for (const p of endpoint.queryParams) {
          if (paramValues[p.name]) qp.set(p.name, paramValues[p.name]);
        }
        const qs = qp.toString();
        if (qs) url += `?${qs}`;
      }

      const opts: RequestInit = {
        method: endpoint.method,
        headers: { "Content-Type": "application/json" },
      };

      if ((endpoint.method === "POST" || endpoint.method === "PUT") && bodyText.trim()) {
        opts.body = bodyText;
      }

      const res = await fetch(url, opts);
      setResponseStatus(res.status);

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("json")) {
        const json = await res.json();
        setResponse(JSON.stringify(json, null, 2));
      } else {
        const text = await res.text();
        setResponse(text.slice(0, 2000));
      }
    } catch (err) {
      setResponse(`Error: ${err instanceof Error ? err.message : ui.requestFailed}`);
    } finally {
      setLoading(false);
    }
  }, [endpoint, paramValues, bodyText]);

  return (
    <div className="mt-4 border border-owly-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-owly-text bg-owly-primary-50 hover:bg-owly-primary-100 transition-colors text-left"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 text-owly-primary" />
        ) : (
          <ChevronRight className="h-4 w-4 text-owly-primary" />
        )}
        <Send className="h-4 w-4 text-owly-primary" />
        {ui.tryIt}
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-owly-surface border-t border-owly-border">
          {allParams.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-owly-text-light uppercase tracking-wider">
                {ui.parameters}
              </h4>
              {allParams.map((p) => (
                <div key={p.name} className="flex items-start gap-3">
                  <div className="w-40 flex-shrink-0">
                    <label className="text-sm font-medium text-owly-text">
                      {p.name}
                      {p.required && <span className="text-owly-danger ml-0.5">*</span>}
                    </label>
                    <p className="text-xs text-owly-text-light">{p.type}</p>
                  </div>
                  <input
                    type="text"
                    placeholder={translateText(p.description, language)}
                    className="flex-1 px-3 py-1.5 text-sm border border-owly-border rounded-lg bg-owly-bg text-owly-text focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary transition-theme"
                    value={paramValues[p.name] || ""}
                    onChange={(e) => setParamValues({ ...paramValues, [p.name]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          {(endpoint.method === "POST" || endpoint.method === "PUT") && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-owly-text-light uppercase tracking-wider">
                {ui.requestBodyJson}
              </h4>
              <textarea
                className="w-full h-40 px-3 py-2 text-sm font-mono border border-owly-border rounded-lg bg-owly-bg text-owly-text focus:outline-none focus:ring-2 focus:ring-owly-primary/30 focus:border-owly-primary resize-y transition-theme"
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
            </div>
          )}

          <button
            onClick={handleSend}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-owly-primary text-white text-sm font-medium rounded-lg hover:bg-owly-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {ui.sendRequest}
          </button>

          {response !== null && (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-owly-text-light uppercase tracking-wider">
                  {ui.response}
                </span>
                {responseStatus !== null && (
                  <span
                    className={cn(
                      "text-xs font-bold px-2 py-0.5 rounded",
                      responseStatus >= 200 && responseStatus < 300
                        ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                    )}
                  >
                    {responseStatus}
                  </span>
                )}
              </div>
              <pre className="bg-gray-900 dark:bg-gray-950 text-gray-100 text-sm p-4 rounded-lg border border-gray-700 overflow-x-auto max-h-80">
                <code>{response}</code>
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Endpoint Card
// ---------------------------------------------------------------------------

function EndpointCard({ endpoint, language }: { endpoint: Endpoint; language: DocsLanguage }) {
  const ui = useDocsUi(language);

  return (
    <div className="border border-owly-border rounded-xl bg-owly-surface p-6 transition-theme">
      <div className="flex items-center gap-3 flex-wrap">
        <MethodBadge method={endpoint.method} />
        <code className="text-sm font-semibold text-owly-text font-mono">{endpoint.path}</code>
      </div>

      <p className="mt-3 text-sm text-owly-text-light leading-relaxed">
        {translateText(endpoint.description, language)}
      </p>

      {/* Parameters table */}
      {((endpoint.params && endpoint.params.length > 0) ||
        (endpoint.queryParams && endpoint.queryParams.length > 0) ||
        (endpoint.headers && endpoint.headers.length > 0)) && (
        <div className="mt-4">
          <h4 className="text-xs font-semibold text-owly-text-light uppercase tracking-wider mb-2">
            {ui.parameters}
          </h4>
          <div className="border border-owly-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-owly-bg">
                  <th className="text-left px-4 py-2 text-xs font-semibold text-owly-text-light uppercase">
                    {ui.name}
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-owly-text-light uppercase">
                    {ui.type}
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-owly-text-light uppercase">
                    {ui.required}
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-semibold text-owly-text-light uppercase">
                    {ui.description}
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...(endpoint.params || []), ...(endpoint.queryParams || []), ...(endpoint.headers || [])].map((p) => (
                  <tr key={p.name} className="border-t border-owly-border">
                    <td className="px-4 py-2 font-mono text-owly-text font-medium">{p.name}</td>
                    <td className="px-4 py-2 text-owly-text-light">{p.type}</td>
                    <td className="px-4 py-2">
                      {p.required ? (
                        <span className="text-owly-danger font-medium">{ui.yes}</span>
                      ) : (
                        <span className="text-owly-text-light">{ui.no}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-owly-text-light">
                      {translateText(p.description, language)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request body */}
      {endpoint.requestBody && (
        <div className="mt-4">
          <CodeBlock data={endpoint.requestBody} label={ui.requestBody} language={language} />
        </div>
      )}

      {/* Response example */}
      <div className="mt-4">
        <CodeBlock data={endpoint.responseExample} label={ui.response} language={language} />
      </div>

      {/* Try it */}
      <TryItPanel endpoint={endpoint} language={language} />
    </div>
  );
}

function GuideNote({ note, language }: { note: string; language: DocsLanguage }) {
  const translatedNote = translateText(note, language);
  const separatorIndex = translatedNote.indexOf(":");
  const hasPrefix = separatorIndex > 0 && separatorIndex <= 48;

  if (!hasPrefix) return <span>{translatedNote}</span>;

  return (
    <span>
      <span className="font-medium text-owly-text">
        {translatedNote.slice(0, separatorIndex)}:
      </span>
      {translatedNote.slice(separatorIndex + 1)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ApiDocsPage() {
  const [activeSection, setActiveSection] = useState("channel-readiness-matrix");
  const [language, setLanguage] = useState<DocsLanguage>("en");
  const ui = useDocsUi(language);

  const currentSection = apiSections.find((s) => s.id === activeSection) || apiSections[0];

  return (
    <div className="flex flex-col h-full">
      <Header title={ui.pageTitle} description={ui.pageDescription} />

      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-60 flex-shrink-0 border-r border-owly-border bg-owly-bg overflow-y-auto p-4 hidden lg:block">
          <nav className="space-y-1">
            {apiSections.map((section) => {
              const Icon = section.icon;
              const isActive = section.id === activeSection;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                    isActive
                      ? "bg-owly-primary text-white"
                      : "text-owly-text-light hover:bg-owly-surface hover:text-owly-text"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  {translateText(section.name, language)}
                  <span className="ml-auto text-xs opacity-70">
                    {section.endpoints.length || (section.guideGroups ? ui.guide : 0)}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex flex-col gap-2 rounded-xl border border-owly-border bg-owly-surface p-4 transition-theme sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-owly-text">{ui.languageLabel}</p>
                <p className="text-xs text-owly-text-light">
                  {language === "vi"
                    ? "Nội dung API docs đang hiển thị bằng tiếng Việt."
                    : "API docs are currently shown in English."}
                </p>
              </div>
              <div className="inline-flex rounded-lg border border-owly-border bg-owly-bg p-1">
                {(["en", "vi"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      language === lang
                        ? "bg-owly-primary text-white"
                        : "text-owly-text-light hover:bg-owly-surface hover:text-owly-text"
                    )}
                  >
                    {lang === "en" ? ui.english : ui.vietnamese}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile section selector */}
            <div className="lg:hidden">
              <select
                value={activeSection}
                onChange={(e) => setActiveSection(e.target.value)}
                className="w-full px-3 py-2 border border-owly-border rounded-lg bg-owly-surface text-owly-text text-sm focus:outline-none focus:ring-2 focus:ring-owly-primary/30"
              >
                {apiSections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {translateText(s.name, language)}
                  </option>
                ))}
              </select>
            </div>

            {/* Authentication Section */}
            <div className="border border-owly-border rounded-xl bg-owly-surface p-6 transition-theme">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-owly-primary-50 rounded-lg">
                  <Key className="h-5 w-5 text-owly-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-owly-text">{ui.authentication}</h3>
                  <p className="text-sm text-owly-text-light">{ui.authDescription}</p>
                </div>
              </div>

              <div className="space-y-3 text-sm text-owly-text-light leading-relaxed">
                <p>
                  {ui.authIntroBefore}{" "}
                  <code className="px-1.5 py-0.5 bg-owly-bg rounded text-owly-text font-mono text-xs">
                    X-API-Key
                  </code>{" "}
                  {ui.authIntroAfter}
                </p>
                <div className="bg-gray-900 dark:bg-gray-950 text-gray-100 text-sm p-4 rounded-lg border border-gray-700 font-mono">
                  <span className="text-blue-400">curl</span>{" "}
                  <span className="text-green-400">-H</span>{" "}
                  <span className="text-amber-300">{'"X-API-Key: your_api_key_here"'}</span> \<br />
                  {"  "}https://your-domain.com/api/conversations
                </div>
                <p>
                  {ui.authSecurity}
                </p>
              </div>
            </div>

            {/* Section Header */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-owly-primary-50 rounded-lg">
                <currentSection.icon className="h-5 w-5 text-owly-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-owly-text">
                  {translateText(currentSection.name, language)}
                </h3>
                <p className="text-sm text-owly-text-light">
                  {currentSection.endpoints.length > 0
                    ? `${currentSection.endpoints.length} ${
                        currentSection.endpoints.length !== 1 ? ui.endpoints : ui.endpoint
                      }`
                    : ui.integrationGuide}
                </p>
              </div>
            </div>

            {/* Endpoints */}
            {(currentSection.notes ||
              currentSection.guideGroups ||
              currentSection.examples ||
              currentSection.links) && (
              <div className="border border-owly-border rounded-xl bg-owly-surface p-6 transition-theme space-y-4">
                {currentSection.notes && (
                  <div>
                    <h4 className="text-xs font-semibold text-owly-text-light uppercase tracking-wider mb-2">
                      {ui.notes}
                    </h4>
                    <ul className="space-y-2 text-sm text-owly-text-light leading-relaxed">
                      {currentSection.notes.map((note) => (
                        <li key={note} className="flex gap-2">
                          <span className="mt-2 h-1.5 w-1.5 rounded-full bg-owly-primary flex-shrink-0" />
                          <GuideNote note={note} language={language} />
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {currentSection.guideGroups && (
                  <div>
                    <h4 className="text-xs font-semibold text-owly-text-light uppercase tracking-wider mb-3">
                      {ui.integrationGuideTitle}
                    </h4>
                    <div className="grid grid-cols-1 gap-4">
                      {currentSection.guideGroups.map((group) => (
                        <div
                          key={group.title}
                          className="rounded-lg border border-owly-border bg-owly-bg/50 p-4"
                        >
                          <h5 className="text-sm font-semibold text-owly-text mb-3">
                            {translateText(group.title, language)}
                          </h5>
                          <ol className="space-y-2 text-sm text-owly-text-light leading-relaxed">
                            {group.items.map((item, index) => (
                              <li key={item} className="flex gap-3">
                                <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-owly-primary-50 text-xs font-semibold text-owly-primary">
                                  {index + 1}
                                </span>
                                <GuideNote note={item} language={language} />
                              </li>
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentSection.examples && (
                  <div>
                    <h4 className="text-xs font-semibold text-owly-text-light uppercase tracking-wider mb-2">
                      {ui.examples}
                    </h4>
                    <div className="space-y-4">
                      {currentSection.examples.map((example) => (
                        <CodeBlock
                          key={example.label}
                          data={example.data}
                          label={translateText(example.label, language)}
                          language={language}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {currentSection.links && (
                  <div>
                    <h4 className="text-xs font-semibold text-owly-text-light uppercase tracking-wider mb-2">
                      {ui.officialDocs}
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {currentSection.links.map((link) => (
                        <a
                          key={link.url}
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-owly-primary hover:text-owly-primary-dark hover:underline transition-colors"
                        >
                          {translateText(link.label, language)}
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-6">
              {currentSection.endpoints.map((ep, i) => (
                <EndpointCard key={`${ep.method}-${ep.path}-${i}`} endpoint={ep} language={language} />
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
