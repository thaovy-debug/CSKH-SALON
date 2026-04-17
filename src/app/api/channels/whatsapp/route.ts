import { NextRequest, NextResponse } from "next/server";
import {
  getWhatsAppStatus,
  initWhatsApp,
  disconnectWhatsApp,
  sendWhatsAppMessage,
} from "@/lib/channels/whatsapp";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "channels:read");
  if (!isAuthenticated(auth)) return auth;

  const status = getWhatsAppStatus();
  return NextResponse.json({
    type: "whatsapp",
    status: status.status === "connected" ? "connected" : "disconnected",
    qr: status.qr,
    message: status.message,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const body = await request.json();
    const { action, to, message } = body;

    if (action === "connect") {
      void initWhatsApp().catch((error) => {
        logger.error("[WhatsApp Route] Background connect failed:", error);
      });

      await new Promise((resolve) => setTimeout(resolve, 1500));
      const status = getWhatsAppStatus();
      return NextResponse.json({
        type: "whatsapp",
        status: status.status === "connected" ? "connected" : "disconnected",
        qr: status.qr,
        message: status.message,
      });
    }

    if (action === "disconnect") {
      await disconnectWhatsApp();
      return NextResponse.json({
        type: "whatsapp",
        status: "disconnected",
        message: "WhatsApp disconnected",
      });
    }

    if (action === "send") {
      if (!to || !message) {
        return NextResponse.json(
          { error: "Recipient and message are required" },
          { status: 400 }
        );
      }

      const result = await sendWhatsAppMessage(String(to), String(message));
      if (!result.ok) {
        return NextResponse.json(
          { error: result.error || "Failed to send WhatsApp message" },
          { status: 502 }
        );
      }

      return NextResponse.json({
        success: true,
        type: "whatsapp",
        status: "connected",
        chatId: result.chatId,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    logger.error("[WhatsApp Route] Failed to handle action:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không xử lý được yêu cầu WhatsApp",
      },
      { status: 500 }
    );
  }
}
