# Shopee and TikTok Shop Channel API Research

Date: 2026-06-19

Scope: research only. No Shopee/TikTok runtime code, webhook route, Prisma schema, migration, prompt, crawler, or Knowledge Base behavior is changed in this phase.

## Executive Summary

Both Shopee Open Platform and TikTok Shop Open Platform appear feasible for commerce data integration. Based on official docs and official search snippets:

- Shopee supports product/listing, order, logistics, push/webhook style notifications, and chat management. Official snippets mention chat push notifications and manual/automatic chat messages.
- TikTok Shop Open Platform supports catalog/product, order, fulfillment/logistics, webhooks, and Customer Service APIs. Official snippets mention conversation/message APIs and `NEW_MESSAGE` webhook.
- TikTok for Developers is not the right surface for seller customer service chat. It focuses on login, sharing/posting, display/research/commercial content, and generic webhooks.
- TikTok API for Business is not the right surface for seller customer service chat. It is aimed at advertisers, campaign/reporting/business-center use cases.
- The strongest MVP path is product/order sync first for Shopee, then chat if approval/scope allows. TikTok Shop chat looks more explicitly documented, but it likely requires Partner Center approval and seller authorization before endpoint details can be verified.

Important caveat: several official docs are behind JavaScript, login, partner, or anti-bot access. This document does not claim production-ready endpoint contracts until verified with a real partner/seller account.

## Official Docs Found

### Shopee

- Shopee Open Platform: https://open.shopee.com/
- Shopee Push Mechanism: https://open.shopee.com/developer-guide/18
- Shopee API calls: https://open.shopee.com/developer-guide/16
- Shopee Authorization process: https://open.shopee.com/developer-guide/20
- Shopee Order Management: https://open.shopee.com/developer-guide/229
- Shopee Product Price guide: https://open.shopee.com/developer-guide/223
- Shopee Platform Partner Rules: https://open.shopee.com/developer-guide/34

### TikTok

- TikTok for Developers: https://developers.tiktok.com/
- TikTok Webhooks overview: https://developers.tiktok.com/doc/webhooks-overview/
- TikTok API for Business portal: https://business-api.tiktok.com/portal
- TikTok API for Business docs: https://business-api.tiktok.com/portal/docs
- TikTok Shop Partner Center overview: https://partner.tiktokshop.com/docv2/page/tts-api-concepts-overview
- TikTok Shop developer guide: https://partner.tiktokshop.com/docv2/page/tts-developer-guide
- TikTok Shop authorization overview: https://partner.tiktokshop.com/docv2/page/authorization-overview-202407
- TikTok Shop authorization guide: https://partner.tiktokshop.com/docv2/page/authorization-guide-202309
- TikTok Shop Order API overview: https://partner.tiktokshop.com/docv2/page/650b1b4bbace3e02b76d1011
- TikTok Shop Customer Service API overview: https://partner.tiktokshop.com/docv2/page/customer-service-api-overview
- TikTok Shop Create Conversation: https://partner.tiktokshop.com/docv2/page/create-conversation-202309
- TikTok Shop Get Conversations: https://partner.tiktokshop.com/docv2/page/get-conversations-202309
- TikTok Shop Get Conversation Messages: https://partner.tiktokshop.com/docv2/page/get-conversation-messages-202309
- TikTok Shop Send Message: https://partner.tiktokshop.com/docv2/page/send-message-202309
- TikTok Shop Get Message in Conversation: https://partner.tiktokshop.com/docv2/page/get-message-in-the-conversation-202412
- TikTok Shop Webhook configuration overview: https://partner.tiktokshop.com/docv2/page/configuration-guide
- TikTok Shop Delete Shop Webhook: https://partner.tiktokshop.com/docv2/page/delete-shop-webhook
- TikTok Shop Register as service partner: https://partner.tiktokshop.com/docv2/page/64f19887dc7f3e028d381064
- TikTok Shop developer onboarding: https://partner.tiktokshop.com/docv2/page/developer-onboarding

## Docs Blocked / Require Account

