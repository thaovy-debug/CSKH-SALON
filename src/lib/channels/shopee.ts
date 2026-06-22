import crypto from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { processNormalizedInboundMessage } from "@/lib/channels/normalized";

type UnknownRecord = Record<string, unknown>;

export type ShopeeAccountConfig = {
  shopId?: string;
  externalAccountId?: string;
  displayName?: string;
  partnerId?: string;
  partnerKey?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  tokenUpdatedAt?: string;
  apiBaseUrl?: string;
  authBaseUrl?: string;
  redirectUrl?: string;
  sendMessagePath?: string;
  webhookSecret?: string;
  integrationStatus?: string;
  lastWebhookAt?: string;
  lastChatReceiveAt?: string;
  lastChatSendAt?: string;
};

export type ShopeeInboundEvent = {
  shopId: string;
  buyerId: string;
  customerName: string;
  conversationId: string;
  messageId: string;
  text: string;
  eventType: string;
  receivedAt?: string;
};

const DEFAULT_API_BASE_URL = "https://partner.shopeemobile.com";
const DEFAULT_AUTH_BASE_URL = "https://partner.shopeemobile.com";
const SHOP_AUTH_PATH = "/api/v2/shop/auth_partner";
const TOKEN_GET_PATH = "/api/v2/auth/token/get";
const TOKEN_REFRESH_PATH = "/api/v2/auth/access_token/get";
const DEFAULT_SEND_MESSAGE_PATH = "/api/v2/sellerchat/send_message";
const ACCESS_TOKEN_TTL_MS = 4 * 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const TOKEN_REFRESH_SKEW_MS = 10 * 60 * 1000;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(record: unknown, key: string): string {
  if (!isRecord(record)) return "";
  const value = record[key];
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "bigint") return String(value);
  return "";
}

function getNestedValue(value: unknown, path: string[]): unknown {
  let current = value;
  for (const part of path) {
    if (!isRecord(current)) return undefined;
    current = current[part];
  }
  return current;
}

function firstString(payload: unknown, paths: string[][]): string {
  for (const path of paths) {
    const value = getNestedValue(payload, path);
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" || typeof value === "bigint") return String(value);
  }
  return "";
}

function getConfigString(config: unknown, key: keyof ShopeeAccountConfig): string {
  return getString(config, key);
}

function getApiBaseUrl(config?: unknown): string {
  return getConfigString(config, "apiBaseUrl") || DEFAULT_API_BASE_URL;
}

function getAuthBaseUrl(config?: unknown): string {
  return getConfigString(config, "authBaseUrl") || DEFAULT_AUTH_BASE_URL;
}

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function toTimestampSeconds(date = new Date()): number {
  return Math.floor(date.getTime() / 1000);
}

function hmacSha256Hex(value: string, key: string): string {
  return crypto.createHmac("sha256", key).update(value).digest("hex");
}

export function createShopeeSign(input: {
  partnerId: string;
  partnerKey: string;
  path: string;
  timestamp: number;
  accessToken?: string;
  shopId?: string;
  merchantId?: string;
}): string {
  const base =
    input.partnerId +
    normalizePath(input.path) +
    String(input.timestamp) +
    (input.accessToken || "") +
    (input.shopId || input.merchantId || "");
  return hmacSha256Hex(base, input.partnerKey);
}

function appendShopeeAuthParams(
  url: URL,
  input: {
    partnerId: string;
    partnerKey: string;
    path: string;
    timestamp?: number;
    accessToken?: string;
    shopId?: string;
    merchantId?: string;
  }
) {
  const timestamp = input.timestamp ?? toTimestampSeconds();
  url.searchParams.set("partner_id", input.partnerId);
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set(
    "sign",
    createShopeeSign({
      partnerId: input.partnerId,
      partnerKey: input.partnerKey,
      path: input.path,
      timestamp,
      accessToken: input.accessToken,
      shopId: input.shopId,
      merchantId: input.merchantId,
    })
  );
  if (input.accessToken) url.searchParams.set("access_token", input.accessToken);
  if (input.shopId) url.searchParams.set("shop_id", input.shopId);
  if (input.merchantId) url.searchParams.set("merchant_id", input.merchantId);
}

