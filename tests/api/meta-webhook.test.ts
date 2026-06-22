import crypto from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

vi.mock("@/lib/channels/external-message", () => ({
  handleExternalChannelMessage: vi.fn().mockResolvedValue({
    conversationId: "conv-1",
    response: "AI response",
  }),
}));

describe("Meta webhook route", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.channel.findMany.mockReset();
    mockPrisma.channel.findUnique.mockReset();
    process.env = { ...originalEnv };
    process.env.META_VERIFY_TOKEN = "verify-token";
    delete process.env.META_APP_SECRET;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(""),
      })
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("should return challenge for valid GET verification", async () => {
    const { GET } = await import("@/app/api/webhooks/meta/route");
    const request = createRequest("/api/webhooks/meta", {
      searchParams: {
        "hub.mode": "subscribe",
        "hub.verify_token": "verify-token",
        "hub.challenge": "challenge-123",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("challenge-123");
  });

  it("should reject invalid GET verification token", async () => {
    const { GET } = await import("@/app/api/webhooks/meta/route");
    const request = createRequest("/api/webhooks/meta", {
      searchParams: {
        "hub.mode": "subscribe",
        "hub.verify_token": "wrong",
        "hub.challenge": "challenge-123",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(403);
  });

  it("should return challenge for a DB-configured verify token", async () => {
    delete process.env.META_VERIFY_TOKEN;
    mockPrisma.channel.findMany.mockResolvedValue([
      { config: { verifyToken: "facebook-db-token" } },
      { config: { verifyToken: "instagram-db-token" } },
    ]);

    const { GET } = await import("@/app/api/webhooks/meta/route");
    const request = createRequest("/api/webhooks/meta", {
      searchParams: {
        "hub.mode": "subscribe",
        "hub.verify_token": "instagram-db-token",
        "hub.challenge": "challenge-db",
      },
    });

    const response = await GET(request);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("challenge-db");
  });

  it("should accept a DB-configured app secret candidate for POST signature", async () => {
    const body = {
      object: "page",
      entry: [{ messaging: [{ sender: { id: "1" }, recipient: { id: "2" }, read: {} }] }],
    };
    const rawBody = JSON.stringify(body);
    const signature =
      "sha256=" + crypto.createHmac("sha256", "db-app-secret").update(rawBody).digest("hex");
    mockPrisma.channel.findMany.mockResolvedValue([
      { config: { appSecret: "wrong-secret" } },
      { config: { appSecret: "db-app-secret" } },
    ]);

    const { POST } = await import("@/app/api/webhooks/meta/route");
    const response = await POST(
      createRequest("/api/webhooks/meta", {
        method: "POST",
        headers: { "x-hub-signature-256": signature },
        body,
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, received: 0 });
  });

  it("should accept a valid env app secret signature", async () => {
    process.env.META_APP_SECRET = "env-app-secret";
    const body = {
      object: "instagram",
      entry: [{ messaging: [{ sender: { id: "1" }, recipient: { id: "2" }, read: {} }] }],
    };
    const rawBody = JSON.stringify(body);
    const signature =
      "sha256=" + crypto.createHmac("sha256", "env-app-secret").update(rawBody).digest("hex");

    const { POST } = await import("@/app/api/webhooks/meta/route");
    const response = await POST(
      createRequest("/api/webhooks/meta", {
        method: "POST",
        headers: { "x-hub-signature-256": signature },
        body,
      })
    );

    expect(response.status).toBe(200);
  });

  it("should reject an invalid env app secret signature", async () => {
    process.env.META_APP_SECRET = "env-app-secret";

    const { POST } = await import("@/app/api/webhooks/meta/route");
    const response = await POST(
      createRequest("/api/webhooks/meta", {
        method: "POST",
        headers: { "x-hub-signature-256": "sha256=bad" },
        body: { object: "page", entry: [] },
      })
    );

    expect(response.status).toBe(401);
  });

  it("should reject an invalid DB app secret candidate signature", async () => {
    mockPrisma.channel.findMany.mockResolvedValue([
      { config: { appSecret: "db-app-secret" } },
    ]);

    const { POST } = await import("@/app/api/webhooks/meta/route");
    const response = await POST(
      createRequest("/api/webhooks/meta", {
        method: "POST",
        headers: { "x-hub-signature-256": "sha256=bad" },
        body: { object: "page", entry: [] },
      })
    );

    expect(response.status).toBe(401);
  });

  it("should process POST text events and reply through Meta", async () => {
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "fb-token";
    process.env.META_GRAPH_VERSION = "v25.0";

    const { POST } = await import("@/app/api/webhooks/meta/route");
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");

    const request = createRequest("/api/webhooks/meta", {
      method: "POST",
      body: {
        object: "page",
        entry: [
          {
            messaging: [
              {
                sender: { id: "psid-1" },
                recipient: { id: "page-1" },
                message: { text: "Hello" },
              },
            ],
          },
        ],
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, received: 1 });
    expect(handleExternalChannelMessage).toHaveBeenCalledWith({
      channel: "facebook",
      customerContact: "facebook:page-1:psid-1",
      customerName: "Facebook User",
      channelAccountId: null,
      sourceAccountId: "page-1",
      text: "Hello",
    });
    expect(fetch).toHaveBeenCalledWith(
      "https://graph.facebook.com/v25.0/me/messages?access_token=fb-token",
      expect.any(Object)
    );
  });

  it("should return 200 when event processing times out", async () => {
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "fb-token";
    process.env.META_WEBHOOK_EVENT_TIMEOUT_MS = "1";
    const { POST } = await import("@/app/api/webhooks/meta/route");
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");
    vi.mocked(handleExternalChannelMessage).mockImplementationOnce(
      () => new Promise(() => undefined)
    );

    const response = await POST(
      createRequest("/api/webhooks/meta", {
        method: "POST",
        body: {
          object: "page",
          entry: [
            {
              messaging: [
                {
                  sender: { id: "psid-1" },
                  recipient: { id: "page-1" },
                  message: { text: "Slow hello" },
                },
              ],
            },
          ],
        },
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, received: 1 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("should return 200 and ignore non-text payloads", async () => {
    const { POST } = await import("@/app/api/webhooks/meta/route");
    const { handleExternalChannelMessage } = await import("@/lib/channels/external-message");

    const request = createRequest("/api/webhooks/meta", {
      method: "POST",
      body: {
        object: "instagram",
        entry: [{ messaging: [{ sender: { id: "1" }, recipient: { id: "2" }, read: {} }] }],
      },
    });

    const response = await POST(request);
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data).toEqual({ ok: true, received: 0 });
    expect(handleExternalChannelMessage).not.toHaveBeenCalled();
  });
});
