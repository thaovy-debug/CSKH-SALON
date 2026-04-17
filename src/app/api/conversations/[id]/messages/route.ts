import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import { emitNewMessage } from "@/lib/realtime";
import { sendEmail } from "@/lib/channels/email";

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
              message: content.trim(),
            }),
          }
        );

        if (!sendRes.ok) {
          const sendResult = await sendRes.json().catch(() => null);
          logger.warn("Failed to deliver WhatsApp conversation reply", {
            conversationId: id,
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
      } else if (
        conversation.channel === "email" &&
        conversation.customerContact
      ) {
        const delivered = await sendEmail(
          conversation.customerContact,
          `Reply from ${conversation.customerName || "SalonDesk"}`,
          content.trim()
        );
        if (!delivered) {
          return NextResponse.json(
            { error: "Không gửi được email tới khách hàng" },
            { status: 502 }
          );
        }
      } else if (conversation.channel === "phone") {
        return NextResponse.json(
          {
            error:
              "Hội thoại điện thoại không hỗ trợ gửi tin nhắn văn bản thủ công",
          },
          { status: 400 }
        );
      }
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