export function buildShopeeShopAuthUrl(input: {
  partnerId: string;
  partnerKey: string;
  redirectUrl: string;
  authBaseUrl?: string;
  timestamp?: number;
}): string {
  const url = new URL(SHOP_AUTH_PATH, input.authBaseUrl || DEFAULT_AUTH_BASE_URL);
  appendShopeeAuthParams(url, {
    partnerId: input.partnerId,
    partnerKey: input.partnerKey,
    path: SHOP_AUTH_PATH,
    timestamp: input.timestamp,
  });
  url.searchParams.set("redirect", input.redirectUrl);
  return url.toString();
}

function requireShopeeCredentials(config: unknown): {
  partnerId: string;
  partnerKey: string;
} {
  const partnerId = getConfigString(config, "partnerId");
  const partnerKey = getConfigString(config, "partnerKey");
  if (!partnerId) throw new Error("Missing Shopee partnerId");
  if (!partnerKey) throw new Error("Missing Shopee partnerKey");
  return { partnerId, partnerKey };
}

function requireShopeeShopCredentials(config: unknown): {
  partnerId: string;
  partnerKey: string;
  shopId: string;
  accessToken: string;
} {
  const { partnerId, partnerKey } = requireShopeeCredentials(config);
  const shopId =
    getConfigString(config, "shopId") || getConfigString(config, "externalAccountId");
  const accessToken = getConfigString(config, "accessToken");
  if (!shopId) throw new Error("Missing Shopee shopId");
  if (!accessToken) throw new Error("Missing Shopee accessToken");
  return { partnerId, partnerKey, shopId, accessToken };
}

async function parseShopeeJsonResponse(response: Response): Promise<UnknownRecord> {
  const text = await response.text();
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

function getResponseError(payload: UnknownRecord): string {
  const error = getString(payload, "error");
  const message = getString(payload, "message") || getString(payload, "msg");
  return [error, message].filter(Boolean).join(": ") || "Unknown Shopee API error";
}

function pickTokenPayload(payload: UnknownRecord): UnknownRecord {
  const response = payload.response;
  return isRecord(response) ? response : payload;
}

function withShopeeIntegrationStatus(
  config: unknown,
  integrationStatus: string,
  extra: UnknownRecord = {}
): UnknownRecord {
  const existing = isRecord(config) ? config : {};
  return {
    ...existing,
    ...extra,
    integrationStatus,
  };
}

function buildTokenConfig(input: {
  existingConfig: unknown;
  shopId: string;
  accessToken: string;
  refreshToken: string;
}): UnknownRecord {
  const now = new Date();
  const existing = isRecord(input.existingConfig) ? input.existingConfig : {};
  return {
    ...existing,
    shopId: input.shopId,
    externalAccountId: input.shopId,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    integrationStatus: "authorized",
    tokenUpdatedAt: now.toISOString(),
    tokenExpiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS).toISOString(),
    refreshTokenExpiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS).toISOString(),
  };
}

