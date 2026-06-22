import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

vi.mock("@/lib/channels/normalized", () => ({
  processNormalizedInboundMessage: vi.fn().mockResolvedValue({
    conversationId: "conv-telegram-1",
    response: "Telegram AI response",
    customerId: "cust-telegram-1",
  }),
}));

describe("Telegram channel route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.settings.findFirst.mockReset();
    mockPrisma.settings.findFirst.mockResolvedValue({ telegramBotToken: "" });
  });

  it("maps Telegram text updates to the normalized channel processor", async () => {
    const { POST } = await import("@/app/api/channels/telegram/route");
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");

    const response = await POST(
      createRequest("/api/channels/telegram", {
        method: "POST",
        body: {
          update_id: 987,
          message: {
            message_id: 123,
            from: {
              id: 456,
              first_name: "Khách",
              last_name: "Telegram",
              username: "khach_led",
            },
            chat: {
              id: 456,
              type: "private",
            },
            text: "Tôi cần LED dây ngoài trời",
            date: 1760000000,
          },
        },
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(processNormalizedInboundMessage).toHaveBeenCalledWith({
      channel: "telegram",
      externalCustomerId: "456",
      customerContact: "telegram:456",
      externalConversationId: "456",
      platformMessageId: "123",
      customerName: "Khách Telegram",
      text: "Tôi cần LED dây ngoài trời",
      metadata: {
        updateId: 987,
        chatType: "private",
        username: "khach_led",
      },
    });
  });

  it("ignores Telegram non-text messages and keeps the webhook response contract", async () => {
    const { POST } = await import("@/app/api/channels/telegram/route");
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");

    const response = await POST(
      createRequest("/api/channels/telegram", {
        method: "POST",
        body: {
          update_id: 988,
          message: {
            message_id: 124,
            from: {
              id: 456,
              first_name: "Khách",
            },
            chat: {
              id: 456,
              type: "private",
            },
            photo: [{ file_id: "photo-1" }],
            date: 1760000001,
          },
        },
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true });
    expect(processNormalizedInboundMessage).not.toHaveBeenCalled();
  });
});
