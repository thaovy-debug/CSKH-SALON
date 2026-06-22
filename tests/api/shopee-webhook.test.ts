import { describe, expect, it, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

const processShopeeInboundEvent = vi.fn().mockResolvedValue({
  conversationId: "conv-shopee-1",
  response: "AI response",
  channelAccountId: "shopee-account-1",
  sent: true,
});

vi.mock("@/lib/channels/shopee", async () => {
  const actual = await vi.importActual<typeof import("@/lib/channels/shopee")>(
    "@/lib/channels/shopee"
  );
  return {
    ...actual,
    processShopeeInboundEvent,
  };
});

describe("Shopee webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.channelAccount.findFirst.mockReset();
    mockPrisma.channelAccount.update.mockReset();
    mockPrisma.channelAccount.findFirst.mockResolvedValue({
      id: "shopee-account-1",
      type: "shopee",
      externalAccountId: "1001",
      isActive: true,
      isDefault: true,
      config: { webhookSecret: "" },
      status: "authorized",
    });
    mockPrisma.channelAccount.update.mockResolvedValue({});
  });

  it("processes Shopee chat webhook payloads", async () => {
    const { POST } = await import("@/app/api/webhooks/shopee/route");
    const response = await POST(
      createRequest("/api/webhooks/shopee", {
        method: "POST",
        body: {
          code: "chat_push",
          shop_id: 1001,
          data: {
            buyer_id: 2002,
            conversation_id: "conv-1",
            message_id: "msg-1",
            message: { text: "Có LED dây COB không?" },
          },
        },
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, received: 1, processed: 1, sent: 1 });
    expect(processShopeeInboundEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        shopId: "1001",
        buyerId: "2002",
        conversationId: "conv-1",
        messageId: "msg-1",
        text: "Có LED dây COB không?",
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
    expect(JSON.stringify(mockPrisma.channelAccount.update.mock.calls)).not.toContain("Có LED dây COB không?");
  });

  it("ignores non-text or unsupported Shopee webhook payloads", async () => {
    const { POST } = await import("@/app/api/webhooks/shopee/route");
    const response = await POST(
      createRequest("/api/webhooks/shopee", {
        method: "POST",
        body: { code: "order_push", shop_id: 1001, data: { order_sn: "SN1" } },
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, received: 0, processed: 0, sent: 0 });
    expect(processShopeeInboundEvent).not.toHaveBeenCalled();
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
