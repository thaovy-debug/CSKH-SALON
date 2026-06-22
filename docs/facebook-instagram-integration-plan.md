# Facebook / Instagram Integration Plan

Ngay 2026-05-31. Tai lieu nay chi la bao cao khao sat va ke hoach tich hop. Chua trien khai code business logic.

## 1. Kien truc hien tai

### Tong quan repo

- Repo la ung dung LinhKienLed1000 cho CSKH LED1000, dung Next.js App Router, TypeScript, Prisma/PostgreSQL, dashboard CRM va bot AI/RAG.
- `README.md` mo ta muc tieu chinh la CRM + bot AI cham soc khach hang da kenh, hien nhan manh WhatsApp va Email.
- `package.json` dang dung `next@16.2.2`, `react@19.2.4`, `prisma@7.6.0`, `vitest`, `whatsapp-web.js`, `twilio`, `nodemailer`, `openai`. README badge con ghi Next.js 14, nen khi code can theo `node_modules/next/dist/docs/` nhu `AGENTS.md` yeu cau.
- AI/RAG tap trung o `src/lib/ai/engine.ts`.
- Cac kenh hien co nam trong `src/lib/channels/*`: `whatsapp`, `email`, `telegram`, `zalo`, `sms`, `phone`.
- Dashboard va API quan tri da co he thong `Channel`, `Conversation`, `Message`, `Customer`, webhook delivery rieng cua app.

### Prisma schema lien quan

Khong co enum channel, cac channel hien duoc luu bang string:

- `Channel`
  - `type String @unique`
  - `isActive`, `config Json`, `status`
- `Conversation`
  - `channel String`
  - `customerName String`
  - `customerContact String`
  - `customerId String?`
  - relation toi `Customer`, `Message`, `Ticket`, tag, note
  - co index tren `channel`, `status`, `customerContact`, `customerId`
- `Message`
  - `conversationId`
  - `role` gom cac role dang dung nhu `customer`, `assistant`, `admin`, `system`
  - `content`, `mediaType`, `mediaUrl`, `toolCalls`
- `Customer`
  - cac field lien he co san: `email`, `phone`, `whatsapp`
  - co `metadata Json`
  - chua co field rieng cho `facebook` hoac `instagram`

Ket luan schema: chua can doi Prisma schema cho phase dau. Nen dung `Conversation.customerContact` dang co va `Customer.metadata` neu can luu external id Meta ben Customer.

## 2. Flow chat hien tai

### Web/API chat

File: `src/app/api/chat/route.ts`

- `POST /api/chat` doc JSON body:
  - `message`
  - optional `conversationId`
  - optional `channel`, `customerName`, `customerContact`
- Neu khong co `conversationId`, route tao conversation moi bang `createNewConversation(channel || "api", customerName || "API User", customerContact || "")`.
- Sau do goi `chat(conversationId, message.trim())`.
- Route nay hien khong goi `resolveCustomer`, nen conversation tao tu API co the khong link `customerId`.

### WhatsApp inbound

File: `src/lib/channels/whatsapp.ts`

- `initWhatsApp()` tao `whatsapp-web.js` client voi `LocalAuth`.
- Khi client `ready`, upsert `Channel(type="whatsapp", isActive=true, status="connected")`.
- Event `message`:
  - bo qua `message.fromMe`.
  - lay `contact.pushname || contact.name || "Unknown"`.
  - `customerContact = message.from`.
  - goi `resolveCustomer("whatsapp", customerContact, customerName)`.
  - tim conversation active/escalated theo:
    - `channel = "whatsapp"`
    - `OR [{ customerId }, { customerContact }]`
    - `updatedAt desc`
  - neu khong co thi `createNewConversation("whatsapp", customerName, customerContact, customerId)`.
  - neu co media thi chuyen thanh placeholder text.
  - goi `chat(conversation.id, messageContent)`.
  - `message.reply(aiResponse)`.

Route dieu khien WhatsApp: `src/app/api/channels/whatsapp/route.ts`

- `GET` tra status/QR.
- `POST action=connect|disconnect|send`.
- Route nay co auth dashboard, khong phai webhook cong khai.

### Zalo / Telegram / Email / SMS / Phone pattern

