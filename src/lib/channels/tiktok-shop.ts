import crypto from "crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { processNormalizedInboundMessage } from "@/lib/channels/normalized";

type UnknownRecord = Record<string, unknown>;

export type TikTokShopAccountConfig = {
  shopId?: string;
  sellerId?: string;
  externalAccountId?: string;
  displayName?: string;
  appKey?: string;
  clientKey?: string;
  appSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  refreshTokenExpiresAt?: string;
  apiBaseUrl?: string;
  authBaseUrl?: string;
  authorizationUrl?: string;
  sendMessagePath?: string;
  webhookSecret?: string;
  integrationStatus?: string;
  lastWebhookAt?: string;
  lastChatReceiveAt?: string;
  lastChatSendAt?: string;
};

export type TikTokShopInboundEvent = {
  shopId: string;
  buyerId: string;
  customerName: string;
  conversationId: string;
  messageId: string;
  text: string;
  eventType: string;
  receivedAt?: string;
};

const DEFAULT_API_BASE_URL = "https://open-api.tiktokglobalshop.com";
const DEFAULT_AUTH_BASE_URL = "https://services.tiktokshop.com";
const DEFAULT_SEND_MESSAGE_PATH = "";

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

function getConfigString(config: unknown, key: keyof TikTokShopAccountConfig): string {
  return getString(config, key);
}

function hmacSha256Hex(value: string, key: string): string {
  return crypto.createHmac("sha256", key).update(value).digest("hex");
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

function withTikTokShopIntegrationStatus(
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

function getPayloadKeys(payload: unknown): string[] {
  if (!isRecord(payload)) return [];
  return Object.keys(payload).slice(0, 30).sort();
}

function safeShortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  return message.replace(/[\r\n\t]+/g, " ").slice(0, 160);
}

export function verifyTikTokShopWebhookSignature(input: {
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

export function createTikTokShopIdempotencyKey(
  event: Pick<TikTokShopInboundEvent, "shopId" | "messageId" | "conversationId">
): string {
  const stableId = event.messageId || event.conversationId;
  return `tiktok_shop:${event.shopId}:${stableId}`;
}

export function getTikTokShopWebhookShopId(payload: unknown): string {
  return firstString(payload, [
    ["shop_id"],
    ["shopId"],
    ["shop", "id"],
    ["seller_id"],
    ["sellerId"],
    ["data", "shop_id"],
    ["data", "shopId"],
    ["data", "shop", "id"],
    ["data", "seller_id"],
    ["data", "sellerId"],
  ]);
}

export function buildSafeTikTokShopWebhookDebugMetadata(input: {
  payload: unknown;
  events: TikTokShopInboundEvent[];
  parseStatus: "parsed" | "ignored" | "unsupported" | "error";
  error?: unknown;
}): UnknownRecord {
  const event = input.events[0];
  const shopId = event?.shopId || getTikTokShopWebhookShopId(input.payload);
  const eventType =
    event?.eventType ||
    firstString(input.payload, [["event"], ["event_type"], ["type"], ["topic"], ["data", "event_type"]]);
  const messageId =
    event?.messageId ||
    firstString(input.payload, [["message_id"], ["msg_id"], ["id"], ["data", "message_id"], ["data", "msg_id"]]);
  const conversationId =
    event?.conversationId ||
    firstString(input.payload, [["conversation_id"], ["chat_id"], ["data", "conversation_id"], ["data", "chat_id"]]);
  const buyerId =
    event?.buyerId ||
    firstString(input.payload, [["buyer_id"], ["user_id"], ["customer_id"], ["sender_id"], ["data", "buyer_id"]]);
  const text =
    event?.text ||
    firstString(input.payload, [["text"], ["content"], ["message", "text"], ["data", "text"], ["data", "message", "text"]]);

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

export async function recordTikTokShopWebhookDebugMetadata(input: {
  shopId: string;
  metadata: UnknownRecord;
  status?: string;
}): Promise<void> {
  if (!input.shopId) return;
  const account = await prisma.channelAccount.findFirst({
    where: { type: "tiktok_shop", externalAccountId: input.shopId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });
  if (!account) return;

  const nextStatus = input.status || (input.metadata.lastWebhookParseStatus === "error" ? "error" : "webhook_verified");
  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      status: nextStatus,
      config: withTikTokShopIntegrationStatus(account.config, nextStatus, input.metadata) as Prisma.InputJsonValue,
      lastError: nextStatus === "error" ? getString(input.metadata, "lastWebhookError") : "",
    },
  });
}

export function parseTikTokShopWebhookPayload(payload: unknown): TikTokShopInboundEvent[] {
  if (!isRecord(payload)) return [];

  const containers = Array.isArray(payload.data)
    ? payload.data
    : Array.isArray(payload.messages)
      ? payload.messages
      : Array.isArray(payload.message_list)
        ? payload.message_list
        : [payload];

  const events: TikTokShopInboundEvent[] = [];
  for (const item of containers) {
    const candidate = isRecord(item) ? { ...payload, item } : payload;
    const shopId = firstString(candidate, [
      ["shop_id"],
      ["shopId"],
      ["shop", "id"],
      ["seller_id"],
      ["sellerId"],
      ["data", "shop_id"],
      ["data", "shopId"],
      ["data", "seller_id"],
      ["item", "shop_id"],
      ["item", "shopId"],
      ["item", "seller_id"],
    ]);
    const buyerId = firstString(candidate, [
      ["buyer_id"],
      ["user_id"],
      ["customer_id"],
      ["from_id"],
      ["sender_id"],
      ["data", "buyer_id"],
      ["data", "user_id"],
      ["data", "customer_id"],
      ["data", "sender_id"],
      ["message", "sender_id"],
      ["item", "buyer_id"],
      ["item", "user_id"],
      ["item", "customer_id"],
      ["item", "sender_id"],
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
        ["session_id"],
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
        ["event_id"],
        ["data", "message_id"],
        ["data", "msg_id"],
        ["data", "id"],
        ["item", "message_id"],
        ["item", "msg_id"],
        ["item", "id"],
      ]) || crypto.createHash("sha256").update(`${shopId}:${buyerId}:${text}`).digest("hex");
    const eventType =
      firstString(candidate, [
        ["event"],
        ["event_type"],
        ["type"],
        ["topic"],
        ["data", "event"],
        ["data", "event_type"],
        ["data", "type"],
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
          ["nickname"],
          ["data", "buyer_name"],
          ["item", "buyer_name"],
          ["item", "username"],
          ["item", "nickname"],
        ]) || "TikTok Shop User",
      conversationId,
      messageId,
      text,
      eventType,
      receivedAt:
        firstString(candidate, [
          ["timestamp"],
          ["created_at"],
          ["create_time"],
          ["data", "timestamp"],
          ["item", "timestamp"],
          ["item", "created_at"],
        ]) || undefined,
    });
  }

  return events;
}