export async function exchangeShopeeAuthCode(input: {
  accountId: string;
  code: string;
  shopId: string;
}): Promise<{ accountId: string; shopId: string }> {
  const account = await prisma.channelAccount.findUnique({ where: { id: input.accountId } });
  if (!account || account.type !== "shopee") {
    throw new Error("Shopee channel account not found");
  }

  const { partnerId, partnerKey } = requireShopeeCredentials(account.config);
  const apiBaseUrl = getApiBaseUrl(account.config);
  const url = new URL(TOKEN_GET_PATH, apiBaseUrl);
  appendShopeeAuthParams(url, {
    partnerId,
    partnerKey,
    path: TOKEN_GET_PATH,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: input.code,
      shop_id: Number(input.shopId) || input.shopId,
      partner_id: Number(partnerId) || partnerId,
    }),
  });
  const payload = await parseShopeeJsonResponse(response);
  const tokenPayload = pickTokenPayload(payload);

  if (!response.ok || getString(payload, "error")) {
    throw new Error(`Shopee auth token exchange failed: ${getResponseError(payload)}`);
  }

  const accessToken = getString(tokenPayload, "access_token");
  const refreshToken = getString(tokenPayload, "refresh_token");
  const shopId = getString(tokenPayload, "shop_id") || input.shopId;
  if (!accessToken || !refreshToken || !shopId) {
    throw new Error("Shopee token exchange response is missing token or shop_id");
  }

  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      externalAccountId: shopId,
      config: buildTokenConfig({
        existingConfig: account.config,
        shopId,
        accessToken,
        refreshToken,
      }) as Prisma.InputJsonValue,
      status: "authorized",
      isActive: true,
      lastConnectedAt: new Date(),
      lastError: "",
    },
  });

  return { accountId: account.id, shopId };
}

export async function refreshShopeeAccessToken(accountId: string): Promise<void> {
  const account = await prisma.channelAccount.findUnique({ where: { id: accountId } });
  if (!account || account.type !== "shopee") {
    throw new Error("Shopee channel account not found");
  }

  const { partnerId, partnerKey } = requireShopeeCredentials(account.config);
  const shopId =
    getConfigString(account.config, "shopId") ||
    getConfigString(account.config, "externalAccountId") ||
    account.externalAccountId;
  const refreshToken = getConfigString(account.config, "refreshToken");
  if (!shopId) throw new Error("Missing Shopee shopId");
  if (!refreshToken) throw new Error("Missing Shopee refreshToken");

  const apiBaseUrl = getApiBaseUrl(account.config);
  const url = new URL(TOKEN_REFRESH_PATH, apiBaseUrl);
  appendShopeeAuthParams(url, {
    partnerId,
    partnerKey,
    path: TOKEN_REFRESH_PATH,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refresh_token: refreshToken,
      shop_id: Number(shopId) || shopId,
      partner_id: Number(partnerId) || partnerId,
    }),
  });
  const payload = await parseShopeeJsonResponse(response);
  const tokenPayload = pickTokenPayload(payload);

  if (!response.ok || getString(payload, "error")) {
    throw new Error(`Shopee token refresh failed: ${getResponseError(payload)}`);
  }

  const accessToken = getString(tokenPayload, "access_token");
  const nextRefreshToken = getString(tokenPayload, "refresh_token") || refreshToken;
  if (!accessToken) throw new Error("Shopee token refresh response is missing access_token");

  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      config: buildTokenConfig({
        existingConfig: account.config,
        shopId,
        accessToken,
        refreshToken: nextRefreshToken,
      }) as Prisma.InputJsonValue,
      status: "authorized",
      isActive: true,
      lastError: "",
    },
  });
}

function timingSafeCompareHex(expectedHex: string, receivedHex: string): boolean {
  try {
    const expected = Buffer.from(expectedHex, "hex");
    const received = Buffer.from(receivedHex, "hex");
    if (expected.length === 0 || expected.length !== received.length) return false;
    return crypto.timingSafeEqual(expected, received);
  } catch {
    return false;
  }
}

export function verifyShopeeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null;
  secret?: string;
}): boolean {
  const secret = input.secret?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = input.signatureHeader?.trim();
  if (!header) return false;

  const receivedHex = header.startsWith("sha256=")
    ? header.slice("sha256=".length)
    : header;
  const expectedHex = hmacSha256Hex(input.rawBody, secret);
  return timingSafeCompareHex(expectedHex, receivedHex);
}

export function isShopeeTokenExpiringSoon(config: unknown, now = new Date()): boolean {
  const tokenExpiresAt = getConfigString(config, "tokenExpiresAt");
  if (!tokenExpiresAt) return false;
  const expiresAt = Date.parse(tokenExpiresAt);
  if (!Number.isFinite(expiresAt)) return true;
  return expiresAt - now.getTime() <= TOKEN_REFRESH_SKEW_MS;
}

