import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { chat, createNewConversation } from "@/lib/ai/engine";
import { resolveCustomer } from "@/lib/customer-resolver";

vi.mock("@/lib/ai/engine", () => ({
  chat: vi.fn().mockResolvedValue("AI reply"),
  createNewConversation: vi.fn().mockResolvedValue({ id: "created-conv" }),
}));

vi.mock("@/lib/customer-resolver", () => ({
  resolveCustomer: vi.fn().mockResolvedValue("cust-1"),
}));

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe("handleExternalChannelMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.conversation.findFirst.mockReset();
    mockPrisma.conversation.findFirst.mockResolvedValue(null);
    vi.mocked(chat).mockResolvedValue("AI reply");
    vi.mocked(createNewConversation).mockResolvedValue({ id: "created-conv" });
    vi.mocked(resolveCustomer).mockResolvedValue("cust-1");
  });

  it("processNormalizedInboundMessage creates conversation for new contact", async () => {
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");

    const result = await processNormalizedInboundMessage({
      channel: "facebook",
      externalCustomerId: "psid-1",
      externalAccountId: "page-1",
      customerContact: "facebook:page-1:psid-1",
      customerName: "Facebook User",
      text: " Hello ",
      platformMessageId: "mid-1",
    });

    expect(resolveCustomer).toHaveBeenCalledWith(
      "facebook",
      "facebook:page-1:psid-1",
      "Facebook User"
    );
    expect(createNewConversation).toHaveBeenCalledWith(
      "facebook",
      "Facebook User",
      "facebook:page-1:psid-1",
      "cust-1",
      {
        channelAccountId: undefined,
        metadata: {
          externalAccountId: "page-1",
          platformMessageId: "mid-1",
        },
      }
    );
    expect(chat).toHaveBeenCalledWith("created-conv", "Hello");
    expect(result).toEqual({
      conversationId: "created-conv",
      response: "AI reply",
      customerId: "cust-1",
    });
  });

  it("processNormalizedInboundMessage reuses active conversation for same channel/account/contact", async () => {
    mockPrisma.conversation.findFirst.mockResolvedValueOnce({
      id: "existing-conv",
      channel: "facebook",
      customerContact: "facebook:psid-1",
    });

    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");

    const result = await processNormalizedInboundMessage({
      channel: "facebook",
      externalCustomerId: "psid-1",
      channelAccountId: "account-1",
      customerContact: "facebook:psid-1",
      customerName: "Facebook User",
      text: " Hello ",
    });

    expect(resolveCustomer).toHaveBeenCalledWith(
      "facebook",
      "facebook:psid-1",
      "Facebook User"
    );
    expect(mockPrisma.conversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          channel: "facebook",
          channelAccountId: "account-1",
          customerContact: "facebook:psid-1",
        }),
      })
    );
    expect(createNewConversation).not.toHaveBeenCalled();
    expect(chat).toHaveBeenCalledWith("existing-conv", "Hello");
    expect(result).toEqual({
      conversationId: "existing-conv",
      response: "AI reply",
      customerId: "cust-1",
    });
  });

  it("handleExternalChannelMessage wrapper still works for facebook", async () => {
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");

    const result = await handleExternalChannelMessage({
      channel: "facebook",
      customerContact: "facebook:page-1:psid-1",
      customerName: "Facebook User",
      sourceAccountId: "page-1",
      text: "Hello",
    });

    expect(createNewConversation).toHaveBeenCalledWith(
      "facebook",
      "Facebook User",
      "facebook:page-1:psid-1",
      "cust-1",
      {
        channelAccountId: undefined,
        metadata: {
          externalAccountId: "page-1",
          sourceAccountId: "page-1",
        },
      }
    );
    expect(chat).toHaveBeenCalledWith("created-conv", "Hello");
    expect(result.conversationId).toBe("created-conv");
  });

  it("handleExternalChannelMessage wrapper still works for instagram", async () => {
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");

    const result = await handleExternalChannelMessage({
      channel: "instagram",
      customerContact: "instagram:business-1:sender-1",
      customerName: "Instagram User",
      text: "Can I book?",
    });

    expect(createNewConversation).toHaveBeenCalledWith(
      "instagram",
      "Instagram User",
      "instagram:business-1:sender-1",
      "cust-1"
    );
    expect(chat).toHaveBeenCalledWith("created-conv", "Can I book?");
    expect(result.conversationId).toBe("created-conv");
  });

  it("handleExternalChannelMessage wrapper still works for zalo", async () => {
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");

    const result = await handleExternalChannelMessage({
      channel: "zalo",
      customerContact: "zalo:oa-led1000:user-1",
      customerName: "Khách Zalo",
      channelAccountId: "zalo-account-1",
      sourceAccountId: "oa-led1000",
      text: "Tư vấn nguồn LED",
    });

    expect(createNewConversation).toHaveBeenCalledWith(
      "zalo",
      "Khách Zalo",
      "zalo:oa-led1000:user-1",
      "cust-1",
      {
        channelAccountId: "zalo-account-1",
        metadata: {
          externalAccountId: "oa-led1000",
          sourceAccountId: "oa-led1000",
        },
      }
    );
    expect(chat).toHaveBeenCalledWith("created-conv", "Tư vấn nguồn LED");
    expect(result.conversationId).toBe("created-conv");
  });

  it("missing or empty text rejects safely", async () => {
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");

    await expect(
      processNormalizedInboundMessage({
        channel: "facebook",
        externalCustomerId: "psid-1",
        text: " ",
      })
    ).rejects.toThrow("Message text is required");
  });

  it("missing externalCustomerId/customerContact rejects safely", async () => {
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");

    await expect(
      processNormalizedInboundMessage({
        channel: "facebook",
        externalCustomerId: "",
        text: "Hello",
      })
    ).rejects.toThrow("Customer contact or external customer ID is required");
  });

  it("channelAccountId keeps conversations separated by account", async () => {
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");

    await processNormalizedInboundMessage({
      channel: "facebook",
      externalCustomerId: "psid-1",
      customerContact: "facebook:page-2:psid-1",
      channelAccountId: "account-2",
      customerName: "Facebook User",
      text: "Hello",
    });

    expect(mockPrisma.conversation.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          channel: "facebook",
          channelAccountId: "account-2",
          customerContact: "facebook:page-2:psid-1",
        }),
      })
    );
    expect(mockPrisma.conversation.findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          channel: "facebook",
          channelAccountId: "account-2",
          OR: [{ customerId: "cust-1" }, { customerContact: "facebook:page-2:psid-1" }],
        }),
      })
    );
    expect(createNewConversation).toHaveBeenCalledWith(
      "facebook",
      "Facebook User",
      "facebook:page-2:psid-1",
      "cust-1",
      {
        channelAccountId: "account-2",
        metadata: undefined,
      }
    );
  });

  it("handleExternalChannelMessage preserves legacy validation errors", async () => {
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");

    await expect(
      handleExternalChannelMessage({
        channel: "facebook",
        customerContact: "",
        text: "Hello",
      })
    ).rejects.toThrow("Customer contact is required");

    await expect(
      handleExternalChannelMessage({
        channel: "facebook",
        customerContact: "facebook:psid-1",
        text: " ",
      })
    ).rejects.toThrow("Message text is required");
  });
});
