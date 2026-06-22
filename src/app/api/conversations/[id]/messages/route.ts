import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import { emitNewMessage } from "@/lib/realtime";
import { sendEmail } from "@/lib/channels/email";
import { sendMetaTextMessage } from "@/lib/channels/meta";
import { sendShopeeTextMessage } from "@/lib/channels/shopee";
import { sendZaloMessage } from "@/lib/channels/zalo";

type ScopedContact = {
  accountExternalId: string;
  customerExternalId: string;
};

function parseScopedContact(channel: string, contact: string): ScopedContact {
  const parts = contact.split(":").filter(Boolean);

  if (["facebook", "instagram", "zalo", "shopee", "tiktok_shop"].includes(channel)) {
    if (parts.length >= 3) {
      return {
        accountExternalId: parts[1],
        customerExternalId: parts.slice(2).join(":"),
      };
    }

    if (parts.length === 2) {
      return {
        accountExternalId: "",
        customerExternalId: parts[1],
      };
    }
  }

  return {
    accountExternalId: "",
    customerExternalId: contact,
  };
}

function getConfigString(config: unknown, key: string): string {
  if (typeof config !== "object" || config === null || Array.isArray(config)) return "";
  const value = (config as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
}

function getConversationMetadataString(metadata: unknown, key: string): string {
  return getConfigString(metadata, key);
}

async function getZaloConversationConfig(conversation: {
  channelAccountId?: string | null;
}): Promise<Record<string, string>> {
  if (conversation.channelAccountId) {
    const account = await prisma.channelAccount.findUnique({
      where: { id: conversation.channelAccountId },
      select: { config: true },
    });
    return (account?.config || {}) as Record<string, string>;
  }

  const channel = await prisma.channel.findUnique({
    where: { type: "zalo" },
    select: { config: true },
  });
  return (channel?.config || {}) as Record<string, string>;
}

async function deliverManualReply(input: {
  request: NextRequest;
  conversation: {
    id: string;
    channel: string;
    customerName: string;
    customerContact: string;
    channelAccountId?: string | null;
    metadata?: unknown;
  };
  content: string;
}): Promise<NextResponse | null> {
  const { request, conversation, content } = input;
  const scoped = parseScopedContact(conversation.channel, conversation.customerContact);

  if (
    (conversation.channel === "facebook" || conversation.channel === "instagram") &&
    conversation.customerContact
  ) {
    if (!scoped.customerExternalId) {
      return NextResponse.json(
        { error: "Không xác định được người nhận Meta từ hội thoại này" },
        { status: 400 }
      );
    }

    await sendMetaTextMessage({
      channel: conversation.channel,
      recipientId: scoped.customerExternalId,
      channelAccountId: conversation.channelAccountId,
      sourceAccountId: scoped.accountExternalId,
      text: content,
    });
    return null;
  }

  if (conversation.channel === "zalo" && conversation.customerContact) {
    const recipient = scoped.customerExternalId || conversation.customerContact;
    if (!/^\+?\d[\d\s.-]{7,}$/.test(recipient)) {
      return NextResponse.json(
        {
          error:
            "Hội thoại Zalo này không có số điện thoại hợp lệ để gửi thủ công qua Python relay",
        },
        { status: 400 }
      );
    }

    const config = await getZaloConversationConfig(conversation);
    await sendZaloMessage(config, recipient, content, conversation.channelAccountId || undefined);
    return null;
  }

  if (conversation.channel === "shopee" && conversation.customerContact) {
    if (!conversation.channelAccountId) {
      return NextResponse.json(
        { error: "Hội thoại Shopee thiếu tài khoản kết nối để gửi phản hồi" },
        { status: 400 }
      );
    }

    await sendShopeeTextMessage({
      accountId: conversation.channelAccountId,
      recipientId: scoped.customerExternalId || conversation.customerContact,
      conversationId: getConversationMetadataString(
        conversation.metadata,
        "externalConversationId"
      ),
      text: content,
    });
    return null;
  }

  if (conversation.channel === "tiktok_shop") {
    return NextResponse.json(
      {
        error:
          "TikTok Shop chưa có send adapter đã xác minh với Partner Center, nên không gửi thủ công ra khách từ màn hình hội thoại.",
      },
      { status: 501 }
    );
  }

  if (conversation.channel === "whatsapp" && conversation.customerContact) {
    const sendRes = await fetch(
      new URL("/api/channels/whatsapp", request.url),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: request.headers.get("cookie") || "",
        },
        body: JSON.stringify({
          action: "send",
          to: conversation.customerContact,
          message: content,
        }),
      }
    );

    if (!sendRes.ok) {
      const sendResult = await sendRes.json().catch(() => null);
      logger.warn("Failed to deliver WhatsApp conversation reply", {
        conversationId: conversation.id,
        customerContact: conversation.customerContact,
        error: sendResult?.error,
      });
      return NextResponse.json(
        {
          error:
            sendResult?.error ||
            "Không gửi được tin nhắn WhatsApp tới khách hàng",
        },
        { status: 502 }
      );
    }
    return null;
  }

  if (conversation.channel === "email" && conversation.customerContact) {
    const delivered = await sendEmail(
      conversation.customerContact,
      `Reply from ${conversation.customerName || "LinhKienLed1000"}`,
      content
    );
    if (!delivered) {
      return NextResponse.json(
        { error: "Không gửi được email tới khách hàng" },
        { status: 502 }
      );
    }
    return null;
  }

  if (conversation.channel === "phone") {
    return NextResponse.json(
      {
        error:
          "Hội thoại điện thoại không hỗ trợ gửi tin nhắn văn bản thủ công",
      },
      { status: 400 }
    );
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "messages:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await params;

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(messages);
  } catch (error) {
    logger.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "messages:create");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await params;
    const body = await request.json();
    const { content, role } = body;

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    const validRoles = ["customer", "assistant", "admin", "system"];
    const messageRole = validRoles.includes(role) ? role : "admin";

    if (messageRole === "assistant" || messageRole === "admin") {
      const deliveryError = await deliverManualReply({
        request,
        conversation,
        content: content.trim(),
      });
      if (deliveryError) return deliveryError;
    }

    const message = await prisma.message.create({
      data: {
        conversationId: id,
        role: messageRole,
        content: content.trim(),
      },
    });

    await prisma.conversation.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    emitNewMessage(id, {
      id: message.id,
      role: messageRole,
      content: content.trim(),
    });

    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    logger.error("Failed to create message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