- `src/app/api/channels/zalo/incoming/route.ts` la webhook/internal inbound route cho Zalo, flow gan giong WhatsApp: parse body, resolve customer, find/create conversation, goi `chat`, tra response JSON.
- `src/lib/channels/telegram.ts` co `handleTelegramUpdate(update)`: parse message text, resolve customer, find/create conversation, goi `chat`, gui lai Telegram API.
- `src/lib/channels/email.ts` xu ly IMAP unseen mail: resolve customer theo email, find/create conversation, goi `chat`, gui SMTP reply.
- `src/lib/channels/sms.ts` va `phone.ts` cung goi `resolveCustomer`, find/create conversation, goi `chat`.

### Luu Message va goi AI/RAG

File chinh: `src/lib/ai/engine.ts`

`chat(conversationId, userMessage)` lam cac viec sau:

1. Doc settings AI bang `getAIConfig()`.
2. Neu thieu API key thi return message cau hinh.
3. Tim `Conversation` kem toi da 50 `messages` cu.
4. Goi `getKnowledgeBase(userMessage)`, ben trong dung `searchKnowledgeBase(query, 10)`.
5. Lay customer profile context neu conversation co `customerId`.
6. Tao system prompt bang business settings, channel, customer name, customer history va knowledge base.
7. Day lich su message vao AI messages.
8. Chay guardrails / automation.
9. Luu message khach:
   - `prisma.message.create({ role: "customer", content: userMessage })`
10. Neu automation co auto reply:
   - luu assistant message
   - update conversation `updatedAt`
   - emit realtime
   - return automated reply
11. Neu khong co automation:
   - goi Gemini-compatible client trong `callAI(...)`
   - co tool calls qua `owlyTools` va fallback without tools
   - luu assistant message
   - update conversation `updatedAt`
   - tinh confidence, co the set status `escalated`
   - emit realtime
   - return response

Nghia la Meta/Facebook/Instagram nen di vao bang cach tao/tim conversation roi goi `chat(...)`, khong nen goi truc tiep provider AI.

### Resolve customer hien tai

File: `src/lib/customer-resolver.ts`

`resolveCustomer(channel, customerContact, customerName)`:

- Co in-memory lock theo `${channel}:${customerContact}`.
- Direct match:
  - `email` -> `Customer.email`
  - `whatsapp` -> `Customer.whatsapp`
  - `phone` -> `Customer.phone`
  - `zalo` -> `Customer.phone`
- Phone normalization chi ap dung cho `phone`, `whatsapp`, `zalo`.
- Cross-field fallback tim trong `email`, `phone`, `whatsapp`.
- Neu khong thay thi tao `Customer`.
- Khi tao/update chi backfill `email`, `whatsapp`, `phone`, `zalo`.

Rui ro quan trong: neu goi `resolveCustomer("facebook", "facebook:<psid>", ...)` hoac `resolveCustomer("instagram", "instagram:<sender_id>", ...)` voi code hien tai, resolver se tao Customer moi nhung khong luu external id vao field nao tren Customer. Lan message sau co the tao duplicate Customer truoc khi conversation cu duoc tim theo `customerContact`. Do do phase 1 nen mo rong resolver that nho bang `Customer.metadata`, hoac tim conversation theo `customerContact` truoc khi tao customer.

## 3. Diem tich hop phu hop cho Meta

### Nen tao `src/lib/channels/meta.ts`

Co. File nay nen chua logic rieng cua Meta:

- Verify webhook token.
- Parse webhook payload Facebook/Instagram thanh cac inbound events noi bo.
- Bo qua echo/self message.
- Chon channel `facebook` hoac `instagram`.
- Goi helper xu ly inbound chung.
- Gui response bang Meta Send API.
- Tuyet doi khong hard-code token.

Khong nen dat logic parse Meta vao `src/lib/ai/engine.ts`, `src/app/api/chat/route.ts`, hay cac file dashboard.

### Route webhook

Khuyen nghi phase dau:

- Tao route chinh: `src/app/api/webhooks/meta/route.ts`
  - `GET` verify `hub.mode`, `hub.verify_token`, `hub.challenge`
  - `POST` nhan payload Meta chung
