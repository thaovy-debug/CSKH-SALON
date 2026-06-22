import crypto from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  parseMetaWebhookPayload,
  sendMetaTextMessage,
  splitMetaText,
  verifyMetaSignature,
} from "@/lib/channels/meta";
import { prisma } from "@/lib/prisma";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

describe("Meta channel adapter", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockPrisma.channel.findUnique.mockReset();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("should parse Facebook Messenger text events", () => {
    const events = parseMetaWebhookPayload({
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "psid-1" },
              recipient: { id: "page-1" },
              message: { mid: "m-1", text: "Hello LED1000" },
            },
          ],
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      channel: "facebook",
      senderId: "psid-1",
      recipientId: "page-1",
      customerContact: "facebook:page-1:psid-1",
      customerName: "Facebook User",
      text: "Hello LED1000",
    });
  });

  it("should parse Instagram direct messaging text events", () => {
    const events = parseMetaWebhookPayload({
      object: "instagram",
      entry: [
        {
          messaging: [
            {
              sender: { id: "ig-sender-1" },
              recipient: { id: "ig-business-1" },
              message: { mid: "ig-m-1", text: "Can I book?" },
            },
          ],
        },
      ],
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      channel: "instagram",
      senderId: "ig-sender-1",
      recipientId: "ig-business-1",
      customerContact: "instagram:ig-business-1:ig-sender-1",
      customerName: "Instagram User",
      text: "Can I book?",
    });
  });

  it("should ignore echo messages", () => {
    const events = parseMetaWebhookPayload({
      object: "page",
      entry: [
        {
          messaging: [
            {
              sender: { id: "psid-1" },
              recipient: { id: "page-1" },
              message: { text: "Bot reply", is_echo: true },
            },
          ],
        },
      ],
    });

    expect(events).toEqual([]);
  });

  it("should ignore non-text and unknown payloads without throwing", () => {
    expect(parseMetaWebhookPayload(null)).toEqual([]);
    expect(
      parseMetaWebhookPayload({
        object: "page",
        entry: [
          {
            messaging: [
              { sender: { id: "1" }, recipient: { id: "2" }, delivery: {} },
              {
                sender: { id: "1" },
                recipient: { id: "2" },
                message: { attachments: [{ type: "image" }] },
              },
            ],
          },
        ],
      })
    ).toEqual([]);
  });

  it("should skip signature verification without app secret", () => {
    expect(verifyMetaSignature("body", null, undefined)).toBe(true);
  });

  it("should validate correct sha256 signatures", () => {
    const rawBody = JSON.stringify({ hello: "world" });
    const secret = "meta-secret";
    const signature =
      "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

    expect(verifyMetaSignature(rawBody, signature, secret)).toBe(true);
    expect(verifyMetaSignature(rawBody, "sha256=bad", secret)).toBe(false);
  });

  it("should keep short Meta text as one chunk", () => {
    expect(splitMetaText("Hello LED1000", 20)).toEqual(["Hello LED1000"]);
  });

  it("should split long Meta text into chunks under the max length", () => {
    const text = [
      "First paragraph has useful LED1000 details.",
      "Second paragraph has more booking details.",
      "Third paragraph is intentionally longer than the chunk limit and should be split safely.",
    ].join("\n\n");

    const chunks = splitMetaText(text, 55);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 55)).toBe(true);
    expect(chunks.join("\n\n")).toContain("First paragraph");
  });

  it("should send Facebook and Instagram messages with separate tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });
    vi.stubGlobal("fetch", fetchMock);

    process.env.META_GRAPH_VERSION = "v25.0";
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "fb-token";
    process.env.INSTAGRAM_ACCESS_TOKEN = "ig-token";

    await sendMetaTextMessage({
      channel: "facebook",
      recipientId: "psid-1",
      text: "Dạ em chào chị",
    });
    await sendMetaTextMessage({
      channel: "instagram",
      recipientId: "ig-sender-1",
      text: "Dạ em chào chị",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://graph.facebook.com/v25.0/me/messages?access_token=fb-token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          recipient: { id: "psid-1" },
          message: { text: "Dạ em chào chị" },
        }),
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://graph.instagram.com/v25.0/me/messages?access_token=ig-token",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          recipient: { id: "ig-sender-1" },
          message: { text: "Dạ em chào chị" },
        }),
      })
    );
  });

  it("should send long messages as multiple chunks in order", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "fb-token";
    process.env.META_MAX_MESSAGE_LENGTH = "10";

    await sendMetaTextMessage({
      channel: "facebook",
      recipientId: "psid-1",
      text: "1234567890 1234567890",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).message.text).toBe(
      "1234567890"
    );
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string).message.text).toBe(
      "1234567890"
    );
  });

  it("should retry temporary Send API failures", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue("rate limited"),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(""),
      });
    vi.stubGlobal("fetch", fetchMock);
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "fb-token";
    process.env.META_SEND_MAX_RETRIES = "1";

    await sendMetaTextMessage({
      channel: "facebook",
      recipientId: "psid-1",
      text: "Hello",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should retry network Send API failures", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(""),
      });
    vi.stubGlobal("fetch", fetchMock);
    process.env.INSTAGRAM_ACCESS_TOKEN = "ig-token";
    process.env.META_SEND_MAX_RETRIES = "1";

    await sendMetaTextMessage({
      channel: "instagram",
      recipientId: "ig-sender-1",
      text: "Hello",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should stop sending chunks after a chunk fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(""),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: vi.fn().mockResolvedValue("unauthorized"),
      });
    vi.stubGlobal("fetch", fetchMock);
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "fb-token";
    process.env.META_MAX_MESSAGE_LENGTH = "10";

    await expect(
      sendMetaTextMessage({
        channel: "facebook",
        recipientId: "psid-1",
        text: "1234567890 1234567890 1234567890",
      })
    ).rejects.toThrow("Meta Send API failed with status 401");

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("should not retry non-temporary Send API failures", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue("unauthorized"),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "fb-token";
    process.env.META_SEND_MAX_RETRIES = "2";

    await expect(
      sendMetaTextMessage({
        channel: "facebook",
        recipientId: "psid-1",
        text: "Hello",
      })
    ).rejects.toThrow("Meta Send API failed with status 401");

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("should prefer DB config over env tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.META_GRAPH_VERSION = "v25.0";
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "env-fb-token";
    mockPrisma.channel.findUnique.mockResolvedValue({
      config: {
        pageAccessToken: "db-fb-token",
        graphVersion: "v24.0",
      },
    });

    await sendMetaTextMessage({
      channel: "facebook",
      recipientId: "psid-1",
      text: "Hello",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.facebook.com/v24.0/me/messages?access_token=db-fb-token",
      expect.any(Object)
    );
  });

  it("should fall back to env token if DB config lookup fails", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.META_GRAPH_VERSION = "v25.0";
    process.env.INSTAGRAM_ACCESS_TOKEN = "env-ig-token";
    mockPrisma.channel.findUnique.mockRejectedValue(new Error("DB unavailable"));

    await sendMetaTextMessage({
      channel: "instagram",
      recipientId: "ig-sender-1",
      text: "Hello",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://graph.instagram.com/v25.0/me/messages?access_token=env-ig-token",
      expect.any(Object)
    );
  });

  it("should not mix Facebook and Instagram DB tokens", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: vi.fn().mockResolvedValue(""),
    });
    vi.stubGlobal("fetch", fetchMock);
    process.env.FACEBOOK_PAGE_ACCESS_TOKEN = "env-fb-token";
    process.env.INSTAGRAM_ACCESS_TOKEN = "env-ig-token";
    mockPrisma.channel.findUnique.mockImplementation(async ({ where }) => {
      if (where.type === "facebook") {
        return { config: { pageAccessToken: "db-fb-token", graphVersion: "v25.0" } };
      }
      if (where.type === "instagram") {
        return { config: { accessToken: "db-ig-token", graphVersion: "v25.0" } };
      }
      return null;
    });

    await sendMetaTextMessage({
      channel: "facebook",
      recipientId: "psid-1",
      text: "Facebook",
    });
    await sendMetaTextMessage({
      channel: "instagram",
      recipientId: "ig-sender-1",
      text: "Instagram",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://graph.facebook.com/v25.0/me/messages?access_token=db-fb-token",
      expect.any(Object)
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://graph.instagram.com/v25.0/me/messages?access_token=db-ig-token",
      expect.any(Object)
    );
  });
});
