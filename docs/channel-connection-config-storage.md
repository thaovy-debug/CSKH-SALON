# Channel Connection Config Storage

## Purpose

This document records how channel connection settings are stored and exposed after the current multi-account and Zalo relay hardening phases. The goal is to keep multi-account channels manageable, avoid leaking secrets to the browser, and make the current Zalo relay path safer without changing the Prisma schema or adding Shopee/TikTok runtime code.

This phase is storage and hardening only. It does not change chatbot prompts, crawler behavior, Knowledge Base import, or database schema.


## Readiness and go-live language

The API Docs page now treats channel setup as staged readiness instead of a binary connected/not-connected state.

Important wording:

```txt
Authorized != production-ready.
Connected != proof that a real customer can receive a bot reply.
```

Use these high-level readiness labels when speaking with lead/customer:

- Web widget / API: available when deployment, auth, AI provider, and Knowledge Base are stable.
- Facebook / Instagram: near-ready only after real Meta webhook/send E2E and app permission checks.
- Zalo Python relay: current operational relay/session-cookie mode, not official OA API.
- Zalo Official OA: future phase, not current runtime.
- Shopee: pre-E2E ready; requires real Seller account, Open Platform Partner App, approved scopes, webhook receive, send reply, token refresh, idempotency, and fallback checks before production-ready.
- TikTok Shop: pre-E2E inbound scaffold; requires real Partner Center app, Customer Service/message scopes, official webhook/signature contract, send-message endpoint, token behavior, and real buyer chat E2E before production-ready.
- WhatsApp, Email, Phone/Twilio, SMS, Telegram: available or partial depending on configured credentials and real provider E2E tests.

The app cannot bypass seller verification, business/tax/bank checks, app review, partner approval, API scopes, or platform policy. It also must not store or expose raw secrets, signatures, raw webhook payloads, or buyer personal data in debug metadata.

## Current database models

`Settings` stores global application settings and several legacy/default integration credentials, including AI, email, phone/Twilio, WhatsApp, and Telegram fields. These values are masked before being sent to the client through the settings API.

`Channel` stores one row per channel type. It is still useful for default channel state, single-account compatibility, and channel-level status. Its `config` JSON may contain connection values for older or default integrations.

`ChannelAccount` stores per-page, per-OA, per-shop, or per-account connection settings. It is the preferred model for multi-account channels such as Facebook pages, Instagram accounts, Zalo accounts, and future marketplace accounts. Its `config` JSON can hold provider-specific values.

`Conversation.channelAccountId` links a conversation to the exact connected account where the customer message arrived. This is what keeps two pages or OAs on the same platform from mixing threads.

## Channel vs ChannelAccount

Use `Channel` when the app needs a channel-level switch, default status, or backward compatibility with an existing single-account flow.

Use `ChannelAccount` when one tenant can connect multiple external identities on the same platform. Examples are multiple Facebook pages, Instagram accounts, Zalo accounts/OAs, Shopee shops, or TikTok Shop sellers.

For new multi-account work, the preferred shape is:

```txt
Channel: type, default active/status/config
ChannelAccount: type, displayName, externalAccountId, isDefault, isActive, config, status
Conversation: channel, channelAccountId, customerContact, metadata
```

## Current Zalo connection flow

Zalo currently uses a local Python relay/session-cookie style integration rather than an official OA API adapter.

The dashboard stores Zalo connection configuration in `Channel.config` for the default channel and in `ChannelAccount.config` for connected accounts. The Zalo route can sync cookie input into local runtime session files through `syncZaloSessionFiles()`.

Inbound messages arrive at `/api/channels/zalo/incoming`. The relay payload can include `accountId`. When `accountId` is present, the route resolves the matching `ChannelAccount` by internal id or `externalAccountId`, then scopes the customer contact with that account. This prevents messages from different Zalo accounts from collapsing into the same conversation.

When no `accountId` is present, the route keeps the legacy default behavior for compatibility.

## Current Zalo config fields

Recommended Zalo config fields:

```json
{
  "accountId": "zalo-account-or-oa-id",
  "oaId": "optional-oa-id",
  "displayName": "Display name for staff",
  "pythonCommand": "python",
  "scriptPath": "scripts/zalo_bot.py",
  "cookiesInput": "secret-cookie-json-or-text",
  "relaySecret": "shared-secret-between-python-relay-and-next-api"
}
```