- Chi tao `src/app/api/webhooks/instagram/route.ts` neu can callback URL rieng cho Instagram trong Meta dashboard. Neu tao, nen re-export/call chung handler cua `meta.ts`, khong copy logic.

Luu y quan trong: `src/proxy.ts` hien chi public cac webhook/channel paths:

- `/api/channels/phone/`
- `/api/channels/sms`
- `/api/channels/telegram`
- `/api/channels/zalo/incoming`

`/api/webhooks/meta` hien se bi auth/rate-limit nhu API noi bo. Phase 1 bat buoc them exception public cho route Meta webhook, va neu co `META_APP_SECRET` thi verify `x-hub-signature-256`.

### Nen co `handleExternalChannelMessage(...)`

Co, nhung can lam nho va an toan.

Hien logic resolve customer + find/create conversation + `chat(...)` bi lap trong WhatsApp, Email, Zalo, Telegram, SMS, Phone. De Meta khong lap nua, nen them helper moi, vi du:

```ts
handleExternalChannelMessage({
  channel: "facebook" | "instagram" | "whatsapp" | "zalo" | "email" | "sms" | "telegram",
  customerContact,
  customerName,
  text,
})
```

Helper nen:

- validate text/contact.
- resolve customer.
- find active/escalated conversation theo `channel + customerId/customerContact`.
- create conversation neu chua co.
- goi `chat(conversation.id, text)`.
- return `{ conversationId, response }`.

De khong pha WhatsApp, phase 1 co the:

1. Tao helper va dung cho Meta truoc.
2. Viet test cho helper.
3. Chua doi WhatsApp.
4. Sau khi test on dinh moi can can nhac migrate WhatsApp sang helper trong phase rieng.

### Channel va customerContact

Nen dung:

- `channel = "facebook"`
- `channel = "instagram"`

Nen luu `customerContact`:

- Facebook Messenger: `facebook:<psid>`
- Instagram Messaging: `instagram:<sender_id>`

Ly do:

- Khong bi collision giua PSID va Instagram sender id.
- Phu hop voi `Conversation.customerContact` string hien co.
- Khong can schema migration.
- De debug trong dashboard/export de hon.

Voi `Customer`, nen luu them vao `metadata`, vi du:

```json
{
  "externalContacts": {
    "facebook": "facebook:<psid>",
    "instagram": "instagram:<sender_id>"
  }
}
```

Neu khong mo rong resolver de match metadata, nen it nhat trong helper tim conversation theo `channel + customerContact` truoc de tranh tao duplicate Customer moi moi lan webhook den.

## 4. Thiet ke toi thieu khong pha code

### GET verify webhook

Route `GET /api/webhooks/meta`:

- Doc query:
  - `hub.mode`
  - `hub.verify_token`
  - `hub.challenge`
- Neu `hub.mode === "subscribe"` va token trung `process.env.META_VERIFY_TOKEN`, return plain text `hub.challenge`.
- Sai token return `403`.
- Thieu cau hinh return `500` hoac `403` ro rang.

### POST webhook

Route `POST /api/webhooks/meta`:

- Neu co `META_APP_SECRET`, verify `x-hub-signature-256` bang HMAC-SHA256 raw body truoc khi parse JSON.
- Parse payload `entry[].messaging[]`.
- Bo qua event khong co `message.text`.
- Bo qua `message.is_echo`.
- Parse:
  - `sender.id`
  - `recipient.id`
  - `message.text`
  - platform/channel suy ra tu `object` hoac route/token dang dung.
- Tao contact:
  - `facebook:${sender.id}` neu Facebook Page Messenger.
  - `instagram:${sender.id}` neu Instagram Messaging.
- Goi `handleExternalChannelMessage`.
- Gui response lai bang Send API tuong ung.
- Luon tra 200 cho payload hop le/da bo qua de Meta khong retry vo han.

### Send API

Can tach thanh function rieng:

- `sendFacebookMessage(psid, text)`
  - endpoint theo yeu cau: `https://graph.facebook.com/${version}/me/messages`
  - token: `FACEBOOK_PAGE_ACCESS_TOKEN`
- `sendInstagramMessage(senderId, text)`
  - endpoint theo yeu cau: `https://graph.instagram.com/${version}/me/messages`
  - token: `INSTAGRAM_ACCESS_TOKEN`

