import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  buildShopeeShopAuthUrl,
  createShopeeIdempotencyKey,
  createShopeeSign,
  isShopeeTokenExpiringSoon,
  parseShopeeWebhookPayload,
  verifyShopeeWebhookSignature,
} from "@/lib/channels/shopee";

describe("Shopee channel helpers", () => {
  it("creates OpenAPI v2 HMAC signatures", () => {
    const input = {
      partnerId: "123456",
      partnerKey: "partner-secret",
      path: "/api/v2/shop/auth_partner",
      timestamp: 1710000000,
    };
    const expected = crypto
      .createHmac("sha256", input.partnerKey)
      .update(`${input.partnerId}${input.path}${input.timestamp}`)
      .digest("hex");

    expect(createShopeeSign(input)).toBe(expected);
  });

  it("builds shop authorization URLs without exposing partner key", () => {
    const url = new URL(
      buildShopeeShopAuthUrl({
        partnerId: "123456",
        partnerKey: "partner-secret",
        redirectUrl: "https://example.com/api/channels/shopee/auth/callback?accountId=acc-1",
        authBaseUrl: "https://partner.shopeemobile.com",
        timestamp: 1710000000,
      })
    );

    expect(url.pathname).toBe("/api/v2/shop/auth_partner");
    expect(url.searchParams.get("partner_id")).toBe("123456");
    expect(url.searchParams.get("timestamp")).toBe("1710000000");
    expect(url.searchParams.get("redirect")).toContain("accountId=acc-1");
    expect(url.toString()).not.toContain("partner-secret");
    expect(url.searchParams.get("sign")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies webhook signatures with timing-safe HMAC", () => {
    const rawBody = JSON.stringify({ shop_id: 1001, text: "hello" });
    const signature = crypto.createHmac("sha256", "webhook-secret").update(rawBody).digest("hex");

    expect(
      verifyShopeeWebhookSignature({ rawBody, signatureHeader: signature, secret: "webhook-secret" })
    ).toBe(true);
    expect(
      verifyShopeeWebhookSignature({ rawBody, signatureHeader: "bad", secret: "webhook-secret" })
    ).toBe(false);
  });

  it("parses tolerant Shopee chat push payloads", () => {
    const events = parseShopeeWebhookPayload({
      code: "chat_push",
      shop_id: 1001,
      data: {
        buyer_id: 2002,
        conversation_id: "conv-1",
        message_id: "msg-1",
        message: { text: "Có nguồn 12V không?" },
        buyer_name: "Khách Shopee",
      },
    });

    expect(events).toEqual([
      expect.objectContaining({
        shopId: "1001",
        buyerId: "2002",
        conversationId: "conv-1",
        messageId: "msg-1",
        text: "Có nguồn 12V không?",
        eventType: "chat_push",
        customerName: "Khách Shopee",
      }),
    ]);
  });
  it("creates stable idempotency keys for the same Shopee message", () => {
    const event = { shopId: "1001", messageId: "msg-1", conversationId: "conv-1" };

    expect(createShopeeIdempotencyKey(event)).toBe("shopee:1001:msg-1");
    expect(createShopeeIdempotencyKey(event)).toBe(createShopeeIdempotencyKey({ ...event }));
  });

  it("detects Shopee tokens that are close to expiry", () => {
    const now = new Date("2026-06-21T00:00:00.000Z");

    expect(
      isShopeeTokenExpiringSoon(
        { tokenExpiresAt: "2026-06-21T00:05:00.000Z" },
        now
      )
    ).toBe(true);
    expect(
      isShopeeTokenExpiringSoon(
        { tokenExpiresAt: "2026-06-21T01:00:00.000Z" },
        now
      )
    ).toBe(false);
    expect(isShopeeTokenExpiringSoon({}, now)).toBe(false);
  });
});
