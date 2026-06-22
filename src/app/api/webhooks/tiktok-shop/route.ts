import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildSafeTikTokShopWebhookDebugMetadata,
  getTikTokShopWebhookShopId,
  parseTikTokShopWebhookPayload,
  processTikTokShopInboundEvent,
  recordTikTokShopWebhookDebugMetadata,
  verifyTikTokShopWebhookSignature,
} from "@/lib/channels/tiktok-shop";
import { logger } from "@/lib/logger";

function getConfigString(config: unknown, key: string): string {
  if (typeof config !== "object" || config === null || Array.isArray(config)) return "";
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function getSignatureHeader(request: NextRequest): string | null {
  return (
    request.headers.get("authorization") ||
    request.headers.get("x-tts-signature") ||
    request.headers.get("x-tiktok-shop-signature") ||
    request.headers.get("x-tiktok-hmac-sha256") ||
    request.headers.get("x-tiktok-sign")
  );
}

async function getTikTokShopSecretForShop(shopId: string): Promise<string> {
  const account = await prisma.channelAccount.findFirst({
    where: { type: "tiktok_shop", externalAccountId: shopId, isActive: true },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  if (!account) return "";
  return getConfigString(account.config, "webhookSecret") || getConfigString(account.config, "appSecret");
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch (error) {
    logger.warn("[TikTok Shop Webhook] Invalid JSON payload", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const events = parseTikTokShopWebhookPayload(payload);
  const shopId = events[0]?.shopId || getTikTokShopWebhookShopId(payload);
  const signatureHeader = getSignatureHeader(request);
  const secret = shopId ? await getTikTokShopSecretForShop(shopId) : "";
  const isValidSignature = verifyTikTokShopWebhookSignature({
    rawBody,
    signatureHeader,
    secret,
  });

  if (!isValidSignature) {
    if (shopId) {
      await recordTikTokShopWebhookDebugMetadata({
        shopId,
        status: "error",
        metadata: buildSafeTikTokShopWebhookDebugMetadata({
          payload,
          events,
          parseStatus: "error",
          error: "Invalid signature",
        }),
      });
    }
    logger.warn("[TikTok Shop Webhook] Invalid signature", { shopId });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  if (events.length === 0) {
    if (shopId) {
      await recordTikTokShopWebhookDebugMetadata({
        shopId,
        metadata: buildSafeTikTokShopWebhookDebugMetadata({
          payload,
          events,
          parseStatus: "unsupported",
        }),
      });
    }
    return NextResponse.json({ ok: true, received: 0, processed: 0, sent: 0 });
  }

  await recordTikTokShopWebhookDebugMetadata({
    shopId: events[0].shopId,
    metadata: buildSafeTikTokShopWebhookDebugMetadata({
      payload,
      events,
      parseStatus: "parsed",
    }),
  });

  let processed = 0;
  let sent = 0;
  for (const event of events) {
    try {
      const result = await processTikTokShopInboundEvent(event);
      processed += 1;
      if (result.sent) sent += 1;
    } catch (error) {
      await recordTikTokShopWebhookDebugMetadata({
        shopId: event.shopId,
        status: "error",
        metadata: buildSafeTikTokShopWebhookDebugMetadata({
          payload,
          events: [event],
          parseStatus: "error",
          error,
        }),
      });
      logger.error("[TikTok Shop Webhook] Failed to process event", error, {
        shopId: event.shopId,
        messageId: event.messageId,
        eventType: event.eventType,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    received: events.length,
    processed,
    sent,
  });
}