| Source | Status | Impact |
| --- | --- | --- |
| Shopee Open Platform developer guide pages | Some requests returned 403/error from browser fetch. Search snippets from official pages were visible. | Endpoint details, exact scopes, rate limits, and review workflow need verification in Shopee partner console. |
| TikTok Shop Partner Center docs | Pages are rendered as a JavaScript app and often show login/join prompts without full content in plain fetch. Official search snippets expose API names and selected details. | Endpoint paths, scopes, permission names, payload examples, and region restrictions need verification with real TikTok Shop Partner/Seller account. |
| TikTok API for Business docs | Portal is official, but many details require navigating the portal. Search snippets confirmed ads/business purpose. | Not a blocker for this integration because Business API is not the seller chat surface. |

## Shopee Findings

### Can Receive / Send Customer Chat?

Likely yes, subject to partner app approval and chat scope availability.

Official evidence:

- Shopee Open Platform search snippets mention "chat management" as one of the official documentation categories.
- The Push Mechanism official page snippet mentions `Chat Push` / `Webchat Push` as chat information notifications when supported shops receive messages.
- The API Calls official page snippet mentions chat actions such as pin/unpin chats, uploading images to chats, and sending manual and automatic chat messages.

Conclusion:

- Receive chat: likely supported through Shopee push/webchat push.
- Send chat/auto-reply: likely supported through Shopee chat management APIs.
- Production certainty: needs verification inside Shopee Open Platform with a real partner app, approved scopes, and LED1000 seller authorization.

### Product / Order / Logistics Data

Likely yes.

Official Shopee docs/search snippets reference:

- listing/product APIs.
- Order Management.
- logistics-related documentation categories.
- product price documentation with region notes.

Likely supported MVP features:

- product/listing sync.
- product price/stock read, subject to permissions.
- order lookup.
- order status/event sync through push mechanism.
- logistics/shipping lookup, subject to approved scopes.

### Auth / Token / Signing

Shopee Open Platform uses a partner-app model. The expected production auth pieces are:

- partner app registration.
- `partner_id`.
- `partner_key`.
- seller/shop authorization flow.
- `shop_id`.
- `access_token`.
- `refresh_token`.
- request signing.
- token refresh flow.

Official snippets and Shopee Open Platform common patterns point to signed API calls. Exact signing base string, token expiry, scopes, and refresh windows must be verified inside the current Shopee docs/app console.

### Webhooks / Push Events

Yes, likely through Shopee Push Mechanism.

Expected events to verify:

- chat push / webchat push.
- order status push.
- product/listing changes if available.
- logistics/shipping updates if available.

### App Review / Approval

Likely required for production app access and seller data scopes.

Needed from LED1000 / implementation team:

- Shopee seller account with admin permission.
- Shopee Open Platform partner/developer account.
- app registration.
- production approval for seller data and chat APIs.
- callback URL configured to HTTPS public endpoint.

### Region Support

Shopee Open Platform official snippets include region references with `VN`, and Shopee operates in Vietnam. Product-price docs snippets mention `SG/VN/TW/TH/PH/...`.

Conclusion: Vietnam support is likely, but exact API availability by module/scope must be verified in Shopee partner console.

### Shopee Can Be Used For

| Capability | Feasibility | Notes |
| --- | --- | --- |
| Product sync | High | Official docs include listing/product areas. |
| Order lookup | High | Official Order Management docs exist. |
| Order event webhook | Medium-High | Push mechanism exists; exact event topics need partner verification. |
| Logistics lookup | Medium-High | Official docs mention logistics category; exact scope needed. |
| Customer chat receive | Medium | Official snippet mentions Chat Push/Webchat Push. Verify topic and payload. |
| Customer chat send/auto-reply | Medium | Official snippet mentions manual/automatic chat messages. Verify permissions/review. |

## TikTok Findings

## TikTok for Developers

Purpose:

- Consumer/developer integrations: Login Kit, Share Kit, Content Posting API, Display API, Research Tools, Commercial Content API, webhooks, scopes.

Relevance to CSKH chatbot:

- Not the right surface for TikTok Shop seller support chat.
- Useful only if later the app needs TikTok login, profile/video display, content posting, or research/commercial-content reporting.

DM/customer chat:

- No official customer DM send/receive API for seller support was found in TikTok for Developers docs.
- Generic webhooks exist, but they are for TikTok developer app events and not the same as TikTok Shop buyer-seller messaging.

Product/order APIs:

- TikTok for Developers has Research API pages for TikTok Shop info/products/reviews, but these are research/public-data oriented, not seller operational APIs.

