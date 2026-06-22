import crypto from "crypto";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { getPositiveIntegerEnv } from "@/lib/channels/hardening";
import { findChannelAccount, getChannelConfigFallback } from "@/lib/channels/accounts";

export type MetaChannel = "facebook" | "instagram";

export interface MetaInboundEvent {
  channel: MetaChannel;
  senderId: string;
  recipientId: string;
  customerContact: string;
  customerName: string;
  text: string;
  rawEvent: unknown;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getNestedString(record: UnknownRecord, key: string, nestedKey: string): string {
  const nested = record[key];
  if (!isRecord(nested)) return "";
  return getString(nested[nestedKey]).trim();
}

function mapObjectToChannel(objectValue: string): MetaChannel | null {
  if (objectValue === "page") return "facebook";
  if (objectValue === "instagram") return "instagram";
  return null;
}

function logIgnoredEvent(reason: string, context: Record<string, unknown> = {}) {
  logger.debug("[Meta] Ignored webhook event", { reason, ...context });
}

export function parseMetaWebhookPayload(payload: unknown): MetaInboundEvent[] {
  if (!isRecord(payload)) {
    logIgnoredEvent("invalid_payload");
    return [];
  }

  const channel = mapObjectToChannel(getString(payload.object));
  if (!channel) {
    logIgnoredEvent("unsupported_object", {
      object: getString(payload.object) || "unknown",
    });
    return [];
  }

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  const events: MetaInboundEvent[] = [];

  for (const entry of entries) {
    if (!isRecord(entry)) continue;

    const messagingEvents = Array.isArray(entry.messaging) ? entry.messaging : [];
    for (const rawEvent of messagingEvents) {
      if (!isRecord(rawEvent)) {
        logIgnoredEvent("invalid_messaging_event", { channel });
        continue;
      }

      const message = rawEvent.message;
      if (!isRecord(message)) {
        logIgnoredEvent("non_message_event", { channel });
        continue;
      }
      if (message.is_echo === true) {
        logIgnoredEvent("echo", { channel });
        continue;
      }

      const text = getString(message.text).trim();
      if (!text) {
        logIgnoredEvent("non_text_message", { channel });
        continue;
      }

      const senderId = getNestedString(rawEvent, "sender", "id");
      const recipientId = getNestedString(rawEvent, "recipient", "id");
      if (!senderId || !recipientId) {
        logIgnoredEvent("missing_sender_or_recipient", { channel });
        continue;
      }

      events.push({
        channel,
        senderId,
        recipientId,
        customerContact: `${channel}:${recipientId}:${senderId}`,
        customerName: channel === "facebook" ? "Facebook User" : "Instagram User",
        text,
        rawEvent,
      });
    }
  }

  return events;
}

export function verifyMetaSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined
): boolean {
  if (!appSecret) return true;
  if (!signatureHeader?.startsWith("sha256=")) return false;

  const receivedHex = signatureHeader.slice("sha256=".length);
  const expectedHex = crypto
    .createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  try {
    const received = Buffer.from(receivedHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");
    if (received.length !== expected.length || received.length === 0) return false;
    return crypto.timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

function getGraphVersion(): string {
  return process.env.META_GRAPH_VERSION?.trim() || "v25.0";
}

function getConfigString(config: unknown, key: string): string {
  if (!isRecord(config)) return "";
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

async function getChannelConfig(
  channel: MetaChannel,
  options: { channelAccountId?: string | null; externalAccountId?: string } = {}
): Promise<unknown> {
  try {
    if (options.channelAccountId) {
      const account = await prisma.channelAccount.findUnique({
        where: { id: options.channelAccountId },
        select: { config: true },
      });
      if (account?.config) return account.config;
    }

    const account = await findChannelAccount(channel, options.externalAccountId);
    if (account?.config) return account.config;

    return await getChannelConfigFallback(channel);
  } catch (error) {
    logger.warn("[Meta] Failed to read account config; falling back to env", {
      channel,
      error: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
}

async function getGraphVersionForChannel(
  channel: MetaChannel,
  options: { channelAccountId?: string | null; externalAccountId?: string } = {}
): Promise<string> {
  const config = await getChannelConfig(channel, options);
  return getConfigString(config, "graphVersion") || getGraphVersion();
}

async function getAccessToken(
  channel: MetaChannel,
  options: { channelAccountId?: string | null; externalAccountId?: string } = {}
): Promise<string> {
  const config = await getChannelConfig(channel, options);
  const envName =
    channel === "facebook" ? "FACEBOOK_PAGE_ACCESS_TOKEN" : "INSTAGRAM_ACCESS_TOKEN";
  const configKey = channel === "facebook" ? "pageAccessToken" : "accessToken";
  const token = getConfigString(config, configKey) || process.env[envName]?.trim();
  if (!token) {
    throw new Error(`Missing ${envName}`);
  }
  return token;
}

async function getSendEndpoint(
  channel: MetaChannel,
  options: { channelAccountId?: string | null; externalAccountId?: string } = {}
): Promise<string> {
  const version = await getGraphVersionForChannel(channel, options);
  const host =
    channel === "facebook" ? "https://graph.facebook.com" : "https://graph.instagram.com";
  return `${host}/${version}/me/messages`;
}

async function readResponseText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, 500);
  } catch {
    return "";
  }
}

function getMaxMessageLength(): number {
  return getPositiveIntegerEnv("META_MAX_MESSAGE_LENGTH", 1800);
}

function getMaxSendRetries(): number {
  return getPositiveIntegerEnv("META_SEND_MAX_RETRIES", 2);
}

function shouldRetrySend(status: number): boolean {
  return status === 429 || status >= 500;
}

function getRetryDelayMs(retryIndex: number): number {
  const delays = [300, 1000];
  return delays[Math.min(retryIndex, delays.length - 1)] ?? 1000;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitHard(text: string, maxLength: number): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += maxLength) {
    chunks.push(text.slice(index, index + maxLength));
  }
  return chunks;
}

function splitParagraph(paragraph: string, maxLength: number): string[] {
  if (paragraph.length <= maxLength) return [paragraph];

  const chunks: string[] = [];
  let remaining = paragraph.trim();
  const sentencePattern = /[.!?。！？]\s+/g;

  while (remaining.length > maxLength) {
    let splitAt = -1;
    sentencePattern.lastIndex = 0;

    for (let match = sentencePattern.exec(remaining); match; match = sentencePattern.exec(remaining)) {
      if (match.index + match[0].length <= maxLength) {
        splitAt = match.index + match[0].length;
      } else {
        break;
      }
    }

    if (splitAt <= 0) {
      const whitespaceIndex = remaining.lastIndexOf(" ", maxLength);
      splitAt = whitespaceIndex > 0 ? whitespaceIndex : maxLength;
    }

    const chunk = remaining.slice(0, splitAt).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitAt).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks.flatMap((chunk) =>
    chunk.length > maxLength ? splitHard(chunk, maxLength) : [chunk]
  );
}

export function splitMetaText(text: string, maxLength = getMaxMessageLength()): string[] {
  const normalized = text.trim();
  if (!normalized) return [];
  if (normalized.length <= maxLength) return [normalized];

  const chunks: string[] = [];
  const paragraphs = normalized.split(/\n{2,}/);
  let current = "";

  const flushCurrent = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) continue;

    if (trimmedParagraph.length > maxLength) {
      flushCurrent();
      chunks.push(...splitParagraph(trimmedParagraph, maxLength));
      continue;
    }

    const candidate = current ? `${current}\n\n${trimmedParagraph}` : trimmedParagraph;
    if (candidate.length <= maxLength) {
      current = candidate;
    } else {
      flushCurrent();
      current = trimmedParagraph;
    }
  }

  flushCurrent();
  return chunks.flatMap((chunk) =>
    chunk.length > maxLength ? splitHard(chunk, maxLength) : [chunk]
  );
}

async function sendMetaTextChunk(input: {
  channel: MetaChannel;
  recipientId: string;
  text: string;
  token: string;
  endpoint: string;
  chunkIndex: number;
  chunkCount: number;
}): Promise<void> {
  const url = `${input.endpoint}?access_token=${encodeURIComponent(input.token)}`;
  const maxRetries = getMaxSendRetries();
  const maxAttempts = maxRetries + 1;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: { id: input.recipientId },
          message: { text: input.text },
        }),
      });
    } catch (error) {
      const canRetry = attempt < maxAttempts;
      logger.error("[Meta] Send API request failed", error, {
        channel: input.channel,
        attempt,
        chunkIndex: input.chunkIndex,
        chunkCount: input.chunkCount,
        retrying: canRetry,
      });

      if (!canRetry) throw error;
      await wait(getRetryDelayMs(attempt - 1));
      continue;
    }

    if (response.ok) return;

    const errorBody = await readResponseText(response);
    const canRetry = shouldRetrySend(response.status) && attempt < maxAttempts;

    logger.error("[Meta] Failed to send text message", undefined, {
      channel: input.channel,
      status: response.status,
      attempt,
      chunkIndex: input.chunkIndex,
      chunkCount: input.chunkCount,
      errorBody,
      retrying: canRetry,
    });

    if (!canRetry) {
      throw new Error(`Meta Send API failed with status ${response.status}`);
    }

    await wait(getRetryDelayMs(attempt - 1));
  }
}

export async function sendMetaTextMessage(input: {
  channel: MetaChannel;
  recipientId: string;
  text: string;
  channelAccountId?: string | null;
  sourceAccountId?: string;
}): Promise<void> {
  const accountOptions = {
    channelAccountId: input.channelAccountId,
    externalAccountId: input.sourceAccountId,
  };
  const token = await getAccessToken(input.channel, accountOptions);
  const endpoint = await getSendEndpoint(input.channel, accountOptions);
  const chunks = splitMetaText(input.text);

  for (const [index, chunk] of chunks.entries()) {
    await sendMetaTextChunk({
      channel: input.channel,
      recipientId: input.recipientId,
      text: chunk,
      token,
      endpoint,
      chunkIndex: index + 1,
      chunkCount: chunks.length,
    });
  }
}
