# Normalized Channel Flow

## Purpose

Phase 6B adds a shared inbound message layer for channel integrations. The target flow is:

```txt
platform event / relay / webhook
-> normalize inbound message
-> processNormalizedInboundMessage()
-> resolve customer
-> find or create conversation
-> call chat()
-> return response
```

This phase is intentionally narrow. It does not add Shopee or TikTok Shop runtime handling, does not change Prisma schema, and does not modify chatbot prompts, crawler logic, or Knowledge Base import behavior.

## NormalizedInboundMessage

`src/lib/channels/normalized.ts` defines `NormalizedInboundMessage` as the common shape for inbound channel events.

Supported channel values are:

```txt
facebook, instagram, zalo, whatsapp, email, phone, sms, telegram, shopee, tiktok_shop, widget, api
```

Important fields:

- `channel`: normalized platform/channel name.
- `externalCustomerId`: platform customer/user/buyer id.
- `customerContact`: contact key used for customer and conversation matching; if omitted, the handler falls back to `externalCustomerId`.
- `externalAccountId`: source page, OA, shop, seller, or account id from the external platform.
- `channelAccountId`: internal connected-account id. This keeps conversations separated when one tenant connects multiple pages/accounts on the same channel.
- `externalConversationId`: thread/conversation id from the external platform, if available.
- `platformMessageId`: platform message/event id, if available.
- `attachments`: safe attachment metadata/count input for future channel-specific processing.
- `rawPayload`: allowed at type level for future debugging/adapters, but the normalized processor does not persist or log raw payloads.
- `metadata`: small safe metadata object copied into new conversation metadata.

## processNormalizedInboundMessage Flow

`processNormalizedInboundMessage(input)` performs the reusable inbound steps:

1. Validate channel against the supported union.
2. Trim and reject empty message text.
3. Validate that at least `externalCustomerId` or `customerContact` is available.
4. Resolve/create the customer through `resolveCustomer(channel, contact, name)`.
5. Look for an active or escalated conversation by `channel`, optional `channelAccountId`, and `customerContact`.
6. Fall back to active/escalated conversation lookup by resolved `customerId` or `customerContact`.
7. Create a new conversation through `createNewConversation()` when no active conversation exists.
8. Store safe conversation metadata such as external account id, external conversation id, platform message id, received time, and attachment count.
9. Call `chat(conversation.id, text)`.
10. Return `{ conversationId, response, customerId }`.

The function rejects with clear errors for empty text, missing customer identity/contact, or unsupported channels.

## Backward Compatibility

`src/lib/channels/external-message.ts` keeps the existing `handleExternalChannelMessage()` API for current callers.

The wrapper now maps its legacy input into `NormalizedInboundMessage`, then delegates to `processNormalizedInboundMessage()`. The wrapper still returns the old shape:

```ts
{
  conversationId: string;
  response: string;
}
```

This keeps the existing Facebook, Instagram, and Zalo relay/webhook tests compatible while putting the shared logic in one place.

## Channels Migrated in Phase 6B

Migrated through the backward-compatible wrapper:

- Facebook
- Instagram
- Zalo

These routes already call or can continue to call `handleExternalChannelMessage()` without changing their external behavior.

Migrated directly in Phase 6B.1:

- SMS/Twilio inbound
- Telegram inbound

SMS keeps the existing TwiML response contract. Telegram keeps the existing `{ ok: true }` webhook response contract and still sends a Bot API reply when a bot token is configured.

Migrated in Phase 6B.2:

- `/api/chat` new-conversation path for web widget/API/direct chat requests.

When `/api/chat` receives an existing `conversationId`, it still calls `chat(conversationId, message)` directly. This preserves the public widget and API test harness contract. The widget script is unchanged and still receives `{ conversationId, response }`.

Scaffolded after Phase 6B:

- Shopee Open Platform seller chat scaffold: account config, masked secrets, authorization callback, webhook receiver, normalized inbound mapping, and outbound send adapter are implemented. Production still requires a real Shopee Seller/Partner App E2E test, approved scopes, token refresh validation, webhook signature configuration, and rate-limit/backoff verification.
- TikTok Shop scaffold: account config, masked secrets, webhook receiver, and normalized inbound mapping are implemented. Outbound send is intentionally blocked until the Customer Service send-message contract is verified in TikTok Shop Partner Center.

## Channels Not Yet Migrated

Not migrated in runtime yet:

- WhatsApp
- Email
- Phone/Twilio

The normalized type supports these values, but their runtime handlers should migrate one by one with focused tests. This avoids rewriting working integrations all at once.

Shopee and TikTok Shop are no longer type-only, but they are still not production-ready without real marketplace E2E verification. Their webhook routes must remain public at the proxy layer and must use configured webhook/app secrets before go-live.

## How Shopee/TikTok Use This Pattern

Shopee and TikTok Shop webhook/relay code should adapt platform payloads into `NormalizedInboundMessage` before calling `processNormalizedInboundMessage()`.

Suggested mapping:

- `channel`: `shopee` or `tiktok_shop`.
- `externalAccountId`: shop id, seller id, or connected account id from the platform.
- `channelAccountId`: internal connected-account database id for the selected shop/account.
- `externalCustomerId`: buyer id or user id.
- `customerContact`: stable buyer/contact key. If the platform does not expose phone/email, use a prefixed buyer key such as `shopee:<buyerId>`.
- `externalConversationId`: platform conversation/thread id when available.
- `platformMessageId`: platform message/event id.
- `text`: normalized incoming text.
- `attachments`: safe attachment descriptors when present.
- `metadata`: small safe fields needed for routing or diagnostics.
- `rawPayload`: keep available only inside the adapter layer; avoid persisting or logging it unless sanitized.

Recommended hardening order:

1. Verify official webhook signature rules and require a configured secret before production.
2. Run real seller-account E2E: buyer sends message, app creates conversation, staff/AI reply is delivered to buyer.
3. Add durable idempotency storage for platform message IDs.
4. Validate token refresh windows and add scheduler/monitoring.
5. Tune rate-limit/backoff from real provider error responses.