Auth/review:

- Uses TikTok Developer Portal app registration, OAuth/scopes, and app review depending on scopes.

Conclusion:

- Do not implement LED1000 customer support chatbot through TikTok for Developers unless a future requirement is about TikTok account login/content features, not Shop operations.

## TikTok API for Business

Purpose:

- Advertising and business-platform automation: Ads Manager, campaigns, ad groups, ads, reporting, Business Center, creative/material management, custom audiences.

Relevance to CSKH chatbot:

- Not the right surface for buyer/seller customer support chat.
- Not the right surface for TikTok Shop orders/products in Seller Center.

DM/customer chat:

- No seller customer chat receive/send capability found in the Business API docs reviewed.

Product/order APIs:

- Business API includes ad/catalog/product-set style advertising assets, not TikTok Shop seller orders/logistics.

Auth/review:

- TikTok for Business developer/account flow, advertiser access, app review/scopes depending on endpoints.

Conclusion:

- Avoid Business API for LED1000 CSKH chat. It belongs to ads/marketing automation, not marketplace support.

## TikTok Shop Open Platform

Purpose:

- Seller/shop operational integration for TikTok Shop: catalog/products, orders, fulfillment/logistics, customer service, webhooks, and authorization.

### Can Receive / Send Customer Chat?

Yes, official TikTok Shop Partner Center search snippets show Customer Service API endpoints:

- Customer Service API overview includes Create Conversation, Get Conversations, Get Conversation Messages, and Send Message.
- Send Message official page exists.
- Get Conversation Messages official page says it gets all messages in a buyer/shop conversation.
- Delete Shop Webhook official page snippet lists `NEW_MESSAGE` as a trigger when a new message is sent in a customer service conversation.

Conclusion:

- Receive chat: yes via webhook topic such as `NEW_MESSAGE`, subject to endpoint confirmation.
- Send chat/auto-reply: yes via Customer Service API `Send Message`, subject to seller token, scopes, and message policy.
- Production certainty: needs verification after Partner Center login because full docs are SPA/login-gated.

### Product / Order / Logistics Data

Likely yes.

Official snippets and docs show:

- TTS API concept overview for catalog/user/shop data.
- Order API overview for order list/details.
- product create/edit docs.
- fulfillment/logistics related update pages.
- region-specific shipping/logistics update snippets.

Expected supported MVP features:

- product/catalog read and possibly write/update.
- stock/inventory update or inventory webhooks.
- order list/detail.
- fulfillment/logistics/tracking.
- customer service conversation/message.

### Auth / Token / Signing

TikTok Shop Open Platform uses:

- Partner Center app.
- seller/shop authorization.
- seller access token.
- refresh token.
- request signing for TTS API requests.
- `x-tts-access-token` header for seller token on some endpoints, per official snippet.
- webhook signature in the `Authorization` header, per webhook configuration snippet.

Exact token lifetime, refresh endpoint, scopes, and signing algorithm must be verified in Partner Center.

### Webhooks / Events

Yes.

Official snippets mention:

- webhook configuration.
- incoming webhook notification validation via `Authorization` header signature.
- delete shop webhook by event topic.
- `NEW_MESSAGE` trigger.
- product/inventory related webhook updates.

### App Review / Approval

Likely required.

Needed:

- TikTok Shop Partner Center account.
- partner/service app registration.
- seller authorization from LED1000 shop.
- app review/approval for required scopes and customer service APIs.
- HTTPS callback URL.

### Region Support

Official TikTok Shop snippets mention Vietnam (`VN`) in several contexts:

- service partner registration target markets include `VN`.
- developer onboarding target market includes `VN`.
- product/create/edit snippets mention global/local sellers including `VN`.
- SEA market update snippets mention `VN`.

Conclusion: Vietnam support appears likely for TikTok Shop Open Platform, but exact Customer Service API availability for VN sellers must be verified with a real seller/partner account.

## Mapping Into Current Architecture

Current app pieces already fit both platforms:

- `NormalizedInboundMessage` already includes `shopee` and `tiktok_shop`.
- `processNormalizedInboundMessage()` can resolve customer, find/create conversation, and call `chat()`.
- `ChannelAccount` can represent one Shopee shop or TikTok Shop seller/shop.
- `Conversation.channelAccountId` can keep multiple shops/pages separated.

