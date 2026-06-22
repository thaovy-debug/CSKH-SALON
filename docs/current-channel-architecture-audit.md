# Current Channel Architecture Audit

## Executive summary

Phase 6A audits the current channel architecture before adding TikTok/Shopee. This document is based on source inspection only. No external API was called, no `.env` secret was read, and no runtime channel configuration was changed.

The current app has three channel integration styles:

1. `web_widget` and `/api/chat`: direct HTTP chat entrypoint that creates/reuses a conversation and calls `chat()`.
2. Runtime platform handlers that receive messages, run AI, and reply: Meta, Zalo relay, WhatsApp Web, Email IMAP, Phone/Twilio, SMS, Telegram.
3. Channel configuration and account management: `Channel` for default config and `ChannelAccount` for multiple page/account records.

The strongest reusable pattern for Shopee/TikTok is the Meta/Zalo normalized handoff:

```txt
platform webhook / relay
-> verify platform token/signature
-> normalize payload
-> resolve customer
-> find/create conversation
-> chat(conversationId, text)
-> send outbound reply if supported
-> log status/errors
```

The biggest gaps before adding more commerce/social channels are idempotency, raw inbound payload persistence, a generalized normalized inbound interface, and consistent outbound retry/error handling outside Meta and custom outbound webhooks.

## Channel matrix

| Channel | UI config | Inbound webhook | Outbound send | Calls AI chat() | Auth/signature | Secret handling | Status | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `web_widget` | Partial. Embed script configurable by script attributes; generic `widget` channel exists in APIs. | No platform webhook. Browser widget calls `/api/chat`. | Response returned in same HTTP response. | Yes, through `/api/chat` -> `chat()`. | No widget-specific auth/signature. | No channel secret. | implemented | Direct web chat entrypoint. Uses `customerName: Website Visitor`, channel `widget`. |
| `facebook` | Yes. Channel settings plus multi-account `ChannelAccount`. | Yes: `src/app/api/webhooks/meta/route.ts`, Meta `object=page`. | Yes: Meta Send API through `sendMetaTextMessage()`. | Yes through `handleExternalChannelMessage()`. | GET verify token. POST `x-hub-signature-256` if app secret exists. | Yes; access token/app secret are not returned raw. | implemented | Text events only. Echo/non-text ignored. Contact format: `facebook:<pageId>:<senderId>`. |
| `instagram` | Yes. Channel settings plus multi-account `ChannelAccount`. | Yes: same Meta webhook route, Meta `object=instagram`. | Yes: Instagram Graph send endpoint through `sendMetaTextMessage()`. | Yes through `handleExternalChannelMessage()`. | Same Meta verify/signature strategy. | Yes. | implemented | Text events only. Contact format: `instagram:<businessAccountId>:<senderId>`. |
| `zalo` | Yes. Channel card and multi-account records with cookies/script path. | Partial. No `/api/webhooks/zalo`; inbound relay is `/api/channels/zalo/incoming` called by local `zalo_bot.py`. | Yes through Python bot commands (`send`, `send-image`). | Yes through `handleExternalChannelMessage()`. | No HTTP signature on `/api/channels/zalo/incoming` found. | Yes for account `cookiesInput`. | partial | Practical local relay works, but public webhook hardening is weaker than Meta/Twilio. |
| `whatsapp` | Yes. WhatsApp card supports Web/API mode in UI. | No Cloud API webhook found. Inbound comes from `whatsapp-web.js` `client.on("message")`. | Yes through `message.reply()` and `sendWhatsAppMessage()`. | Yes inside `src/lib/channels/whatsapp.ts`. | WhatsApp Web QR/session auth. | Settings masks `whatsappApiKey`; Web mode mainly uses local auth state. | implemented | Implemented as WhatsApp Web, not WhatsApp Cloud API. |
| `email` | Yes in Settings/Channels. SMTP/IMAP config. | No webhook. Inbound is IMAP listener. | Yes via SMTP/nodemailer. | Yes inside `processEmail()`. | IMAP/SMTP credentials. | Settings mask `smtpPass` and `imapPass`. | implemented | Auto-replies by email. No durable retry queue for failed SMTP send. |
| `phone/twilio` | Yes in Settings/Channels. | Yes: `/api/channels/phone/incoming`, `/gather`, `/status`. | Yes as TwiML voice response. | Yes in `handleSpeechInput()`. | Twilio signature validation if `twilioToken` is configured. | Settings mask `twilioToken`. | implemented | Voice call flow. Manual text reply is blocked for phone conversations. |

