import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

vi.mock("@/lib/channels/external-message", () => ({
  handleExternalChannelMessage: vi.fn().mockResolvedValue({
    conversationId: "conv-zalo-1",
    response: "Zalo AI response",
  }),
}));

describe("Zalo incoming route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.channelAccount.findFirst.mockReset();
  });

  it("scopes incoming messages by Zalo account when accountId is provided", async () => {
    mockPrisma.channelAccount.findFirst.mockResolvedValue({
      id: "zalo-account-db-id",
      externalAccountId: "oa-led1000-hcm",
      type: "zalo",
    });

    const { POST } = await import("@/app/api/channels/zalo/incoming/route");
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");

    const response = await POST(
      createRequest("/api/channels/zalo/incoming", {
        method: "POST",
        body: {
          accountId: "zalo-account-db-id",
          authorId: "zalo-user-1",
          threadId: "thread-1",
          displayName: "Khách Zalo 1",
          message: "Tư vấn nguồn LED giúp tôi",
        },
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      conversationId: "conv-zalo-1",
      response: "Zalo AI response",
    });
    expect(mockPrisma.channelAccount.findFirst).toHaveBeenCalledWith({
      where: {
        type: "zalo",
        OR: [{ id: "zalo-account-db-id" }, { externalAccountId: "zalo-account-db-id" }],
      },
    });
    expect(handleExternalChannelMessage).toHaveBeenCalledWith({
      channel: "zalo",
      customerContact: "zalo:oa-led1000-hcm:zalo-user-1",
      customerName: "Khách Zalo 1",
      channelAccountId: "zalo-account-db-id",
      sourceAccountId: "oa-led1000-hcm",
      text: "Tư vấn nguồn LED giúp tôi",
    });
  });

  it("keeps legacy contact behavior when no accountId is provided", async () => {
    const { POST } = await import("@/app/api/channels/zalo/incoming/route");
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");

    const response = await POST(
      createRequest("/api/channels/zalo/incoming", {
        method: "POST",
        body: {
          authorId: "zalo-user-legacy",
          message: "Xin chào",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.channelAccount.findFirst).not.toHaveBeenCalled();
    expect(handleExternalChannelMessage).toHaveBeenCalledWith({
      channel: "zalo",
      customerContact: "zalo-user-legacy",
      customerName: "Khách Zalo",
      channelAccountId: null,
      sourceAccountId: "",
      text: "Xin chào",
    });
  });

  it("accepts incoming when relaySecret matches configured Zalo account", async () => {
    mockPrisma.channelAccount.findFirst.mockResolvedValue({
      id: "zalo-account-db-id",
      externalAccountId: "oa-led1000-hcm",
      type: "zalo",
      config: { relaySecret: "relay-secret-1" },
    });

    const { POST } = await import("@/app/api/channels/zalo/incoming/route");
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");

    const response = await POST(
      createRequest("/api/channels/zalo/incoming", {
        method: "POST",
        headers: { "x-zalo-relay-secret": "relay-secret-1" },
        body: {
          accountId: "zalo-account-db-id",
          authorId: "zalo-user-1",
          message: "Xin báo giá LED dây",
        },
      })
    );

    expect(response.status).toBe(200);
    expect(handleExternalChannelMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "zalo",
        channelAccountId: "zalo-account-db-id",
        sourceAccountId: "oa-led1000-hcm",
      })
    );
  });

  it("rejects incoming when relaySecret is configured but header is missing or wrong", async () => {
    mockPrisma.channelAccount.findFirst.mockResolvedValue({
      id: "zalo-account-db-id",
      externalAccountId: "oa-led1000-hcm",
      type: "zalo",
      config: { relaySecret: "relay-secret-1" },
    });

    const { POST } = await import("@/app/api/channels/zalo/incoming/route");
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");

    const missingHeaderResponse = await POST(
      createRequest("/api/channels/zalo/incoming", {
        method: "POST",
        body: {
          accountId: "zalo-account-db-id",
          authorId: "zalo-user-1",
          message: "Xin báo giá LED dây",
        },
      })
    );

    const wrongHeaderResponse = await POST(
      createRequest("/api/channels/zalo/incoming", {
        method: "POST",
        headers: { "x-zalo-relay-secret": "wrong-secret" },
        body: {
          accountId: "zalo-account-db-id",
          authorId: "zalo-user-1",
          message: "Xin báo giá LED dây",
        },
      })
    );

    expect(missingHeaderResponse.status).toBe(401);
    expect(wrongHeaderResponse.status).toBe(401);
    expect(handleExternalChannelMessage).not.toHaveBeenCalled();
  });
});