### Shopee Mapping

```ts
{
  channel: "shopee",
  externalAccountId: "<shop_id>",
  channelAccountId: "<internal ChannelAccount id>",
  externalCustomerId: "<buyer/user id>",
  customerContact: "shopee:<buyer/user id>",
  externalConversationId: "<conversation/thread id>",
  platformMessageId: "<message/event id>",
  text: "<message text>",
  rawPayload: "<sanitized payload only>",
  metadata: {
    provider: "shopee",
    shopId: "<shop_id>",
    eventType: "<push/event type>"
  }
}
```

### TikTok Shop Mapping

```ts
{
  channel: "tiktok_shop",
  externalAccountId: "<shop/seller id>",
  channelAccountId: "<internal ChannelAccount id>",
  externalCustomerId: "<buyer/user id>",
  customerContact: "tiktok_shop:<buyer/user id>",
  externalConversationId: "<conversation/thread id>",
  platformMessageId: "<message/event id>",
  text: "<message text>",
  rawPayload: "<sanitized payload only>",
  metadata: {
    provider: "tiktok_shop",
    shopId: "<shop/seller id>",
    eventType: "<webhook topic>"
  }
}
```

## Feasibility Matrix

| Platform/API | Product read | Order read | Order webhook | Receive chat | Send chat | Auth complexity | App review | VN support known? | Feasibility | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Shopee Open Platform | Yes, likely | Yes | Likely via Push | Likely via Chat/Webchat Push | Likely via chat APIs | High | Likely required | Likely yes | Medium-High | Good commerce fit; chat endpoint details and scopes need partner verification. |
| TikTok Shop Open Platform | Yes, likely | Yes | Yes, webhook topics exist | Yes, `NEW_MESSAGE` topic indicated | Yes, Customer Service `Send Message` exists | High | Likely required | Likely yes | High for Shop if approved | Best TikTok surface for seller CSKH; docs need Partner Center verification. |
| TikTok for Developers | No operational seller product API | No seller order API | Generic developer webhooks only | No seller chat found | No seller chat found | Medium | Depends on scopes | Global product varies | Low for CSKH | Good for login/posting/display/research, not buyer-seller support. |
| TikTok API for Business | Advertising/catalog assets only | No seller order API | Ads/business events, not Shop order webhook | No seller chat found | No seller chat found | Medium-High | Required for ads access | Business/ads support varies | Low for CSKH | Use only for ads/reporting, not LED1000 support chatbot. |

## Recommended MVP Path

### Recommended First Platform

Start with Shopee if LED1000 already has an active Shopee seller account and the lead's primary requirement is multi-account marketplace support for Vietnamese customers.

Reason:

- Shopee is established in Vietnam/SEA.
- Product/order sync is usually valuable even if chat approval takes longer.
- Existing repo already has a `shopee` account type in `src/lib/channels/accounts.ts`.
- Current UI/architecture appears closer to Shopee readiness than TikTok Shop runtime.

### If Chat API Is Blocked By Approval

Do not block the whole integration.

Build MVP in this order:

1. Partner/seller connection and token storage.
2. Product/listing sync.
3. Order lookup and order status sync.
4. Webhook/push verification.
5. Chat receive/send only after scope approval and payload verification.

### TikTok Shop Path

TikTok Shop should be the second marketplace integration unless LED1000 specifically prioritizes TikTok Shop sales.

TikTok Shop Customer Service API appears more explicitly documented for conversations/messages, so it is promising. Still, it likely needs Partner Center approval and full seller authorization before implementation details are reliable.

## Credentials / Access Needed From LED1000

### Shopee

- Shopee seller/admin account for LED1000.
- Shopee Open Platform partner/developer account, or permission to create one.
- Partner app credentials: `partner_id`, `partner_key`.
- Seller authorization approval flow for LED1000 shop.
- `shop_id`.
- `access_token`, `refresh_token`.
- Approved scopes/modules:
  - product/listing.
  - order.
  - logistics.
  - push/webhook.
  - chat/customer service, if available.
- HTTPS public callback URL.
- Confirmation of allowed auto-reply/chatbot policy under Shopee rules.

### TikTok Shop

