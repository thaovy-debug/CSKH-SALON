import { describe, it, expect, vi, beforeEach } from "vitest";
import { createRequest, parseJsonResponse } from "../helpers/request";

vi.mock("@/lib/ai/engine", () => ({
  chat: vi.fn().mockResolvedValue("AI response here"),
}));

vi.mock("@/lib/channels/normalized", () => ({
  processNormalizedInboundMessage: vi.fn().mockResolvedValue({
    conversationId: "new-conv-1",
    response: "AI response here",
    customerId: "cust-1",
  }),
}));

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a new conversation through normalized flow when conversationId is missing", async () => {
    const { chat } = await import("@/lib/ai/engine");
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");
    vi.mocked(processNormalizedInboundMessage).mockResolvedValue({
      conversationId: "conv-new",
      response: "Hello! How can I help?",
      customerId: "cust-1",
    });

    const { POST } = await import("@/app/api/chat/route");
    const request = createRequest("/api/chat", {
      method: "POST",
      headers: { "user-agent": "vitest-agent" },
      body: {
        message: "Hello",
        channel: "api",
        customerName: "API Customer",
        customerContact: "customer@example.com",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.conversationId).toBe("conv-new");
    expect(data.response).toBe("Hello! How can I help?");
    expect(chat).not.toHaveBeenCalled();
    expect(processNormalizedInboundMessage).toHaveBeenCalledWith({
      channel: "api",
      externalCustomerId: "customer@example.com",
      customerContact: "customer@example.com",
      customerName: "API Customer",
      text: "Hello",
      metadata: {
        source: "api_chat",
        userAgent: "vitest-agent",
      },
    });
  });

  it("should reject empty message", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const request = createRequest("/api/chat", {
      method: "POST",
      body: { message: "" },
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("should reject missing message", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const request = createRequest("/api/chat", {
      method: "POST",
      body: {},
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("should reject message exceeding 10000 characters", async () => {
    const { POST } = await import("@/app/api/chat/route");
    const request = createRequest("/api/chat", {
      method: "POST",
      body: { message: "A".repeat(10001) },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("10000");
  });

  it("should use provided conversationId", async () => {
    const { chat } = await import("@/lib/ai/engine");
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");
    (chat as ReturnType<typeof vi.fn>).mockResolvedValue("Response");

    const { POST } = await import("@/app/api/chat/route");
    const request = createRequest("/api/chat", {
      method: "POST",
      body: { message: "Hello", conversationId: "existing-conv" },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(data.conversationId).toBe("existing-conv");
    expect(data.response).toBe("Response");
    expect(chat).toHaveBeenCalledWith("existing-conv", "Hello");
    expect(processNormalizedInboundMessage).not.toHaveBeenCalled();
  });

  it("should preserve widget response shape and use widget channel for new conversations", async () => {
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");
    vi.mocked(processNormalizedInboundMessage).mockResolvedValue({
      conversationId: "widget-conv",
      response: "Widget response",
      customerId: "cust-widget",
    });

    const { POST } = await import("@/app/api/chat/route");
    const request = createRequest("/api/chat", {
      method: "POST",
      body: {
        message: "Tư vấn đèn LED dây",
        channel: "widget",
        customerName: "Website Visitor",
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({
      conversationId: "widget-conv",
      response: "Widget response",
    });
    expect(processNormalizedInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "widget",
        customerName: "Website Visitor",
        customerContact: undefined,
        text: "Tư vấn đèn LED dây",
      })
    );
    expect(vi.mocked(processNormalizedInboundMessage).mock.calls[0][0].externalCustomerId).toMatch(
      /^anonymous:/
    );
  });

  it("should fall back safely when channel is missing or invalid", async () => {
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");

    const { POST } = await import("@/app/api/chat/route");
    const request = createRequest("/api/chat", {
      method: "POST",
      body: {
        message: "Hello",
        channel: "unknown-channel",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(processNormalizedInboundMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: "api",
        customerName: "API User",
        customerContact: undefined,
      })
    );
    expect(vi.mocked(processNormalizedInboundMessage).mock.calls[0][0].externalCustomerId).toMatch(
      /^anonymous:/
    );
  });

  it("should handle AI engine errors gracefully", async () => {
    const { processNormalizedInboundMessage } = await import("@/lib/channels/normalized");
    vi.mocked(processNormalizedInboundMessage).mockRejectedValue(new Error("OpenAI unavailable"));

    const { POST } = await import("@/app/api/chat/route");
    const request = createRequest("/api/chat", {
      method: "POST",
      body: { message: "Hello" },
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });
});