`cookiesInput` and `relaySecret` are secrets. They must be stored server-side only and must not be returned to the browser as raw values.

## Zalo Python relay / Session cookies

This is the currently available integration mode. It uses `zalo_bot.py`, runtime session files, cookies/imei, and optional `relaySecret`.

Recommended config:

```json
{
  "accountId": "zalo-account-or-oa-id",
  "oaId": "optional-oa-id",
  "displayName": "LED1000 Zalo",
  "pythonCommand": "python",
  "scriptPath": "zalo_bot.py",
  "cookiesInput": "secret",
  "relaySecret": "secret"
}
```

Use this relay for the current Zalo integration. It depends on session cookies and a Python relay process. The official OA adapter is not included in the current product flow and should be designed as a separate future phase if the team decides to pursue it.

## Secret masking policy

The API should never return raw connection secrets to the browser. It should return safe flags such as `hasCookiesInput`, `hasRelaySecret`, `hasPageAccessToken`, `hasAppSecret`, `hasSmtpPass`, or `hasBotToken`.

Secret-like fields include:

```txt
cookiesInput
relaySecret
pageAccessToken
accessToken
refreshToken
apiKey
whatsappApiKey
appSecret
clientSecret
partnerKey
secretKey
webhookSecret
smtpPass
imapPass
twilioToken
botToken
telegramBotToken
elevenLabsKey
```

When an update request sends a blank or masked value for a secret field, the server preserves the existing stored secret. This lets the UI update non-secret fields without accidentally clearing working credentials.

## Zalo relay security

Phase 7.1 adds optional shared-secret validation for Zalo relay inbound requests.

If the resolved Zalo `ChannelAccount.config.relaySecret` is set, `/api/channels/zalo/incoming` requires this request header:

```txt
x-zalo-relay-secret: <configured relay secret>
```

The comparison uses a timing-safe comparison and logs only the account id, not the secret.

If no relay secret is configured, the route keeps backward-compatible behavior and accepts the request as before. For production, configure a relay secret for every Zalo account. The Python relay must send `x-zalo-relay-secret` when `relaySecret` is configured. The Next.js spawn flow passes this value to the relay through `ZALO_RELAY_SECRET`; the relay must not print or persist that value in logs.

## Recommended config shape per platform

### Zalo

Store per-account Zalo values in `ChannelAccount.config`:

```json
{
  "accountId": "zalo-account-or-oa-id",
  "oaId": "optional-oa-id",
  "displayName": "LED1000 Zalo",
  "pythonCommand": "python",
  "scriptPath": "scripts/zalo_bot.py",
  "cookiesInput": "secret",
  "relaySecret": "secret"
}
```

Use `externalAccountId` as the stable Zalo account/OA id when available. Use `relaySecret` for inbound relay authentication.

### Facebook / Instagram

Store page or business account values in `ChannelAccount.config`:

```json
{
  "pageId": "facebook-page-id",
  "businessAccountId": "instagram-business-account-id",
  "verifyToken": "non-secret-or-rotatable-token",
  "graphVersion": "v20.0",
  "pageAccessToken": "secret",
  "accessToken": "secret",
  "appSecret": "secret"
}
```

Use `externalAccountId` for the page id or business account id. Keep tokens masked in all client responses.

### WhatsApp

Until WhatsApp is fully multi-account, channel-level config can remain in `Channel.config` or `Settings`. For future multi-account WhatsApp, prefer `ChannelAccount.config`:

```json
{
  "phoneNumberId": "provider-phone-number-id",
  "businessAccountId": "business-account-id",
  "phoneNumber": "+84000000000",
  "apiKey": "secret",
  "webhookSecret": "secret"
}
```

### Email

Email can remain in `Settings` for a single mailbox. For multiple mailboxes, use `ChannelAccount.config`:

```json
{
  "smtpHost": "smtp.example.com",
  "smtpPort": "587",
  "smtpUser": "support@example.com",
  "smtpFrom": "support@example.com",
  "smtpPass": "secret",
  "imapHost": "imap.example.com",
  "imapPort": "993",
  "imapUser": "support@example.com",
  "imapPass": "secret"
}
```

### Phone / Twilio

Phone and SMS currently use default settings. For multiple numbers, use `ChannelAccount.config`:

```json
{
  "twilioSid": "account-sid-or-subaccount-sid",
  "twilioPhone": "+84000000000",
  "twilioToken": "secret",
  "elevenLabsVoice": "optional-voice-id",
  "elevenLabsKey": "secret"
}
```

