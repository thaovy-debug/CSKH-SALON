import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createRequest, parseJsonResponse } from "../helpers/request";

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
const mockZaloRuntime = vi.hoisted(() => ({
  getZaloStatus: vi.fn().mockReturnValue({
    status: "disconnected",
    message: "Zalo bot is not running",
    pid: null,
  }),
  startZaloBot: vi.fn().mockResolvedValue({
    status: "connected",
    message: "Zalo bot is running",
    pid: 1234,
  }),
  stopZaloBot: vi.fn().mockResolvedValue({
    status: "disconnected",
    message: "Zalo bot stopped",
    pid: null,
  }),
  syncZaloSessionFiles: vi.fn(),
  sendZaloMessage: vi.fn(),
  sendZaloImageMessage: vi.fn(),
}));

vi.mock("@/lib/channels/zalo", () => mockZaloRuntime);

function channel(type: string, config: Record<string, unknown>) {
  return {
    id: `${type}-channel`,
    type,
    isActive: true,
    config,
    status: "connected",
    createdAt: new Date("2026-05-31T00:00:00.000Z"),
    updatedAt: new Date("2026-05-31T00:00:00.000Z"),
  };
}

describe("channels API secret handling", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockZaloRuntime.startZaloBot.mockClear();
    mockZaloRuntime.stopZaloBot.mockClear();
    mockZaloRuntime.getZaloStatus.mockClear();
  });

  it("sanitizes Facebook and Instagram secrets in GET /api/channels", async () => {
    mockPrisma.channel.findMany.mockResolvedValue([
      channel("facebook", {
        verifyToken: "fb-verify",
        pageAccessToken: "fb-token",
        pageId: "page-1",
        graphVersion: "v25.0",
        appSecret: "fb-secret",
      }),
      channel("instagram", {
        verifyToken: "ig-verify",
        accessToken: "ig-token",
        businessAccountId: "ig-business-1",
        graphVersion: "v25.0",
        appSecret: "ig-secret",
      }),
    ]);

    const { GET } = await import("@/app/api/channels/route");
    const response = await GET(createRequest("/api/channels"));
    const data = await parseJsonResponse(response);
    const facebook = data.find((item: { type: string }) => item.type === "facebook");
    const instagram = data.find((item: { type: string }) => item.type === "instagram");
    const responseText = JSON.stringify(data);

    expect(response.status).toBe(200);
    expect(responseText).not.toContain("fb-token");
    expect(responseText).not.toContain("fb-secret");
    expect(responseText).not.toContain("ig-token");
    expect(responseText).not.toContain("ig-secret");
    expect(facebook.config).toMatchObject({
      verifyToken: "fb-verify",
      pageId: "page-1",
      graphVersion: "v25.0",
      hasPageAccessToken: true,
      hasAppSecret: true,
    });
    expect(facebook.config.pageAccessToken).toBeUndefined();
    expect(facebook.config.appSecret).toBeUndefined();
    expect(instagram.config).toMatchObject({
      verifyToken: "ig-verify",
      businessAccountId: "ig-business-1",
      graphVersion: "v25.0",
      hasAccessToken: true,
      hasAppSecret: true,
    });
    expect(instagram.config.accessToken).toBeUndefined();
    expect(instagram.config.appSecret).toBeUndefined();
  });

  it("sanitizes Facebook secrets in GET /api/channels/[type]", async () => {
    mockPrisma.channel.findUnique.mockResolvedValue(
      channel("facebook", {
        verifyToken: "fb-verify",
        pageAccessToken: "fb-token",
        pageId: "page-1",
        graphVersion: "v25.0",
        appSecret: "fb-secret",
      })
    );

    const { GET } = await import("@/app/api/channels/[type]/route");
    const response = await GET(createRequest("/api/channels/facebook"), {
      params: Promise.resolve({ type: "facebook" }),
    });
    const data = await parseJsonResponse(response);

    expect(JSON.stringify(data)).not.toContain("fb-token");
    expect(JSON.stringify(data)).not.toContain("fb-secret");
    expect(data.config).toMatchObject({
      hasPageAccessToken: true,
      hasAppSecret: true,
    });
  });

  it("preserves old Facebook secrets when PUT receives blank values", async () => {
    const existing = channel("facebook", {
      verifyToken: "old-verify",
      pageAccessToken: "old-fb-token",
      pageId: "old-page",
      graphVersion: "v21.0",
      appSecret: "old-fb-secret",
    });
    mockPrisma.channel.findUnique.mockResolvedValue(existing);
    mockPrisma.channel.upsert.mockImplementation(async (args) =>
      channel("facebook", args.update.config)
    );

    const { PUT } = await import("@/app/api/channels/[type]/route");
    const response = await PUT(
      createRequest("/api/channels/facebook", {
        method: "PUT",
        body: {
          config: {
            verifyToken: "new-verify",
            pageAccessToken: "",
            pageId: "new-page",
            graphVersion: "v25.0",
            appSecret: "********",
          },
        },
      }),
      { params: Promise.resolve({ type: "facebook" }) }
    );
    const data = await parseJsonResponse(response);

    expect(mockPrisma.channel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          config: expect.objectContaining({
            verifyToken: "new-verify",
            pageAccessToken: "old-fb-token",
            pageId: "new-page",
            graphVersion: "v25.0",
            appSecret: "old-fb-secret",
          }),
        }),
      })
    );
    expect(JSON.stringify(data)).not.toContain("old-fb-token");
    expect(JSON.stringify(data)).not.toContain("old-fb-secret");
    expect(data.config.hasPageAccessToken).toBe(true);
    expect(data.config.hasAppSecret).toBe(true);
  });

  it("updates new Instagram secrets and non-secret fields", async () => {
    const existing = channel("instagram", {
      verifyToken: "old-verify",
      accessToken: "old-ig-token",
      businessAccountId: "old-business",
      graphVersion: "v21.0",
      appSecret: "old-ig-secret",
    });
    mockPrisma.channel.findUnique.mockResolvedValue(existing);
    mockPrisma.channel.upsert.mockImplementation(async (args) =>
      channel("instagram", args.update.config)
    );

    const { PUT } = await import("@/app/api/channels/[type]/route");
    await PUT(
      createRequest("/api/channels/instagram", {
        method: "PUT",
        body: {
          config: {
            verifyToken: "new-verify",
            accessToken: "new-ig-token",
            businessAccountId: "new-business",
            graphVersion: "v25.0",
            appSecret: "new-ig-secret",
          },
        },
      }),
      { params: Promise.resolve({ type: "instagram" }) }
    );

    expect(mockPrisma.channel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          config: expect.objectContaining({
            verifyToken: "new-verify",
            accessToken: "new-ig-token",
            businessAccountId: "new-business",
            graphVersion: "v25.0",
            appSecret: "new-ig-secret",
          }),
        }),
      })
    );
  });

  it("preserves old Instagram secrets when PUT receives blank values", async () => {
    const existing = channel("instagram", {
      accessToken: "old-ig-token",
      appSecret: "old-ig-secret",
    });
    mockPrisma.channel.findUnique.mockResolvedValue(existing);
    mockPrisma.channel.upsert.mockImplementation(async (args) =>
      channel("instagram", args.update.config)
    );

    const { PUT } = await import("@/app/api/channels/[type]/route");
    await PUT(
      createRequest("/api/channels/instagram", {
        method: "PUT",
        body: {
          config: {
            accessToken: "",
            appSecret: "••••••••",
          },
        },
      }),
      { params: Promise.resolve({ type: "instagram" }) }
    );

    expect(mockPrisma.channel.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          config: expect.objectContaining({
            accessToken: "old-ig-token",
            appSecret: "old-ig-secret",
          }),
        }),
      })
    );
  });

  it("sanitizes Zalo channel and account secrets", async () => {
    mockPrisma.channel.findMany.mockResolvedValue([
      channel("zalo", {
        accountId: "oa-led1000",
        displayName: "LED1000 Zalo",
        pythonCommand: "python3",
        scriptPath: "zalo_bot.py",
        cookiesInput: "zalo-cookie-secret",
        relaySecret: "relay-secret",
      }),
    ]);
    mockPrisma.channelAccount.findMany.mockResolvedValue([
      {
        id: "zalo-account-1",
        type: "zalo",
        displayName: "LED1000 Zalo",
        externalAccountId: "oa-led1000",
        isActive: true,
        isDefault: true,
        config: {
          accountId: "oa-led1000",
          displayName: "LED1000 Zalo",
          cookiesInput: "zalo-cookie-secret",
          relaySecret: "relay-secret",
        },
        status: "connected",
        createdAt: new Date("2026-05-31T00:00:00.000Z"),
        updatedAt: new Date("2026-05-31T00:00:00.000Z"),
      },
    ]);

    const { GET: getChannels } = await import("@/app/api/channels/route");
    const { GET: getAccounts } = await import("@/app/api/channel-accounts/route");

    const channelsResponse = await getChannels(createRequest("/api/channels"));
    const accountsResponse = await getAccounts(createRequest("/api/channel-accounts?type=zalo"));
    const channels = await parseJsonResponse(channelsResponse);
    const accounts = await parseJsonResponse(accountsResponse);
    const responseText = JSON.stringify({ channels, accounts });
    const zalo = channels.find((item: { type: string }) => item.type === "zalo");

    expect(responseText).not.toContain("zalo-cookie-secret");
    expect(responseText).not.toContain("relay-secret");
    expect(zalo.config).toMatchObject({
      accountId: "oa-led1000",
      displayName: "LED1000 Zalo",
      hasCookiesInput: true,
      hasRelaySecret: true,
    });
    expect(accounts[0].config).toMatchObject({
      accountId: "oa-led1000",
      displayName: "LED1000 Zalo",
      hasCookiesInput: true,
      hasRelaySecret: true,
    });
  });

  it("preserves existing Zalo account secrets when update receives blank values", async () => {
    const existingAccount = {
      id: "zalo-account-1",
      type: "zalo",
      displayName: "LED1000 Zalo",
      externalAccountId: "oa-led1000",
      isActive: true,
      isDefault: true,
      config: {
        accountId: "oa-led1000",
        cookiesInput: "old-zalo-cookie",
        relaySecret: "old-relay-secret",
        pythonCommand: "python3",
      },
      status: "connected",
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    };
    mockPrisma.channelAccount.findUnique.mockResolvedValue(existingAccount);
    mockPrisma.channelAccount.update.mockImplementation(async (args) => ({
      ...existingAccount,
      ...args.data,
    }));

    const { PUT } = await import("@/app/api/channel-accounts/[id]/route");
    const response = await PUT(
      createRequest("/api/channel-accounts/zalo-account-1", {
        method: "PUT",
        body: {
          displayName: "LED1000 Zalo Updated",
          config: {
            accountId: "oa-led1000",
            cookiesInput: "",
            relaySecret: "********",
            pythonCommand: "python3",
          },
        },
      }),
      { params: Promise.resolve({ id: "zalo-account-1" }) }
    );
    const data = await parseJsonResponse(response);

    expect(mockPrisma.channelAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          config: expect.objectContaining({
            cookiesInput: "old-zalo-cookie",
            relaySecret: "old-relay-secret",
          }),
        }),
      })
    );
    expect(JSON.stringify(data)).not.toContain("old-zalo-cookie");
    expect(JSON.stringify(data)).not.toContain("old-relay-secret");
    expect(data.config.hasCookiesInput).toBe(true);
    expect(data.config.hasRelaySecret).toBe(true);
  });

  it("sanitizes Zalo relay config without exposing secrets", async () => {
    mockPrisma.channel.findMany.mockResolvedValue([
      channel("zalo", {
        accountId: "oa-led1000",
        cookiesInput: "zalo-cookie-secret",
        relaySecret: "relay-secret",
      }),
    ]);
    mockPrisma.channelAccount.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/channels/route");
    const response = await GET(createRequest("/api/channels"));
    const data = await parseJsonResponse(response);
    const zalo = data.find((item: { type: string }) => item.type === "zalo");

    expect(JSON.stringify(zalo)).not.toContain("zalo-cookie-secret");
    expect(JSON.stringify(zalo)).not.toContain("relay-secret");
    expect(zalo.config.hasCookiesInput).toBe(true);
    expect(zalo.config.hasRelaySecret).toBe(true);
  });

  it("starts Zalo accounts through the existing Python runtime", async () => {
    const account = {
      id: "zalo-python-account",
      type: "zalo",
      displayName: "LED1000 Zalo Python",
      externalAccountId: "oa-led1000-python",
      isActive: true,
      isDefault: true,
      config: {
        accountId: "oa-led1000-python",
        cookiesInput: "cookie",
        relaySecret: "relay-secret",
      },
      status: "disconnected",
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    };
    mockPrisma.channelAccount.findUnique.mockResolvedValue(account);

    const { POST } = await import("@/app/api/channel-accounts/[id]/route");
    const response = await POST(
      createRequest("/api/channel-accounts/zalo-python-account", {
        method: "POST",
        body: { action: "connect" },
      }),
      { params: Promise.resolve({ id: "zalo-python-account" }) }
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(mockZaloRuntime.startZaloBot).toHaveBeenCalledWith(
      account.config,
      "zalo-python-account"
    );
    expect(data.status).toBe("connected");
  });
  it("marks new Shopee accounts as config_saved and masks secrets", async () => {
    mockPrisma.channelAccount.findUnique.mockResolvedValue(null);
    mockPrisma.channelAccount.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.channelAccount.upsert.mockImplementation(async (args) => ({
      id: "shopee-account-1",
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      updatedAt: new Date("2026-05-31T00:00:00.000Z"),
      lastConnectedAt: null,
      lastError: "",
      ...args.create,
    }));

    const { POST } = await import("@/app/api/channel-accounts/route");
    const response = await POST(
      createRequest("/api/channel-accounts", {
        method: "POST",
        body: {
          type: "shopee",
          displayName: "LED1000 Shopee",
          externalAccountId: "1001",
          config: {
            shopId: "1001",
            partnerId: "123456",
            partnerKey: "partner-secret",
            accessToken: "access-secret",
            refreshToken: "refresh-secret",
          },
        },
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(201);
    expect(mockPrisma.channelAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "config_saved" }),
      })
    );
    expect(data.status).toBe("config_saved");
    expect(data.config).toMatchObject({
      shopId: "1001",
      partnerId: "123456",
      hasPartnerKey: true,
      hasAccessToken: true,
      hasRefreshToken: true,
    });
    expect(JSON.stringify(data)).not.toContain("partner-secret");
    expect(JSON.stringify(data)).not.toContain("access-secret");
    expect(JSON.stringify(data)).not.toContain("refresh-secret");
  });

  it("returns Shopee authorization_required without implying production readiness", async () => {
    const account = {
      id: "shopee-account-1",
      type: "shopee",
      displayName: "LED1000 Shopee",
      externalAccountId: "1001",
      isActive: true,
      isDefault: true,
      config: {
        shopId: "1001",
        partnerId: "123456",
        partnerKey: "partner-secret",
      },
      status: "config_saved",
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    };
    mockPrisma.channelAccount.findUnique.mockResolvedValue(account);
    mockPrisma.channelAccount.update.mockImplementation(async (args) => ({
      ...account,
      ...args.data,
    }));

    const { POST } = await import("@/app/api/channel-accounts/[id]/route");
    const response = await POST(
      createRequest("/api/channel-accounts/shopee-account-1", {
        method: "POST",
        body: { action: "connect" },
      }),
      { params: Promise.resolve({ id: "shopee-account-1" }) }
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.status).toBe("authorization_required");
    expect(data.message).toContain("chưa phải sẵn sàng production");
    expect(data.authUrl).toContain("/api/v2/shop/auth_partner");
    expect(data.authUrl).not.toContain("partner-secret");
  });
  it("marks Shopee auth callback success as authorized only", async () => {
    const account = {
      id: "shopee-account-1",
      type: "shopee",
      displayName: "LED1000 Shopee",
      externalAccountId: "1001",
      isActive: true,
      isDefault: true,
      config: {
        shopId: "1001",
        partnerId: "123456",
        partnerKey: "partner-secret",
        apiBaseUrl: "https://partner.shopeemobile.com",
      },
      status: "authorization_required",
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            access_token: "access-secret",
            refresh_token: "refresh-secret",
            shop_id: 1001,
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);
    mockPrisma.channelAccount.findUnique.mockResolvedValue(account);
    mockPrisma.channelAccount.update.mockResolvedValue({
      ...account,
      status: "authorized",
    });

    const { GET } = await import("@/app/api/channels/shopee/auth/callback/route");
    const response = await GET(
      createRequest("/api/channels/shopee/auth/callback", {
        searchParams: {
          accountId: "shopee-account-1",
          code: "auth-code",
          shop_id: "1001",
        },
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("status=authorized");
    expect(response.headers.get("location")).not.toContain("access-secret");
    expect(mockPrisma.channelAccount.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "authorized",
          config: expect.objectContaining({
            shopId: "1001",
            accessToken: "access-secret",
            refreshToken: "refresh-secret",
            integrationStatus: "authorized",
          }),
        }),
      })
    );
    vi.unstubAllGlobals();
  });
  it("stores TikTok Shop account config with masked secrets", async () => {
    mockPrisma.channelAccount.findUnique.mockResolvedValue(null);
    mockPrisma.channelAccount.updateMany.mockResolvedValue({ count: 0 });
    mockPrisma.channelAccount.upsert.mockImplementation(async (args) => ({
      id: "tiktok-account-1",
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      updatedAt: new Date("2026-05-31T00:00:00.000Z"),
      lastConnectedAt: null,
      lastError: "",
      ...args.create,
    }));

    const { POST } = await import("@/app/api/channel-accounts/route");
    const response = await POST(
      createRequest("/api/channel-accounts", {
        method: "POST",
        body: {
          type: "tiktok_shop",
          displayName: "LED1000 TikTok Shop",
          externalAccountId: "1001",
          config: {
            shopId: "1001",
            appKey: "app-key",
            appSecret: "app-secret",
            accessToken: "access-secret",
            refreshToken: "refresh-secret",
            webhookSecret: "webhook-secret",
          },
        },
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(201);
    expect(mockPrisma.channelAccount.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: "config_saved" }),
      })
    );
    expect(data.status).toBe("config_saved");
    expect(data.config).toMatchObject({
      shopId: "1001",
      appKey: "app-key",
      hasAppSecret: true,
      hasAccessToken: true,
      hasRefreshToken: true,
      hasWebhookSecret: true,
    });
    expect(JSON.stringify(data)).not.toContain("app-secret");
    expect(JSON.stringify(data)).not.toContain("access-secret");
    expect(JSON.stringify(data)).not.toContain("refresh-secret");
    expect(JSON.stringify(data)).not.toContain("webhook-secret");
  });

  it("keeps TikTok Shop connect action at authorization_required until Partner Center verification", async () => {
    const account = {
      id: "tiktok-account-1",
      type: "tiktok_shop",
      displayName: "LED1000 TikTok Shop",
      externalAccountId: "1001",
      isActive: true,
      isDefault: true,
      config: {
        shopId: "1001",
        appKey: "app-key",
        appSecret: "app-secret",
      },
      status: "config_saved",
      createdAt: new Date("2026-05-31T00:00:00.000Z"),
      updatedAt: new Date("2026-05-31T00:00:00.000Z"),
    };
    mockPrisma.channelAccount.findUnique.mockResolvedValue(account);
    mockPrisma.channelAccount.update.mockImplementation(async (args) => ({
      ...account,
      ...args.data,
    }));

    const { POST } = await import("@/app/api/channel-accounts/[id]/route");
    const response = await POST(
      createRequest("/api/channel-accounts/tiktok-account-1", {
        method: "POST",
        body: { action: "connect" },
      }),
      { params: Promise.resolve({ id: "tiktok-account-1" }) }
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.status).toBe("authorization_required");
    expect(data.message).toContain("TikTok Shop Partner Center");
    expect(data.message).toContain("chưa phải sẵn sàng production");
    expect(data.authUrl).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("app-secret");
  });
});
