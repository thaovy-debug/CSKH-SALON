import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { handleExternalChannelMessage } from "@/lib/channels/external-message";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getConfigString(config: unknown, key: string): string {
  if (!isRecord(config)) return "";
  const value = config[key];
  return typeof value === "string" ? value.trim() : "";
}

function constantTimeEquals(expected: string, actual: string): boolean {
  if (!expected || !actual) return false;
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

function buildScopedZaloContact(sourceAccountId: string, contact: string): string {
  return sourceAccountId && sourceAccountId !== "default"
    ? `zalo:${sourceAccountId}:${contact}`
    : contact;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = String(body?.message || "").trim();
    const authorId = String(body?.authorId || "").trim();
    const threadId = String(body?.threadId || "").trim();
    const phoneNumber = String(body?.phoneNumber || "").trim();
    const accountId = String(body?.accountId || "").trim();
    const displayName = String(body?.displayName || "").trim() || "Khách Zalo";

    if (!message) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    const customerContact = phoneNumber || authorId || threadId;
    if (!customerContact) {
      return NextResponse.json({ error: "Customer contact is required" }, { status: 400 });
    }

    let channelAccountId: string | null = null;
    let sourceAccountId = accountId;
    let relaySecret = "";

    if (accountId && accountId !== "default") {
      const account = await prisma.channelAccount.findFirst({
        where: {
          type: "zalo",
          OR: [{ id: accountId }, { externalAccountId: accountId }],
        },
      });
      channelAccountId = account?.id ?? null;
      sourceAccountId = account?.externalAccountId || accountId;
      relaySecret = getConfigString(account?.config, "relaySecret");
    }

    if (relaySecret) {
      const incomingSecret = request.headers.get("x-zalo-relay-secret") || "";
      if (!constantTimeEquals(relaySecret, incomingSecret)) {
        logger.warn("[Zalo Incoming] Rejected request with invalid relay secret", {
          accountId: sourceAccountId || "unknown",
        });
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await handleExternalChannelMessage({
      channel: "zalo",
      customerContact: buildScopedZaloContact(sourceAccountId, customerContact),
      customerName: displayName,
      channelAccountId,
      sourceAccountId,
      text: message,
    });

    return NextResponse.json({
      success: true,
      conversationId: result.conversationId,
      response: result.response,
    });
  } catch (error) {
    logger.error("[Zalo Incoming] Failed to process incoming message:", error);
    return NextResponse.json(
      { error: "Failed to process incoming Zalo message" },
      { status: 500 }
    );
  }
}
