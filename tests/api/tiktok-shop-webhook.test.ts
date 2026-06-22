import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const processTikTokShopInboundEvent = vi.fn().mockResolvedValue({
  conversationId: "conv-tiktok-1",
  response: "AI response",
  channelAccountId: "tiktok-account-1",
  sent: false,
  sendSkippedReason: "send_adapter_requires_partner_center_verification",
});

vi.mock("@/lib/channels/tiktok-shop", async () => {
  const actual = await vi.importActual<typeof import("@/lib/channels/tiktok-shop")>(
    "@/lib/channels/tiktok-shop"
  );
  return {
    ...actual,
    processTikTokShopInboundEvent,
  };
});

describe("TikTok Shop webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.channelAccount.findFirst.mockReset();
    mockPrisma.channelAccount.update.mockReset();
    mockPrisma.channelAccount.findFirst.mockResolvedValue({
      id: "tiktok-account-1",
      type: "tiktok_shop",
      externalAccountId: "1001",
      isActive: true,
      isDefault: true,
      config: { webhookSecret: "" },
      status: "config_saved",
    });
    mockPrisma.channelAccount.update.mockResolvedValue({});
  });

  it("processes TikTok Shop customer service message payloads", async () => {
    const { POST } = await import("@/app/api/webhooks/tiktok-shop/route");
    const response = await POST(
      createRequest("/api/webhooks/tiktok-shop", {
        method: "POST",
        body: {
          type: "NEW_MESSAGE",
          shop_id: 1001,
          data: {
            buyer_id: 2002,
            conversation_id: "conv-1",
            message_id: "msg-1",
            message: { text: "Có nguồn 24V không?" },
          },
        },
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, received: 1, processed: 1, sent: 0 });
    expect(processTikTokShopInboundEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: "1001",
        buyerId: "2002",
        conversationId: "conv-1",
        messageId: "msg-1",
        text: "Có nguồn 24V không?",
      })
    );
    expect(mockPrisma.channelAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "webhook_verified",
          config: expect.objectContaining({
            lastWebhookParseStatus: "parsed",
            lastWebhookShopId: "1001",
            lastWebhookMessageId: "msg-1",
            lastWebhookConversationId: "conv-1",
            lastWebhookBuyerIdPresent: true,
            lastWebhookTextPresent: true,
          }),
        }),
      })
    );
    expect(JSON.stringify(mockPrisma.channelAccount.update.mock.calls)).not.toContain("Có nguồn 24V không?");
  });

  it("ignores non-text or unsupported TikTok Shop webhook payloads", async () => {
    const { POST } = await import("@/app/api/webhooks/tiktok-shop/route");
    const response = await POST(
      createRequest("/api/webhooks/tiktok-shop", {
        method: "POST",
        body: { type: "ORDER_STATUS", shop_id: 1001, data: { order_id: "order-1" } },
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, received: 0, processed: 0, sent: 0 });
    expect(processTikTokShopInboundEvent).not.toHaveBeenCalled();
    expect(mockPrisma.channelAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "webhook_verified",
          config: expect.objectContaining({
            lastWebhookParseStatus: "unsupported",
            lastWebhookShopId: "1001",
            lastWebhookBuyerIdPresent: false,
            lastWebhookTextPresent: false,
          }),
        }),
      })
    );
  });
});