export function createShopeeIdempotencyKey(event: Pick<ShopeeInboundEvent, "shopId" | "messageId" | "conversationId">): string {
  const stableId = event.messageId || event.conversationId;
  return `shopee:${event.shopId}:${stableId}`;
}

function getPayloadKeys(payload: unknown): string[] {
  if (!isRecord(payload)) return [];
  return Object.keys(payload).slice(0, 30).sort();
}

export function getShopeeWebhookShopId(payload: unknown): string {
  return firstString(payload, [
    ["shop_id"],
    ["shopid"],
    ["shopId"],
    ["data", "shop_id"],
    ["data", "shopid"],
    ["data", "shopId"],
  ]);
}

function safeShortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 160);
}

export function buildSafeShopeeWebhookDebugMetadata(input: {
  payload: unknown;
  events: ShopeeInboundEvent[];
  parseStatus: "parsed" | "ignored" | "unsupported" | "error";
  error?: unknown;
}): UnknownRecord {
  const event = input.events[0];
  const shopId = event?.shopId || getShopeeWebhookShopId(input.payload);
  const eventType =
    event?.eventType ||
    firstString(input.payload, [["event"], ["event_type"], ["code"], ["type"], ["data", "event_type"]]);
  const messageId = event?.messageId || firstString(input.payload, [["message_id"], ["msg_id"], ["data", "message_id"], ["data", "msg_id"]]);
  const conversationId =
    event?.conversationId ||
    firstString(input.payload, [["conversation_id"], ["chat_id"], ["data", "conversation_id"], ["data", "chat_id"]]);
  const buyerId = event?.buyerId || firstString(input.payload, [["buyer_id"], ["from_id"], ["sender_id"], ["data", "buyer_id"]]);
  const text = event?.text || firstString(input.payload, [["text"], ["content"], ["message", "text"], ["data", "text"], ["data", "message", "text"]]);

  return {
    lastWebhookAt: new Date().toISOString(),
    lastWebhookEventType: eventType,
    lastWebhookShopId: shopId,
    lastWebhookPayloadKeys: getPayloadKeys(input.payload),
    lastWebhookMessageId: messageId,
    lastWebhookConversationId: conversationId,
    lastWebhookBuyerIdPresent: Boolean(buyerId),
    lastWebhookTextPresent: Boolean(text),
    lastWebhookParseStatus: input.parseStatus,
    ...(input.error ? { lastWebhookError: safeShortError(input.error) } : {}),
  };
}

export async function recordShopeeWebhookDebugMetadata(input: {
  shopId: string;
  metadata: UnknownRecord;
  status?: string;
}): Promise<void> {
  if (!input.shopId) return;
  const account = await prisma.channelAccount.findFirst({
    where: { type: "shopee", externalAccountId: input.shopId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  if (!account) return;

  const nextStatus = input.status || (input.metadata.lastWebhookParseStatus === "error" ? "error" : "webhook_verified");
  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      status: nextStatus,
      config: withShopeeIntegrationStatus(account.config, nextStatus, input.metadata) as Prisma.InputJsonValue,
      lastError: nextStatus === "error" ? getString(input.metadata, "lastWebhookError") : "",
    },
  });
}