### Shopee Pre-E2E Runtime

Shopee uses `ChannelAccount.config` only. No Prisma schema change is required for the current pre-E2E runtime scaffold.

Config shape:

```json
{
  "shopId": "shopee-shop-id",
  "partnerId": "partner-id",
  "partnerKey": "secret",
  "accessToken": "secret",
  "refreshToken": "secret",
  "tokenExpiresAt": "iso-date",
  "refreshTokenExpiresAt": "iso-date",
  "webhookSecret": "secret",
  "integrationStatus": "authorized",
  "lastWebhookAt": "iso-date",
  "lastWebhookParseStatus": "parsed",
  "lastWebhookPayloadKeys": ["code", "data", "shop_id"],
  "lastWebhookBuyerIdPresent": true,
  "lastWebhookTextPresent": true,
  "lastChatReceiveAt": "iso-date",
  "lastChatSendAt": "iso-date",
  "lastShopeeIdempotencyKey": "shopee:shop-id:message-id"
}
```

Use `externalAccountId` as `shopId`. `partnerKey`, `accessToken`, `refreshToken`, and `webhookSecret` are secrets and must be masked in client responses. Safe webhook debug metadata can be stored in config, but raw webhook payloads, raw message text, headers, signatures, and buyer PII must not be stored or logged.

Pre-production gaps remain: durable storage-backed idempotency, scheduler/monitoring for token refresh, rate-limit/backoff policy, and a real Shopee Seller/Partner App end-to-end chat test.

### TikTok Shop pre-E2E scaffold

TikTok Shop uses `ChannelAccount.config` only. The app supports `type=tiktok_shop`, masked account config, safe webhook debug metadata, and inbound customer-service message handoff into `processNormalizedInboundMessage()`. Real OAuth/callback and outbound send must still be verified with TikTok Shop Partner Center before go-live.

Suggested config shape:

```json
{
  "shopId": "tiktok-shop-id",
  "sellerId": "seller-id",
  "appKey": "app-or-client-key",
  "clientKey": "app-or-client-key",
  "appSecret": "secret",
  "accessToken": "secret",
  "refreshToken": "secret",
  "webhookSecret": "secret",
  "apiBaseUrl": "https://open-api.tiktokglobalshop.com",
  "authBaseUrl": "https://services.tiktokshop.com",
  "sendMessagePath": "verified-send-message-path"
}
```

Use `externalAccountId` as `shopId` or `sellerId`, depending on the stable id exposed by TikTok Shop APIs. `appSecret`, `accessToken`, `refreshToken`, and `webhookSecret` are secrets and must be masked in client responses. Safe webhook debug metadata can be stored in config, but raw webhook payloads, raw message text, headers, signatures, and buyer PII must not be stored or logged.

Pre-production gaps remain: exact Partner Center Customer Service API scope verification, OAuth/callback implementation, official signature rule confirmation, outbound send adapter verification, durable storage-backed idempotency, token refresh scheduler/monitoring, rate-limit/backoff policy, and a real TikTok Shop Seller end-to-end buyer chat test.
## Rules for future channels

1. Prefer `ChannelAccount.config` for any platform that supports multiple pages, accounts, shops, sellers, mailboxes, or phone numbers.
2. Store secrets server-side only and return boolean `has*` flags to the client.
3. Preserve existing secrets when an update sends blank or masked secret values.
4. Include a stable `externalAccountId` for every connected account.
5. Pass `channelAccountId` into normalized inbound message processing whenever possible.
6. Keep raw payloads out of persistent metadata unless sanitized.
7. Add tests for secret masking, secret preservation, inbound account routing, and unauthorized webhook/relay requests.
8. Do not add marketplace runtime until account storage, OAuth/token refresh, webhook verification, and outbound reply contracts are designed together.

## Open questions

- Should Zalo inbound fail closed when no `relaySecret` is configured in production, or remain backward-compatible permanently?
- Should default `Channel.config` be migrated into `ChannelAccount.config` for every active channel during a future schema-safe cleanup phase?
- Should encrypted-at-rest storage be added for JSON config secrets instead of plain database JSON values?
- Should the dashboard show last rotation time or credential age for important channel secrets?
- Which stable id should be canonical for TikTok Shop: shop id, seller id, or open account id?