Khuyen nghi them abstraction:

```ts
sendMetaTextMessage({ channel, recipientId, text })
```

Token lay tu env, khong commit token, khong log token. Neu API tra loi loi, log status + error code nhung mask token.

## 5. Env variables can them

Them vao `.env.example` trong phase code:

```env
# ---- Meta / Facebook / Instagram Messaging ----
META_VERIFY_TOKEN="change-this-meta-webhook-verify-token"
META_GRAPH_VERSION="v21.0"
FACEBOOK_PAGE_ACCESS_TOKEN=""
INSTAGRAM_ACCESS_TOKEN=""
INSTAGRAM_BUSINESS_ACCOUNT_ID=""
META_APP_SECRET=""
```

Ghi chu:

- `META_VERIFY_TOKEN` bat buoc cho webhook verify.
- `META_GRAPH_VERSION` nen co default trong code neu thieu, nhung van nen khai bao.
- `FACEBOOK_PAGE_ACCESS_TOKEN` va `INSTAGRAM_ACCESS_TOKEN` bat buoc cho send reply.
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` co the can cho thiet lap/kiem tra account, nhung route receive/send text co the chua dung ngay.
- `META_APP_SECRET` nen dung de verify POST signature trong production.

## 6. File can tao/sua khi duoc phep code

Phase 1 de xuat:

- Tao:
  - `src/lib/channels/meta.ts`
  - `src/app/api/webhooks/meta/route.ts`
  - `tests/unit/meta-webhook.test.ts`
  - co the tao `src/lib/channels/external-message.ts` hoac `src/lib/channels/inbound.ts`
- Sua nho:
  - `src/proxy.ts`: public allowlist cho `/api/webhooks/meta` va neu co `/api/webhooks/instagram`.
  - `src/lib/customer-resolver.ts`: ho tro `facebook`/`instagram` bang `Customer.metadata`, hoac helper phai tranh duplicate customer.
  - `.env.example`: them env Meta.
  - `src/lib/validations.ts`: chi sua neu co API/dashboard route validate channel list lien quan.
- Tuy chon sau phase 1:
  - `src/app/api/channels/route.ts` va `[type]/route.ts`: them `facebook`, `instagram` neu muon hien thi/quan ly tren dashboard.
  - `src/lib/utils.ts`: label `Facebook`, `Instagram`.
  - UI dashboard channels/conversations/customers: chi dung neu user yeu cau hien icon/filter dep hon.

## 7. File khong nen dung trong phase dau

- `src/lib/ai/engine.ts`: khong sua neu chi tich hop Meta inbound/outbound, vi `chat(...)` da la diem goi AI/RAG dung.
- `src/app/api/chat/route.ts`: khong sua, tranh pha web/API chat.
- `prisma/schema.prisma`: khong doi neu dung `customerContact` + `Customer.metadata`.
- Dashboard UI:
  - `src/app/(dashboard)/channels/page.tsx`
  - `src/app/(dashboard)/conversations/page.tsx`
  - `src/app/(dashboard)/customers/page.tsx`
  - chi dung khi can hien thi/tuy chinh kenh Meta trong UI.
- WhatsApp flow:
  - `src/lib/channels/whatsapp.ts`
  - `src/app/api/channels/whatsapp/route.ts`
  - khong migrate sang helper trong cung phase neu chua co test bao ve.
- Email/CRM/RAG files khong lien quan.

## 8. Rui ro va guardrails

- Duplicate Customer cho Facebook/Instagram neu resolver khong luu/match external contact.
- `/api/webhooks/meta` se bi auth boi `src/proxy.ts` neu quen public allowlist.
- Meta webhook co the retry neu route tra non-2xx hoac xu ly AI qua lau. Phase dau co the sync, nhung production nen can nhac queue/background job neu timeout.
- `message.is_echo` neu khong bo qua se tao vong lap bot-tu-tra-loi.
- Instagram Messaging co dieu kien quyen/app review/platform policy rieng. Can test voi app/account that sau khi code.
- Access token khong duoc hard-code, khong log, khong dua vao `Channel.config` neu config do hien thi tren dashboard.
- `src/app/api/webhooks/*` dang la namespace cua webhook delivery noi bo. Static route `meta` van hop ly, nhung can ro rang trong docs/deployment de khong nham voi webhook outbound cua app.
- README noi Next.js 14 nhung package la Next 16.2.2. Khi code route moi can doc Next docs local theo `AGENTS.md`.

## 9. Checklist trien khai theo phase

### Phase 0 - Da lam trong tai lieu nay

- Khao sat architecture.
- Xac dinh flow chat/AI/RAG.
- Xac dinh diem noi Meta.
- Chua sua business logic.

### Phase 1 - Webhook + parser + send text toi thieu

- Doc docs Next local trong `node_modules/next/dist/docs/` truoc khi code route.
- Them env vao `.env.example`.
- Tao `src/lib/channels/meta.ts`.
- Tao parser payload Meta co unit test.
- Tao `handleExternalChannelMessage(...)` nho, dung cho Meta.
- Ho tro customer identity cho `facebook`/`instagram` khong doi schema.
- Tao `GET/POST /api/webhooks/meta`.
- Public allowlist route trong `src/proxy.ts`.
- Gui text response ve Meta Send API.
- Bo qua echo, non-text, payload la.
- Chay unit tests lien quan.

### Phase 2 - Instagram route/alias va hardening

- Neu can URL rieng, tao `/api/webhooks/instagram` dung chung handler.
- Verify `x-hub-signature-256` bang `META_APP_SECRET`.
- Them retry/logging co mask token.
- Them test signature va malformed payload.

### Phase 3 - Dashboard/support optional

- Them `facebook`, `instagram` vao channel list dashboard neu muon quan ly trang thai.
- Them labels/icons/colors.
- Cap nhat API docs noi bo.
- Khong bat buoc cho bot tra loi webhook.

### Phase 4 - Refactor chung optional

- Sau khi Meta on dinh, can nhac cho WhatsApp/Zalo/Telegram/Email/SMS dung chung helper.
- Lam tung kenh mot voi test regression, khong refactor lon.

## 10. Test plan

Unit tests toi thieu:

- Parser Facebook webhook:
  - payload `entry[].messaging[]` co `sender.id`, `recipient.id`, `message.text`.
  - expect event channel `facebook`, contact `facebook:<psid>`.
- Parser Instagram webhook:
  - payload tu Instagram messaging.
  - expect event channel `instagram`, contact `instagram:<sender_id>`.
- Echo:
  - `message.is_echo === true` bi bo qua, khong goi `chat`, khong send API.
- Verify route:
  - token dung tra plain `hub.challenge`.
  - token sai tra `403`.
- POST malformed:
  - payload thieu `entry`, thieu `messaging`, thieu text, attachment-only khong crash va tra 200/ignored.
- Conversation:
  - khi chua co conversation thi tao conversation moi voi `channel`, `customerContact`, `customerId`.
  - khi da co active/escalated conversation theo contact thi reuse.
- AI call:
  - mock `chat(...)` de assert duoc goi voi `conversation.id` va text.
- Send API:
  - mock `fetch`, assert endpoint/token lay tu env.
  - khong log token.
- Customer resolver:
  - resolve Facebook/Instagram khong tao duplicate customer cho cung contact.

Regression checks:

- `tests/api/chat.test.ts` van pass.
- `tests/unit/customer-resolver.test.ts` cap nhat va pass.
- WhatsApp route/connect/send khong bi sua trong phase 1.
- `/api/chat` khong thay doi behavior.

## 11. Ket luan de xuat

Huong tich hop an toan nhat la them Meta nhu mot external channel moi:

- Channel name: `facebook`, `instagram`.
- Contact format: `facebook:<psid>`, `instagram:<sender_id>`.
- Diem goi AI/RAG: giu nguyen `chat(conversation.id, text)`.
- Khong doi Prisma schema trong phase dau.
- Can mot helper inbound chung nho de tranh lap logic, nhung chua migrate WhatsApp ngay.
- Can sua rat nho `customer-resolver.ts` hoac helper de khong sinh duplicate Customer cho Meta.
- Can public allowlist webhook trong `src/proxy.ts`.

Chi nen bat dau code khi co lenh rieng: "bat dau code phase 1".