export function parseShopeeWebhookPayload(payload: unknown): ShopeeInboundEvent[] {
  if (!isRecord(payload)) return [];

  const containers = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.messages)
      ? payload.messages
      : Array.isArray(payload.message_list)
        ? payload.message_list
        : [payload];

  const events: ShopeeInboundEvent[] = [];
  for (const item of containers) {
    const candidate = isRecord(item) ? { ...payload, item } : payload;
    const shopId = firstString(candidate, [
      ["shop_id"],
      ["shopid"],
      ["shopId"],
      ["data", "shop_id"],
      ["item", "shop_id"],
      ["item", "shopid"],
      ["item", "shopId"],
    ]);
    const buyerId = firstString(candidate, [
      ["buyer_id"],
      ["from_id"],
      ["sender_id"],
      ["user_id"],
      ["data", "buyer_id"],
      ["data", "from_id"],
      ["message", "from_id"],
      ["message", "sender_id"],
      ["item", "buyer_id"],
      ["item", "from_id"],
      ["item", "sender_id"],
      ["item", "user_id"],
    ]);
    const text = firstString(candidate, [
      ["text"],
      ["content"],
      ["message"],
      ["message", "text"],
      ["message", "content"],
      ["data", "text"],
      ["data", "content"],
      ["data", "message"],
      ["data", "message", "text"],
      ["data", "message", "content"],
      ["item", "text"],
      ["item", "content"],
      ["item", "message"],
      ["item", "message", "text"],
      ["item", "message", "content"],
    ]);
    if (!shopId || !buyerId || !text) continue;

    const conversationId =
      firstString(candidate, [
        ["conversation_id"],
        ["conversationId"],
        ["chat_id"],
        ["data", "conversation_id"],
        ["data", "chat_id"],
        ["item", "conversation_id"],
        ["item", "chat_id"],
      ]) || `${shopId}:${buyerId}`;
    const messageId =
      firstString(candidate, [
        ["message_id"],
        ["msg_id"],
        ["id"],
        ["data", "message_id"],
        ["data", "msg_id"],
        ["item", "message_id"],
        ["item", "msg_id"],
        ["item", "id"],
      ]) || crypto.createHash("sha256").update(`${shopId}:${buyerId}:${text}`).digest("hex");
    const eventType =
      firstString(candidate, [
        ["event"],
        ["event_type"],
        ["code"],
        ["type"],
        ["data", "event"],
        ["data", "event_type"],
        ["data", "code"],
        ["item", "event"],
        ["item", "event_type"],
        ["item", "type"],
      ]) || "message";

    events.push({
      shopId,
      buyerId,
      customerName:
        firstString(candidate, [
          ["buyer_name"],
          ["username"],
          ["data", "buyer_name"],
          ["item", "buyer_name"],
          ["item", "username"],
        ]) || "Shopee User",
      conversationId,
      messageId,
      text,
      eventType,
      receivedAt:
        firstString(candidate, [
          ["timestamp"],
          ["created_at"],
          ["data", "timestamp"],
          ["item", "timestamp"],
          ["item", "created_at"],
        ]) || undefined,
    });
  }

  return events;
}

export async function sendShopeeTextMessage(input: {
  accountId: string;
  recipientId: string;
  text: string;
  conversationId?: string;
}): Promise<void> {
  let account = await prisma.channelAccount.findUnique({ where: { id: input.accountId } });
  if (!account || account.type !== "shopee") {
    throw new Error("Shopee channel account not found");
  }

  if (isShopeeTokenExpiringSoon(account.config)) {
    await refreshShopeeAccessToken(account.id);
    const refreshedAccount = await prisma.channelAccount.findUnique({ where: { id: input.accountId } });
    if (!refreshedAccount || refreshedAccount.type !== "shopee") {
      throw new Error("Shopee channel account not found after token refresh");
    }
    account = refreshedAccount;
  }

  const { partnerId, partnerKey, shopId, accessToken } = requireShopeeShopCredentials(
    account.config
  );
  const path = normalizePath(
    getConfigString(account.config, "sendMessagePath") || DEFAULT_SEND_MESSAGE_PATH
  );
  const apiBaseUrl = getApiBaseUrl(account.config);
  const url = new URL(path, apiBaseUrl);
  appendShopeeAuthParams(url, {
    partnerId,
    partnerKey,
    path,
    accessToken,
    shopId,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to_id: Number(input.recipientId) || input.recipientId,
      shop_id: Number(shopId) || shopId,
      message_type: "text",
      content: {
        text: input.text,
      },
      ...(input.conversationId ? { conversation_id: input.conversationId } : {}),
    }),
  });

  if (response.ok) return;

  const payload = await parseShopeeJsonResponse(response);
  throw new Error(`Shopee send message failed: ${getResponseError(payload)}`);
}

