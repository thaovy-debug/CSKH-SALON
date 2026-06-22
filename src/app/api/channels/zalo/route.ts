import type { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import {
  getZaloStatus,
  startZaloBot,
  stopZaloBot,
  syncZaloSessionFiles,
  sendZaloMessage,
  sendZaloImageMessage,
} from "@/lib/channels/zalo";
import { upsertDefaultChannelAccountFromChannel } from "@/lib/channels/accounts";
import {
  mergeChannelConfigPreservingSecrets,
  sanitizeChannelForClient,
} from "@/lib/channels/config";

type ZaloConfig = {
  pythonCommand?: string;
  scriptPath?: string;
  cookiesInput?: string;
  relaySecret?: string;
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "channels:read");
  if (!isAuthenticated(auth)) return auth;

  const status = getZaloStatus();
  return NextResponse.json({
    type: "zalo",
    status: status.status,
    message: status.message,
    pid: status.pid,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const body = await request.json();
    const { config, isActive } = body;

    if (config?.cookiesInput?.trim()) {
      await syncZaloSessionFiles(config as ZaloConfig);
    }

    const existingChannel = await prisma.channel.findUnique({
      where: { type: "zalo" },
    });
    const mergedConfig = mergeChannelConfigPreservingSecrets(
      "zalo",
      config,
      existingChannel?.config
    );

    const channel = await prisma.channel.upsert({
      where: { type: "zalo" },
      update: {
        config: mergedConfig as Prisma.InputJsonValue,
        isActive: typeof isActive === "boolean" ? isActive : undefined,
      },
      create: {
        type: "zalo",
        config: mergedConfig as Prisma.InputJsonValue,
        isActive: typeof isActive === "boolean" ? isActive : false,
        status: "disconnected",
      },
    });

    await upsertDefaultChannelAccountFromChannel({
      type: "zalo",
      config: channel.config,
      isActive: channel.isActive,
      status: channel.status,
    });

    return NextResponse.json(sanitizeChannelForClient(channel));
  } catch (error) {
    logger.error("[Zalo Route] Failed to update config:", error);
    return NextResponse.json(
      { error: "Không lưu được cấu hình Zalo" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const action = String(formData.get("action") || "");

      if (action !== "send_image") {
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
      }

      const phoneNumber = String(formData.get("phoneNumber") || "").trim();
      const message = String(formData.get("message") || "").trim();
      const image = formData.get("image");

      if (!phoneNumber || !message || !(image instanceof File)) {
        return NextResponse.json(
          { error: "Cần số điện thoại, nội dung và file ảnh" },
          { status: 400 }
        );
      }

      const channel = await prisma.channel.findUnique({ where: { type: "zalo" } });
      const config = ((channel?.config as ZaloConfig | null) || {}) as ZaloConfig;

      const buffer = Buffer.from(await image.arrayBuffer());
      const safeName = image.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const tempPath = path.join(process.cwd(), ".tmp-zalo-send-image-" + Date.now() + "-" + safeName);

      try {
        await fs.writeFile(tempPath, buffer);
        const result = await sendZaloImageMessage(config, phoneNumber, message, tempPath);
        return NextResponse.json({
          success: true,
          type: "zalo",
          message: result.output || "Zalo image sent",
        });
      } finally {
        await fs.unlink(tempPath).catch(() => undefined);
      }
    }

    const body = await request.json();
    const action = String(body?.action || "");

    if (action === "connect") {
      const channel = await prisma.channel.findUnique({ where: { type: "zalo" } });
      const config = ((channel?.config as ZaloConfig | null) || {}) as ZaloConfig;
      const status = await startZaloBot(config);
      return NextResponse.json({
        type: "zalo",
        status: status.status,
        message: status.message,
        pid: status.pid,
      });
    }

    if (action === "disconnect") {
      const status = await stopZaloBot();
      return NextResponse.json({
        type: "zalo",
        status: status.status,
        message: status.message,
      });
    }

    if (action === "test") {
      const channel = await prisma.channel.findUnique({ where: { type: "zalo" } });
      const config = ((channel?.config as ZaloConfig | null) || {}) as ZaloConfig;
      if (!config.cookiesInput?.trim()) {
        return NextResponse.json(
          { error: "Cần nhập cookies trước khi test Zalo" },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        type: "zalo",
        message: `Config loaded for ${config.scriptPath || "zalo_bot.py"}`,
      });
    }

    if (action === "send") {
      const phoneNumber = String(body?.phoneNumber || "").trim();
      const message = String(body?.message || "").trim();
      if (!phoneNumber || !message) {
        return NextResponse.json(
          { error: "Cần số điện thoại và nội dung tin nhắn" },
          { status: 400 }
        );
      }

      const channel = await prisma.channel.findUnique({ where: { type: "zalo" } });
      const config = ((channel?.config as ZaloConfig | null) || {}) as ZaloConfig;
      const result = await sendZaloMessage(config, phoneNumber, message);

      return NextResponse.json({
        success: true,
        type: "zalo",
        message: result.output || "Zalo message sent",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    logger.error("[Zalo Route] Failed to handle action:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Không xử lý được yêu cầu Zalo",
      },
      { status: 500 }
    );
  }
}