export async function processTikTokShopInboundEvent(event: TikTokShopInboundEvent): Promise<{
  conversationId: string;
  response: string;
  channelAccountId: string | null;
  sent: boolean;
  sendSkippedReason: string;
}> {
  const account = await prisma.channelAccount.findFirst({
    where: {
      type: "tiktok_shop",
      externalAccountId: event.shopId,
      isActive: true,
    },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  if (!account) {
    logger.warn("[TikTok Shop] Ignored event for unknown shop", {
      shopId: event.shopId,
      eventType: event.eventType,
    });
    throw new Error("TikTok Shop channel account not found for shop_id");
  }

  const idempotencyKey = createTikTokShopIdempotencyKey(event);
  const receivedAt = event.receivedAt || new Date().toISOString();

  await prisma.channelAccount.update({
    where: { id: account.id },
    data: {
      status: "chat_receive_verified",
      config: withTikTokShopIntegrationStatus(account.config, "chat_receive_verified", {
        lastWebhookAt: new Date().toISOString(),
        lastChatReceiveAt: receivedAt,
        lastTikTokShopIdempotencyKey: idempotencyKey,
      }) as Prisma.InputJsonValue,
      lastError: "",
    },
  });

  const result = await processNormalizedInboundMessage({
    channel: "tiktok_shop",
    externalAccountId: event.shopId,
    channelAccountId: account.id,
    externalCustomerId: event.buyerId,
    customerContact: `tiktok_shop:${event.shopId}:${event.buyerId}`,
    customerName: event.customerName,
    externalConversationId: event.conversationId,
    platformMessageId: event.messageId,
    text: event.text,
    receivedAt,
    metadata: {
      provider: "tiktok_shop",
      shopId: event.shopId,
      eventType: event.eventType,
      idempotencyKey,
    },
  });

  return {
    conversationId: result.conversationId,
    response: result.response,
    channelAccountId: account.id,
    sent: false,
    sendSkippedReason: "send_adapter_requires_partner_center_verification",
  };
}

export function getTikTokShopAccountReadiness(config: unknown): {
  ok: boolean;
  missing: string[];
} {
  const missing = [
    getConfigString(config, "appKey") || getConfigString(config, "clientKey") ? "" : "appKey/clientKey",
    getConfigString(config, "appSecret") ? "" : "appSecret",
    getConfigString(config, "shopId") || getConfigString(config, "externalAccountId") ? "" : "shopId",
    getConfigString(config, "accessToken") ? "" : "accessToken",
    getConfigString(config, "refreshToken") ? "" : "refreshToken",
  ].filter(Boolean);

  return { ok: missing.length === 0, missing };
}

export function getTikTokShopDefaultConfig(): Pick<
  TikTokShopAccountConfig,
  "apiBaseUrl" | "authBaseUrl" | "sendMessagePath"
> {
  return {
    apiBaseUrl: DEFAULT_API_BASE_URL,
    authBaseUrl: DEFAULT_AUTH_BASE_URL,
    sendMessagePath: DEFAULT_SEND_MESSAGE_PATH,
  };
}