- TikTok Shop seller/admin account for LED1000.
- TikTok Shop Partner Center developer/service partner account.
- Partner app credentials: app key/client key/app secret depending on Partner Center naming.
- Seller authorization for LED1000 shop.
- shop/seller id.
- seller `access_token`, `refresh_token`.
- Approved scopes/modules:
  - products/catalog.
  - orders.
  - fulfillment/logistics.
  - webhooks.
  - Customer Service API.
- HTTPS public callback URL.
- Confirmation that Customer Service API and `NEW_MESSAGE` webhook are available for VN shop.
- Confirmation of TikTok Shop messaging policies for automated replies.

## Security Requirements

For both platforms:

- Store OAuth/access tokens encrypted or at least masked in admin responses.
- Never print tokens, partner keys, app secrets, request signatures, or refresh tokens in logs.
- Implement refresh token rotation and failure alerts.
- Sign outbound API requests exactly as platform docs require.
- Verify webhook signatures before processing events.
- Require HTTPS public webhook URLs.
- Implement idempotency by platform event id/message id.
- Handle at-least-once webhook delivery and duplicate events.
- Apply rate-limit and retry/backoff handling.
- Separate per-shop/per-page account config using `ChannelAccount`.
- Mask sensitive fields in `ChannelAccount.config`.
- Persist only sanitized raw payload fragments when needed for debugging.
- Keep platform send APIs behind a dedicated adapter, not inside the normalized inbound processor.

## Risks

- Official docs are partially blocked by login/Partner Center/SPA access; exact endpoint contracts need account verification.
- Chat/customer-service scopes may require production app review and may be restricted by region, seller type, or app category.
- Marketplace messaging policies may restrict fully automated replies or require human takeover.
- Token expiry/refresh can break production unless monitored.
- Webhook retries require idempotency; without it, duplicate messages could create duplicate replies.
- Product/order data may include personal information, so privacy and retention rules matter.
- Shopee/TikTok Shop outbound replies require separate send adapters; normalized inbound alone is not enough.

## Next Implementation Phase Suggestion

Phase 7.1 should be a credential/access validation phase, not full runtime.

Suggested steps:

1. Confirm with LED1000 whether Shopee or TikTok Shop is higher priority.
2. Obtain partner/seller sandbox or production developer access.
3. Verify official endpoint docs after login.
4. Document exact scopes, token lifetime, signing algorithm, webhook signature, and rate limits.
5. Add sanitized `ChannelAccount` config fields for selected platform if current JSON shape is enough.
6. Build a no-runtime proof using mocked payload fixtures:
   - webhook signature verify helper.
   - payload adapter to `NormalizedInboundMessage`.
   - idempotency plan.
7. Only after that, implement real webhook route and outbound send adapter.

## Research Answers

1. Can receive/send chat through Shopee?
   - Likely yes. Official Shopee snippets mention Chat Push/Webchat Push and sending manual/automatic chat messages. Needs verification with real partner app and approved scopes.

2. Can receive/send chat through TikTok Shop?
   - Yes, based on official TikTok Shop snippets showing Customer Service APIs, Send Message, conversation message APIs, and `NEW_MESSAGE` webhook. Needs Partner Center verification.

3. Can product/order/logistics data be accessed?
   - Shopee: likely yes for product/listing/order/logistics modules.
   - TikTok Shop: likely yes for product/catalog, orders, fulfillment/logistics.
   - TikTok for Developers / Business API: not suitable for seller operations.

4. Are webhook/push events available?
   - Shopee: likely yes through Push Mechanism.
   - TikTok Shop: yes, official snippets mention webhook configuration and event topics.
   - TikTok for Developers: generic webhooks exist but not seller chat/order.

5. What account/authorization is needed?
   - Partner/developer account, platform app, seller/shop authorization, access token, refresh token, app secret/partner key, approved scopes, HTTPS callback.

6. Vietnam/SEA support?
   - Shopee: likely yes; official snippets include `VN`.
   - TikTok Shop: likely yes; official snippets include `VN` target market and SEA updates.

7. Which platform first?
   - Start Shopee first if LED1000 already prioritizes Shopee and wants Vietnam marketplace coverage. If the lead specifically prioritizes chat and has TikTok Shop Partner access ready, TikTok Shop Customer Service API is also a strong candidate.
