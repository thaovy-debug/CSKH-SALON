import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { chat } from "@/lib/ai/engine";
import {
  processNormalizedInboundMessage,
  type NormalizedInboundChannel,
} from "@/lib/channels/normalized";
import { logger } from "@/lib/logger";

const CHAT_CHANNELS = new Set<NormalizedInboundChannel>([
  "facebook",
  "instagram",
  "zalo",
  "whatsapp",
  "email",
  "phone",
  "sms",
  "telegram",
  "shopee",
  "tiktok_shop",
  "widget",
  "api",
]);

function normalizeChatChannel(value: unknown): NormalizedInboundChannel {
  if (typeof value !== "string") return "api";
  const channel = value.trim().toLowerCase();
  return CHAT_CHANNELS.has(channel as NormalizedInboundChannel)
    ? (channel as NormalizedInboundChannel)
    : "api";
}

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, conversationId, channel, customerName, customerContact } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    if (message.length > 10000) {
      return NextResponse.json({ error: "Message exceeds maximum length of 10000 characters" }, { status: 400 });
    }

    let convId = conversationId;

    if (convId) {
      const response = await chat(convId, message.trim());

      return NextResponse.json({
        conversationId: convId,
        response,
      });
    }

    const normalizedChannel = normalizeChatChannel(channel);
    const cleanCustomerContact = trimString(customerContact);
    const cleanCustomerName = trimString(customerName);
    const anonymousCustomerId = `anonymous:${randomUUID()}`;
    const result = await processNormalizedInboundMessage({
      channel: normalizedChannel,
      externalCustomerId: cleanCustomerContact || anonymousCustomerId,
      customerContact: cleanCustomerContact || undefined,
      customerName:
        cleanCustomerName ||
        (normalizedChannel === "widget" ? "Website Visitor" : "API User"),
      text: message,
      metadata: {
        source: "api_chat",
        ...(request.headers.get("user-agent")
          ? { userAgent: request.headers.get("user-agent") }
          : {}),
      },
    });

    return NextResponse.json({
      conversationId: result.conversationId,
      response: result.response,
    });
  } catch (error) {
    logger.error("Failed to process chat message:", error);
    return NextResponse.json(
      { error: "Failed to process message" },
      { status: 500 }
    );
  }
}