Additional observed channels:

| Channel | Status | Notes |
| --- | --- | --- |
| `sms` | partial | `/api/channels/sms` handles Twilio SMS webhook, verifies Twilio signature if token exists, calls `chat()`, returns TwiML `<Message>`. Not exposed as a primary Channels UI card in inspected page. |
| `telegram` | partial | `/api/channels/telegram` handles Telegram webhook update, calls `chat()`, sends via Bot API if token exists. No signature verification found. Not exposed as a primary Channels UI card. |
| `shopee` | ui-only/stub | `ChannelAccount` helper and Channels UI contain Shopee account fields/secret masking, but no Shopee runtime/webhook/send implementation was found. |

## Current shared channel flow

Most active channels eventually call `chat(conversationId, text)` from `src/lib/ai/engine.ts`.

```txt
load settings and AI config
-> load conversation and recent messages
-> search Knowledge Base
-> save inbound/customer message
-> evaluate automation rules
-> call Gemini model fallback chain
-> save assistant message
-> update conversation timestamp/status
-> emit realtime event
-> return response
```

The normalized helper currently exists for only:

```ts
type ExternalChannel = "facebook" | "instagram" | "zalo";
```

`handleExternalChannelMessage()` handles:

```txt
trim/validate contact and text
-> find existing active/escalated conversation by channel + channelAccountId + customerContact
-> resolve customer
-> fallback find by customerId/contact
-> create conversation if missing
-> chat(conversation.id, text)
-> return conversationId + response
```

This is the best current reuse target for TikTok/Shopee, but it should be generalized first.

## Web widget

Files inspected:

- `public/widget/owly-chat.js`
- `src/app/api/chat/route.ts`
- `src/lib/ai/engine.ts`

Flow:

```txt
public/widget/owly-chat.js
-> fetch(<server>/api/chat, { message, conversationId, channel: "widget" })
-> /api/chat validates message and length
-> createNewConversation(channel || "api", ...)
-> chat(conversationId, message)
-> return { conversationId, response }
```

Findings:

- Implemented for direct web chat.
- No platform signature/auth on widget requests.
- No outbound API because response is synchronous HTTP.
- No customer identity capture beyond optional request fields.

## Facebook Messenger

Files inspected:

- `src/app/api/webhooks/meta/route.ts`
- `src/lib/channels/meta.ts`
- `src/lib/channels/external-message.ts`
- `src/lib/channels/accounts.ts`
- `tests/api/meta-webhook.test.ts`
- `tests/unit/meta.test.ts`

Flow:

```txt
Meta GET verification
-> load verify tokens from env + Channel + ChannelAccount config
-> return challenge if token matches

Meta POST webhook
-> read raw body
-> verify x-hub-signature-256 against app secret candidates if configured
-> parse object=page as facebook
-> ignore echo/non-text/non-message events
-> build contact facebook:<recipientPageId>:<senderId>
-> find matching ChannelAccount by page id
-> handleExternalChannelMessage()
-> sendMetaTextMessage()
-> log processed event
```

Implemented:

- Inbound webhook: yes.
- Outbound send: yes.
- Calls AI: yes.
- Signature: yes if app secret exists; unsigned is accepted when no app secret candidates exist.
- Timeout: per-event timeout via `withTimeout()` and `META_WEBHOOK_EVENT_TIMEOUT_MS`.
- Retry: outbound send retries network errors, 429, and 5xx.
- Secret masking: yes.

Gaps:

- No persisted idempotency key for Meta message IDs.
- Raw inbound payload/event is not persisted.
- Text-only support.

## Instagram DM

Files inspected: same Meta files as Facebook.

Flow:

```txt
Meta POST webhook
-> parse object=instagram
-> ignore echo/non-text/non-message events
-> build contact instagram:<businessAccountId>:<senderId>
-> find matching ChannelAccount
-> handleExternalChannelMessage()
-> sendMetaTextMessage() through graph.instagram.com
```

Status: implemented.

Gaps:

- Same as Facebook: no durable idempotency, no raw payload storage, text-only.
- Customer profile name/avatar is not fetched; default name is `Instagram User`.

## Zalo

Files inspected:

- `src/lib/channels/zalo.ts`
- `src/app/api/channels/zalo/route.ts`
- `src/app/api/channels/zalo/incoming/route.ts`
- `tests/api/zalo-incoming.test.ts`