export async function processShopeeInboundEvent(event: ShopeeInboundEvent): Promise<{
  conversationId: string;
  response: string;
  channelAccountId: string | null;
  sent: boolean;
}> {
  const account = await prisma.channelAccount.findFirst({
    where: {
      type: "shopee",
      externalAccountId: event.shopId,
      isActive: true,
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  if (!account) {
    logger.warn("[Shopee] Ignored event for unknown shop", {
      shopId: event.shopId,
      eventType: event.eventType,
    });
    throw new Error("Shopee channel account not found for shop_id");
  }

  const idempotencyKey = createShopeeIdempotencyKey(event);

  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      status: "chat_receive_verified",
      config: withShopeeIntegrationStatus(account.config, "chat_receive_verified", {
        lastWebhookAt: new Date().toISOString(),
        lastChatReceiveAt: event.receivedAt || new Date().toISOString(),
        lastShopeeIdempotencyKey: idempotencyKey,
      }) as Prisma.InputJsonValue,
      lastError: "",
    },
  });

  const result = await processNormalizedInboundMessage({
    channel: "shopee",
    externalAccountId: event.shopId,
    channelAccountId: account.id,
    externalCustomerId: event.buyerId,
    customerContact: `shopee:${event.shopId}:${event.buyerId}`,
    customerName: event.customerName,
    externalConversationId: event.conversationId,
    platformMessageId: event.messageId,
    text: event.text,
    receivedAt: event.receivedAt,
    metadata: {
      provider: "shopee",
      shopId: event.shopId,
      eventType: event.eventType,
      idempotencyKey,
    },
  });

  let sent = false;
  try {
    await sendShopeeTextMessage({
      accountId: account.id,
      recipientId: event.buyerId,
      conversationId: event.conversationId,
      text: result.response,
    });
    sent = true;
    await prisma.channelAccount.update({
      where: { id: account.id },
      data: {
        status: "chat_send_verified",
        config: withShopeeIntegrationStatus(account.config, "chat_send_verified", {
          lastWebhookAt: new Date().toISOString(),
          lastChatReceiveAt: event.receivedAt || new Date().toISOString(),
          lastChatSendAt: new Date().toISOString(),
          lastShopeeIdempotencyKey: idempotencyKey,
        }) as Prisma.InputJsonValue,
        lastError: "",
      },
    });
  } catch (error) {
    logger.error("[Shopee] Failed to send reply", error, {
      shopId: event.shopId,
      buyerId: event.buyerId,
      messageId: event.messageId,
    });
  }

  return {
    conversationId: result.conversationId,
    response: result.response,
    channelAccountId: account.id,
    sent,
  };
}

export function getShopeeAccountReadiness(config: unknown): {
  ok: boolean;
  missing: string[];
} {
  const missing = [
    getConfigString(config, "partnerId") ? "" : "partnerId",
    getConfigString(config, "partnerKey") ? "" : "partnerKey",
    getConfigString(config, "shopId") || getConfigString(config, "externalAccountId")
      ? ""
      : "shopId",
    getConfigString(config, "accessToken") ? "" : "accessToken",
    getConfigString(config, "refreshToken") ? "" : "refreshToken",
  ].filter(Boolean);

  return { ok: missing.length === 0, missing };
}

export function buildShopeeAuthStartUrlForAccount(input: {
  accountId: string;
  config: unknown;
  origin: string;
}): string {
  const { partnerId, partnerKey } = requireShopeeCredentials(input.config);
  const authBaseUrl = getAuthBaseUrl(input.config);
  const configuredRedirect = getConfigString(input.config, "redirectUrl");
  const redirectUrl =
    configuredRedirect ||
    `${input.origin.replace(/\/$/, "")}/api/channels/shopee/auth/callback?accountId=${encodeURIComponent(input.accountId)}`;

  return buildShopeeShopAuthUrl({
    partnerId,
    partnerKey,
    redirectUrl,
    authBaseUrl,
  });
}






