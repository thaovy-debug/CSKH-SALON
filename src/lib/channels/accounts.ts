import { prisma } from "@/lib/prisma";
import {
  isBlankOrMaskedSecret,
  sanitizeChannelConfig,
} from "@/lib/channels/config";

type UnknownRecord = Record<string, unknown>;

export type AccountChannelType = "facebook" | "instagram" | "zalo" | "shopee" | "tiktok_shop";

export const ACCOUNT_CHANNEL_TYPES: AccountChannelType[] = [
  "facebook",
  "instagram",
  "zalo",
  "shopee",
  "tiktok_shop",
];

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(config: unknown, key: string): string {
  if (!isRecord(config)) return "";
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

function getBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function isAccountChannelType(type: string): type is AccountChannelType {
  return ACCOUNT_CHANNEL_TYPES.includes(type as AccountChannelType);
}

export function getExternalAccountId(type: string, config: unknown): string {
  if (type === "facebook") return getString(config, "pageId") || getString(config, "externalAccountId");
  if (type === "instagram") {
    return getString(config, "businessAccountId") || getString(config, "externalAccountId");
  }
  if (type === "zalo") {
    return (
      getString(config, "accountId") ||
      getString(config, "oaId") ||
      getString(config, "phoneNumber") ||
      getString(config, "externalAccountId")
    );
  }
  if (type === "shopee") {
    return getString(config, "shopId") || getString(config, "externalAccountId");
  }
  if (type === "tiktok_shop") {
    return (
      getString(config, "shopId") ||
      getString(config, "sellerId") ||
      getString(config, "externalAccountId")
    );
  }
  return getString(config, "externalAccountId");
}

export function getDisplayName(type: string, config: unknown, fallback?: string): string {
  return (
    getString(config, "displayName") ||
    getString(config, "name") ||
    fallback ||
    getExternalAccountId(type, config) ||
    type
  );
}

export function sanitizeChannelAccountConfig(type: string, config: unknown): unknown {
  if (!isRecord(config)) return {};

  if (type === "zalo") {
    return {
      accountId: getString(config, "accountId"),
      oaId: getString(config, "oaId"),
      displayName: getString(config, "displayName"),
      pythonCommand: getString(config, "pythonCommand"),
      scriptPath: getString(config, "scriptPath"),
      hasCookiesInput: !isBlankOrMaskedSecret(config.cookiesInput),
      hasRelaySecret: !isBlankOrMaskedSecret(config.relaySecret),
    };
  }

  if (type === "shopee") {
    return {
      shopId: getString(config, "shopId"),
      displayName: getString(config, "displayName"),
      partnerId: getString(config, "partnerId"),
      apiBaseUrl: getString(config, "apiBaseUrl"),
      authBaseUrl: getString(config, "authBaseUrl"),
      sendMessagePath: getString(config, "sendMessagePath"),
      tokenExpiresAt: getString(config, "tokenExpiresAt"),
      refreshTokenExpiresAt: getString(config, "refreshTokenExpiresAt"),
      integrationStatus: getString(config, "integrationStatus"),
      lastWebhookAt: getString(config, "lastWebhookAt"),
      lastChatReceiveAt: getString(config, "lastChatReceiveAt"),
      lastChatSendAt: getString(config, "lastChatSendAt"),
      lastWebhookEventType: getString(config, "lastWebhookEventType"),
      lastWebhookShopId: getString(config, "lastWebhookShopId"),
      lastWebhookPayloadKeys: Array.isArray(config.lastWebhookPayloadKeys)
        ? config.lastWebhookPayloadKeys.filter((value): value is string => typeof value === "string")
        : [],
      lastWebhookMessageId: getString(config, "lastWebhookMessageId"),
      lastWebhookConversationId: getString(config, "lastWebhookConversationId"),
      lastWebhookBuyerIdPresent: config.lastWebhookBuyerIdPresent === true,
      lastWebhookTextPresent: config.lastWebhookTextPresent === true,
      lastWebhookParseStatus: getString(config, "lastWebhookParseStatus"),
      lastWebhookError: getString(config, "lastWebhookError"),
      lastShopeeIdempotencyKey: getString(config, "lastShopeeIdempotencyKey"),
      hasAccessToken: !isBlankOrMaskedSecret(config.accessToken),
      hasRefreshToken: !isBlankOrMaskedSecret(config.refreshToken),
      hasPartnerKey: !isBlankOrMaskedSecret(config.partnerKey),
      hasWebhookSecret: !isBlankOrMaskedSecret(config.webhookSecret),
    };
  }

  if (type === "tiktok_shop") {
    return {
      shopId: getString(config, "shopId"),
      sellerId: getString(config, "sellerId"),
      displayName: getString(config, "displayName"),
      appKey: getString(config, "appKey"),
      clientKey: getString(config, "clientKey"),
      apiBaseUrl: getString(config, "apiBaseUrl"),
      authBaseUrl: getString(config, "authBaseUrl"),
      authorizationUrl: getString(config, "authorizationUrl"),
      sendMessagePath: getString(config, "sendMessagePath"),
      tokenExpiresAt: getString(config, "tokenExpiresAt"),
      refreshTokenExpiresAt: getString(config, "refreshTokenExpiresAt"),
      integrationStatus: getString(config, "integrationStatus"),
      lastWebhookAt: getString(config, "lastWebhookAt"),
      lastChatReceiveAt: getString(config, "lastChatReceiveAt"),
      lastChatSendAt: getString(config, "lastChatSendAt"),
      lastWebhookEventType: getString(config, "lastWebhookEventType"),
      lastWebhookShopId: getString(config, "lastWebhookShopId"),
      lastWebhookPayloadKeys: Array.isArray(config.lastWebhookPayloadKeys)
        ? config.lastWebhookPayloadKeys.filter((value): value is string => typeof value === "string")
        : [],
      lastWebhookMessageId: getString(config, "lastWebhookMessageId"),
      lastWebhookConversationId: getString(config, "lastWebhookConversationId"),
      lastWebhookBuyerIdPresent: config.lastWebhookBuyerIdPresent === true,
      lastWebhookTextPresent: config.lastWebhookTextPresent === true,
      lastWebhookParseStatus: getString(config, "lastWebhookParseStatus"),
      lastWebhookError: getString(config, "lastWebhookError"),
      lastTikTokShopIdempotencyKey: getString(config, "lastTikTokShopIdempotencyKey"),
      hasAccessToken: !isBlankOrMaskedSecret(config.accessToken),
      hasRefreshToken: !isBlankOrMaskedSecret(config.refreshToken),
      hasAppSecret: !isBlankOrMaskedSecret(config.appSecret),
      hasWebhookSecret: !isBlankOrMaskedSecret(config.webhookSecret),
    };
  }
  return sanitizeChannelConfig(type, config);
}

export function sanitizeChannelAccountForClient<T extends { type: string; config: unknown }>(
  account: T
): T {
  return {
    ...account,
    config: sanitizeChannelAccountConfig(account.type, account.config),
  };
}

export function mergeAccountConfigPreservingSecrets(
  type: string,
  incomingConfig: unknown,
  existingConfig: unknown
): unknown {
  const incoming = isRecord(incomingConfig) ? incomingConfig : {};
  const existing = isRecord(existingConfig) ? existingConfig : {};
  const merged: UnknownRecord = { ...existing, ...incoming };

  const preserveSecret = (key: string) => {
    if (isBlankOrMaskedSecret(incoming[key])) {
      if (existing[key] !== undefined) {
        merged[key] = existing[key];
      } else if (incoming[key] !== undefined) {
        merged[key] = incoming[key];
      }
    }
  };

  if (type === "facebook") {
    preserveSecret("pageAccessToken");
    preserveSecret("appSecret");
  }
  if (type === "instagram") {
    preserveSecret("accessToken");
    preserveSecret("appSecret");
  }
  if (type === "zalo") {
    preserveSecret("cookiesInput");
    preserveSecret("relaySecret");
  }
  if (type === "shopee") {
    preserveSecret("accessToken");
    preserveSecret("refreshToken");
    preserveSecret("partnerKey");
    preserveSecret("webhookSecret");
  }
  if (type === "tiktok_shop") {
    preserveSecret("accessToken");
    preserveSecret("refreshToken");
    preserveSecret("appSecret");
    preserveSecret("webhookSecret");
  }

  return merged;
}

export async function upsertDefaultChannelAccountFromChannel(input: {
  type: string;
  config: unknown;
  isActive?: boolean;
  status?: string;
}) {
  if (!isAccountChannelType(input.type)) return null;

  const externalAccountId = getExternalAccountId(input.type, input.config) || "default";
  const displayName = getDisplayName(input.type, input.config, externalAccountId);

  return prisma.channelAccount.upsert({
    where: {
      type_externalAccountId: {
        type: input.type,
        externalAccountId,
      },
    },
    update: {
      displayName,
      config: input.config ?? {},
      isActive: getBoolean(input.isActive, true),
      isDefault: true,
      status: input.status || undefined,
    },
    create: {
      type: input.type,
      externalAccountId,
      displayName,
      config: input.config ?? {},
      isActive: getBoolean(input.isActive, true),
      isDefault: true,
      status: input.status || "disconnected",
    },
  });
}

export async function findChannelAccount(type: AccountChannelType, externalAccountId?: string) {
  const trimmedExternalId = externalAccountId?.trim();

  if (trimmedExternalId) {
    const exact = await prisma.channelAccount.findFirst({
      where: {
        type,
        externalAccountId: trimmedExternalId,
        isActive: true,
      },
      orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
    });
    if (exact) return exact;
  }

  return prisma.channelAccount.findFirst({
    where: {
      type,
      isActive: true,
      OR: [{ isDefault: true }, { externalAccountId: "default" }],
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
}

export async function getChannelConfigFallback(type: string): Promise<unknown> {
  const channel = await prisma.channel.findUnique({
    where: { type },
    select: { config: true },
  });
  return channel?.config ?? {};
}
