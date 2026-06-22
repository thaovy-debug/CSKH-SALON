import { NextRequest, NextResponse } from "next/server";
import {
  parseMetaWebhookPayload,
  sendMetaTextMessage,
  verifyMetaSignature,
} from "@/lib/channels/meta";
import { handleExternalChannelMessage } from "@/lib/channels/external-message";
import {
  getPositiveIntegerEnv,
  TimeoutError,
  withTimeout,
} from "@/lib/channels/hardening";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { findChannelAccount } from "@/lib/channels/accounts";

function getConfigString(config: unknown, key: string): string {
  if (typeof config !== "object" || config === null || Array.isArray(config)) return "";
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));
}

async function getMetaChannelConfigs() {
  const [channels, accounts] = await Promise.all([
    prisma.channel.findMany({
      where: { type: { in: ["facebook", "instagram"] } },
      select: { config: true },
      take: 2,
    }),
    prisma.channelAccount.findMany({
      where: { type: { in: ["facebook", "instagram"] }, isActive: true },
      select: { config: true },
    }),
  ]);

  return [
    ...(Array.isArray(channels) ? channels : []),
    ...(Array.isArray(accounts) ? accounts : []),
  ];
}

async function getVerifyTokens(): Promise<string[]> {
  const tokens = [process.env.META_VERIFY_TOKEN];
  const channels = await getMetaChannelConfigs();

  for (const channel of Array.isArray(channels) ? channels : []) {
    tokens.push(getConfigString(channel.config, "verifyToken"));
  }

  return uniqueNonEmpty(tokens);
}

async function getAppSecrets(): Promise<string[]> {
  const secrets = [process.env.META_APP_SECRET];
  const channels = await getMetaChannelConfigs();

  for (const channel of Array.isArray(channels) ? channels : []) {
    secrets.push(getConfigString(channel.config, "appSecret"));
  }

  return uniqueNonEmpty(secrets);
}

async function hasValidSignature(rawBody: string, signatureHeader: string | null) {
  const appSecrets = await getAppSecrets();
  if (appSecrets.length === 0) return process.env.NODE_ENV !== "production";

  return appSecrets.some((appSecret) =>
    verifyMetaSignature(rawBody, signatureHeader, appSecret)
  );
}

function getEventTimeoutMs(): number {
  return getPositiveIntegerEnv("META_WEBHOOK_EVENT_TIMEOUT_MS", 8000);
}

async function processMetaEvent(event: ReturnType<typeof parseMetaWebhookPayload>[number]) {
  const startedAt = Date.now();
  const account = await findChannelAccount(event.channel, event.recipientId);
  const result = await handleExternalChannelMessage({
    channel: event.channel,
    customerContact: event.customerContact,
    customerName: event.customerName,
    channelAccountId: account?.id ?? null,
    sourceAccountId: event.recipientId,
    text: event.text,
  });

  await sendMetaTextMessage({
    channel: event.channel,
    recipientId: event.senderId,
    channelAccountId: account?.id ?? null,
    sourceAccountId: event.recipientId,
    text: result.response,
  });

  logger.info("[Meta Webhook] Processed event", {
    channel: event.channel,
    conversationId: result.conversationId,
    channelAccountId: account?.id ?? null,
    sourceAccountId: event.recipientId,
    durationMs: Date.now() - startedAt,
  });
}

export async function GET(request: NextRequest) {
  const verifyTokens = await getVerifyTokens();
  if (verifyTokens.length === 0) {
    return NextResponse.json(
      { error: "META_VERIFY_TOKEN is not configured" },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token && verifyTokens.includes(token) && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "Invalid verify token" }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  const isValidSignature = await hasValidSignature(
    rawBody,
    request.headers.get("x-hub-signature-256")
  );

  if (!isValidSignature) {
    logger.warn("[Meta Webhook] Invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    logger.warn("[Meta Webhook] Invalid JSON payload", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const events = parseMetaWebhookPayload(payload);
  const timeoutMs = getEventTimeoutMs();

  for (const event of events) {
    try {
      await withTimeout(
        processMetaEvent(event),
        timeoutMs,
        `Meta ${event.channel} event`
      );
    } catch (error) {
      if (error instanceof TimeoutError) {
        logger.warn("[Meta Webhook] Event processing timed out", {
          channel: event.channel,
          timeoutMs,
        });
        continue;
      }

      logger.error("[Meta Webhook] Failed to process event", error, {
        channel: event.channel,
      });
    }
  }

  return NextResponse.json({ ok: true, received: events.length });
}
