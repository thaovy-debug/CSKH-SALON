import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  createTikTokShopIdempotencyKey,
  getTikTokShopAccountReadiness,
  parseTikTokShopWebhookPayload,
  verifyTikTokShopWebhookSignature,
} from "@/lib/channels/tiktok-shop";

describe("TikTok Shop channel helpers", () => {
  it("verifies webhook signatures with timing-safe HMAC", () => {
    const rawBody = JSON.stringify({ shop_id: 1001, text: "hello" });
    const signature = crypto.createHmac("sha256", "webhook-secret").update(rawBody).digest("hex");

    expect(
      verifyTikTokShopWebhookSignature({
        rawBody,
        signatureHeader: signature,
        secret: "webhook-secret",
      })
    ).toBe(true);
    expect(
      verifyTikTokShopWebhookSignature({
        rawBody,
        signatureHeader: "bad",
        secret: "webhook-secret",
      })
    ).toBe(false);
  });

  it("parses tolerant TikTok Shop customer service message payloads", () => {
    const events = parseTikTokShopWebhookPayload({
      type: "NEW_MESSAGE",
      shop_id: 1001,
      data: {
        buyer_id: 2002,
        conversation_id: "conv-1",
        message_id: "msg-1",
        message: { text: "Có đèn pha LED không?" },
        buyer_name: "Khách TikTok",
      },
    });

    expect(events).toEqual([
      expect.objectContaining({
        shopId: "1001",
        buyerId: "2002",
        conversationId: "conv-1",
        messageId: "msg-1",
        text: "Có đèn pha LED không?",
        eventType: "NEW_MESSAGE",
        customerName: "Khách TikTok",
      }),
    ]);
  });

  it("creates stable idempotency keys for the same TikTok Shop message", () => {
    const event = { shopId: "1001", messageId: "msg-1", conversationId: "conv-1" };

    expect(createTikTokShopIdempotencyKey(event)).toBe("tiktok_shop:1001:msg-1");
    expect(createTikTokShopIdempotencyKey(event)).toBe(createTikTokShopIdempotencyKey({ ...event }));
  });

  it("reports missing credentials without treating config as production-ready", () => {
    expect(getTikTokShopAccountReadiness({ shopId: "1001" })).toEqual({
      ok: false,
      missing: ["appKey/clientKey", "appSecret", "accessToken", "refreshToken"],
    });
    expect(
      getTikTokShopAccountReadiness({
        shopId: "1001",
        appKey: "app-key",
        appSecret: "app-secret",
        accessToken: "access-token",
        refreshToken: "refresh-token",
      })
    ).toEqual({ ok: true, missing: [] });
  });
});