Flow:

```txt
Channels UI/API
-> save cookies/script path
-> startZaloBot()
-> write runtime session files
-> spawn Python bot

Python bot inbound relay
-> POST /api/channels/zalo/incoming
-> extract message/authorId/threadId/phoneNumber/accountId/displayName
-> find ChannelAccount if accountId exists
-> build scoped contact zalo:<sourceAccountId>:<customerContact>
-> handleExternalChannelMessage()
-> return AI response JSON
```

Outbound:

```txt
/api/channels/zalo action=send or multipart image send
-> sendZaloMessage() / sendZaloImageMessage()
-> spawn Python bot command with session env
```

Status: partial.

Gaps:

- Inbound route has no signature/token check.
- No platform webhook verification equivalent to Meta/Twilio.
- No retry queue for outbound send.
- No raw inbound payload persistence or idempotency.
- Runtime depends on local Python process/session cookies.

## WhatsApp

Files inspected:

- `src/lib/channels/whatsapp.ts`
- `src/app/api/channels/whatsapp/route.ts`
- `src/app/api/conversations/[id]/messages/route.ts`

Flow:

```txt
/api/channels/whatsapp action=connect
-> initWhatsApp()
-> whatsapp-web.js Client + LocalAuth
-> QR/auth/ready events update in-memory status + Channel status

Incoming message
-> client.on("message")
-> ignore fromMe
-> resolve customer
-> find/create conversation
-> include media marker if media exists
-> chat(conversation.id, messageContent)
-> message.reply(aiResponse)
```

Manual outbound:

```txt
dashboard POST /api/conversations/:id/messages
-> if conversation.channel === "whatsapp"
-> POST /api/channels/whatsapp action=send
-> sendWhatsAppMessage()
```

Status: implemented as WhatsApp Web.

Gaps:

- No WhatsApp Cloud API webhook found.
- No retry/backoff for `message.reply()` or manual `sendWhatsAppMessage()`.
- Session/auth state is local to runtime.
- UI has API mode fields, but inspected runtime path uses Web client.

## Email

Files inspected:

- `src/lib/channels/email.ts`
- `src/app/api/channels/email/route.ts`
- `src/app/api/conversations/[id]/messages/route.ts`

Flow:

```txt
/api/channels/email action=connect
-> startEmailListener()
-> IMAP connect
-> imap.on("mail")
-> search UNSEEN
-> parse mail
-> resolve customer by email
-> find/create conversation
-> chat(conversation.id, "Subject: ...")
-> send SMTP reply via nodemailer
```

Status: implemented.

Gaps:

- No inbound webhook; it is IMAP listener.
- No durable retry queue for failed SMTP replies.
- No message-id idempotency persistence found.
- IMAP listener is in-memory/runtime-local.

## Phone / Twilio

Files inspected:

- `src/lib/channels/phone.ts`
- `src/app/api/channels/phone/incoming/route.ts`
- `src/app/api/channels/phone/gather/route.ts`
- `src/app/api/channels/phone/status/route.ts`
- `src/lib/twilio-verify.ts`

Flow:

```txt
Twilio Voice incoming call
-> POST /api/channels/phone/incoming
-> verify Twilio signature if twilioToken exists
-> handleIncomingCall(from, callSid)
-> create CallLog
-> resolve customer
-> find/create phone conversation
-> return TwiML Gather callback

Twilio speech gather
-> POST /api/channels/phone/gather?conversationId=...&callSid=...
-> verify Twilio signature if token exists
-> handleSpeechInput()
-> chat(conversationId, SpeechResult)
-> return TwiML Say/Gather

Twilio status
-> POST /api/channels/phone/status
-> verify Twilio signature if token exists
-> update CallLog on completed/failed/no-answer
```

Status: implemented for voice call.

Gaps:

- `getPhoneStatus()` currently returns `configured: false, status: "disconnected"` regardless of settings.
- Manual text reply to phone conversations is blocked.
- No recording/transcription storage path found beyond `CallLog.recording`/`summary` fields.

## Schema and data model audit

Relevant models:

- `Settings`: global business/AI/channel credentials for AI, SMTP/IMAP, Twilio, WhatsApp, Telegram.
- `Channel`: one row per channel type, string `type`, `isActive`, JSON `config`, string `status`.
- `ChannelAccount`: multi-account table for `facebook`, `instagram`, `zalo`, currently UI-level `shopee`; includes `externalAccountId`, `displayName`, JSON `config`.
- `Conversation`: string `channel`, optional `channelAccountId`, `customerName`, `customerContact`, JSON `metadata`, optional `customerId`.
- `Message`: role/content/media fields; no explicit direction enum, external platform message id, or raw payload column.
- `Customer`: direct fields for email/phone/whatsapp and generic JSON `metadata`; social external ids are stored in metadata by `customer-resolver`.
- `Webhook` / `WebhookDelivery`: custom outbound webhooks and delivery tracking, not platform inbound webhook storage.
- `CallLog`: Twilio call status/duration/recording/summary.

Answers:

- Channel config is stored in both `Channel.config` and `ChannelAccount.config`; older/global settings also store some credentials in `Settings`.
- There is no Prisma enum channel type. Channel type is a string.
- Conversation links to a channel through `Conversation.channel` and optionally to a page/account through `Conversation.channelAccountId`.
- Customer external ids for Facebook/Instagram/Zalo are stored in `Customer.metadata.externalContacts`.
- Message direction/type is represented by string `Message.role`: `customer`, `assistant`, `admin`, `system`.
- Raw platform payload is not stored on `Message` or a dedicated inbound-event table.
- Schema is flexible enough to add Shopee/TikTok without immediate migration if metadata/config is sufficient, but production-grade commerce channels need standardized external ids, raw payload audit, idempotency, and attachment/order metadata structure.

## Security and reliability audit

| Area | Current state | Gap / risk |
| --- | --- | --- |
| Meta verify token | Implemented for GET; checks env and DB tokens. | Good if production tokens are configured. |
| Meta signature | Implemented if app secret exists. | If no app secret is configured, unsigned POST is accepted. |
| Twilio signature | Implemented for phone and SMS if `twilioToken` exists. | If token missing, routes accept unsigned requests. |
| Zalo inbound auth | No signature/token check found on `/api/channels/zalo/incoming`. | Add internal relay secret/HMAC before exposing publicly. |
| WhatsApp inbound auth | WhatsApp Web local session, no webhook. | Runtime/session-local, fragile for scaling. |
| Email auth | IMAP/SMTP credentials. | No webhook; retry/idempotency should be separate. |
| Telegram auth | Bot token used for outbound; no webhook secret validation found. | Add path token/header check if used publicly. |
| Secret masking | Implemented for Settings, Meta channel config, ChannelAccount, Zalo cookies, Shopee tokens. | Keep all new platform secrets in masked account config. |
| Retry handling | Meta outbound retries; custom outbound webhooks have retry/backoff. | WhatsApp/Zalo/Email/Twilio/Telegram/SMS lack shared durable retry. |
| Timeout guard | Meta webhook event has `withTimeout()`; custom outbound webhooks use `AbortController`. | Other inbound handlers do not have comparable timeout guard. |
| Idempotency | Echo guard exists for Meta/WhatsApp fromMe. | No persisted duplicate-event detection. |
| Raw payload logging | Error logs exist; outbound webhook delivery stores payload. | Inbound platform raw payloads are not durably stored. |

## Reusable patterns for Shopee/TikTok

Suggested future files:

```txt
src/lib/channels/shopee.ts
src/lib/channels/tiktok-shop.ts
src/app/api/webhooks/shopee/route.ts
src/app/api/webhooks/tiktok-shop/route.ts
```

Recommended normalized interface:

```ts
type NormalizedInboundMessage = {
  channel:
    | "facebook"
    | "instagram"
    | "zalo"
    | "whatsapp"
    | "email"
    | "phone"
    | "shopee"
    | "tiktok_shop";
  externalConversationId: string;
  externalCustomerId: string;
  externalAccountId?: string;
  channelAccountId?: string | null;
  customerName?: string;
  text: string;
  attachments?: unknown[];
  rawPayload: unknown;
  platformMessageId?: string;
  receivedAt?: string;
};
```

Recommended flow:

```txt
webhook
-> verify platform signature/token
-> parse and normalize payload
-> reject/ignore unsupported or duplicate event
-> find ChannelAccount by external account/shop id
-> find/create customer
-> find/create conversation
-> save inbound message and raw event metadata
-> chat(conversationId, text)
-> send outbound reply if platform supports
-> store delivery result/error
```

Implementation guidance:

- Reuse `ChannelAccount` for shop/page/account records.
- Reuse `externalAccountId` for Shopee shop id or TikTok Shop seller/shop id.
- Reuse `Conversation.channelAccountId` to separate conversations by shop/page.
- Generalize `handleExternalChannelMessage()` instead of duplicating customer/conversation/chat code.
- Add idempotency before enabling public commerce webhooks.
- Keep platform secrets masked using the `ChannelAccount` pattern.

## Gaps before adding new channels

1. Create a channel-neutral normalized inbound handler instead of limiting `handleExternalChannelMessage()` to `facebook | instagram | zalo`.
2. Add platform event id/idempotency storage or at least a dedupe strategy.
3. Decide where to store raw inbound payloads safely.
4. Standardize outbound delivery status and retry across all channels.
5. Make webhook signature/token enforcement explicit for production.
6. Decide attachment and order metadata format for commerce channels.
7. Clarify whether Shopee/TikTok should auto-reply or create tickets first.
8. Add tests for normalized flow before adding platform-specific routes.

## Recommended next steps

1. Phase 6B: define `NormalizedInboundMessage` and `processNormalizedInboundMessage()`.
2. Phase 6C: add idempotency and raw inbound event audit storage.
3. Phase 6D: harden Zalo incoming relay with an internal secret/HMAC.
4. Phase 6E: implement Shopee webhook as the first commerce channel using the normalized handler.
5. Phase 6F: implement TikTok Shop after Shopee pattern is validated.

## Open questions

1. Should Shopee/TikTok auto-reply immediately, or create conversations/tickets for staff approval first?
2. Which commerce events matter first: chat messages, order questions, cancellation/return requests, or review comments?
3. Should raw inbound payloads be stored fully, partially redacted, or only referenced by platform event id?
4. Should missing webhook secrets fail closed in production even if development allows unsigned requests?
5. Is WhatsApp Web acceptable long term, or should it be replaced by WhatsApp Cloud API?
6. Should Zalo remain cookie/Python-bot based, or migrate to official OA API where available?

## Files inspected

- `public/widget/owly-chat.js`
- `src/app/api/chat/route.ts`
- `src/app/api/webhooks/meta/route.ts`
- `src/app/api/webhooks/route.ts`
- `src/app/api/webhooks/[id]/route.ts`
- `src/app/api/webhooks/[id]/deliveries/route.ts`
- `src/app/api/webhooks/test/route.ts`
- `src/app/api/channels/route.ts`
- `src/app/api/channels/[type]/route.ts`
- `src/app/api/channels/whatsapp/route.ts`
- `src/app/api/channels/email/route.ts`
- `src/app/api/channels/zalo/route.ts`
- `src/app/api/channels/zalo/incoming/route.ts`
- `src/app/api/channels/phone/incoming/route.ts`
- `src/app/api/channels/phone/gather/route.ts`
- `src/app/api/channels/phone/status/route.ts`
- `src/app/api/channels/sms/route.ts`
- `src/app/api/channels/telegram/route.ts`
- `src/app/api/channel-accounts/route.ts`
- `src/app/api/channel-accounts/[id]/route.ts`
- `src/app/api/conversations/[id]/messages/route.ts`
- `src/app/api/settings/route.ts`
- `src/app/(dashboard)/channels/page.tsx`
- `src/app/(dashboard)/settings/page.tsx`
- `src/app/(dashboard)/api-docs/page.tsx`
- `src/lib/channels/accounts.ts`
- `src/lib/channels/config.ts`
- `src/lib/channels/email.ts`
- `src/lib/channels/external-message.ts`
- `src/lib/channels/hardening.ts`
- `src/lib/channels/meta.ts`
- `src/lib/channels/phone.ts`
- `src/lib/channels/sms.ts`
- `src/lib/channels/telegram.ts`
- `src/lib/channels/whatsapp.ts`
- `src/lib/channels/zalo.ts`
- `src/lib/ai/engine.ts`
- `src/lib/customer-resolver.ts`
- `src/lib/twilio-verify.ts`
- `src/lib/webhook-delivery.ts`
- `src/lib/realtime.ts`
- `src/lib/prisma.ts`
- `src/lib/security.ts`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `tests/api/channels.test.ts`
- `tests/api/meta-webhook.test.ts`
- `tests/api/zalo-incoming.test.ts`
- `tests/unit/meta.test.ts`
- `tests/unit/external-message.test.ts`
- `tests/unit/customer-resolver.test.ts`
- `tests/unit/twilio-verify.test.ts`
- `tests/unit/webhook-delivery.test.ts`
- `tests/unit/security.test.ts`
