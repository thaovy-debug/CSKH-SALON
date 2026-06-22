import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import {
  getDisplayName,
  getExternalAccountId,
  mergeAccountConfigPreservingSecrets,
  sanitizeChannelAccountForClient,
} from "@/lib/channels/accounts";
import { getZaloStatus, startZaloBot, stopZaloBot } from "@/lib/channels/zalo";
import {
  buildShopeeAuthStartUrlForAccount,
  getShopeeAccountReadiness,
} from "@/lib/channels/shopee";
import { getTikTokShopAccountReadiness } from "@/lib/channels/tiktok-shop";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, "channels:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await context.params;
    const account = await prisma.channelAccount.findUnique({ where: { id } });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });
    return NextResponse.json(sanitizeChannelAccountForClient(account));
  } catch (error) {
    logger.error("Failed to fetch channel account:", error);
    return NextResponse.json({ error: "Failed to fetch channel account" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const existing = await prisma.channelAccount.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const rawConfig = body.config && typeof body.config === "object" ? body.config : {};
    const config = mergeAccountConfigPreservingSecrets(existing.type, rawConfig, existing.config);
    const externalAccountId = String(
      body.externalAccountId || getExternalAccountId(existing.type, config) || existing.externalAccountId
    ).trim();
    const displayName = String(
      body.displayName || getDisplayName(existing.type, config, existing.displayName)
    ).trim();
    const isDefault = typeof body.isDefault === "boolean" ? body.isDefault : existing.isDefault;

    if (isDefault) {
      await prisma.channelAccount.updateMany({
        where: { type: existing.type, NOT: { id } },
        data: { isDefault: false },
      });
    }

    const account = await prisma.channelAccount.update({
      where: { id },
      data: {
        externalAccountId,
        displayName,
        config: config as Prisma.InputJsonValue,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
        isDefault,
        status: typeof body.status === "string" ? body.status : undefined,
      },
    });

    return NextResponse.json(sanitizeChannelAccountForClient(account));
  } catch (error) {
    logger.error("Failed to update channel account:", error);
    return NextResponse.json({ error: "Failed to update channel account" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await context.params;
    await prisma.channelAccount.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Failed to delete channel account:", error);
    return NextResponse.json({ error: "Failed to delete channel account" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = String(body.action || "").trim();
    const account = await prisma.channelAccount.findUnique({ where: { id } });
    if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    if (!["connect", "disconnect", "test"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    if (account.type === "zalo") {
      const config = account.config as Record<string, string>;
      if (action === "connect") {
        const status = await startZaloBot(config, account.id);
        return NextResponse.json({ id, type: account.type, ...status });
      }
      if (action === "disconnect") {
        const status = await stopZaloBot(account.id);
        return NextResponse.json({ id, type: account.type, ...status });
      }
      return NextResponse.json({ id, type: account.type, ...getZaloStatus(account.id) });
    }

    if (account.type === "shopee") {
      if (action === "disconnect") {
        const updated = await prisma.channelAccount.update({
          where: { id },
          data: { status: "disconnected" },
        });
        return NextResponse.json({
          ...sanitizeChannelAccountForClient(updated),
          message: `${updated.displayName || updated.type} disconnected`,
        });
      }

      if (action === "connect") {
        const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
        const authUrl = buildShopeeAuthStartUrlForAccount({
          accountId: account.id,
          config: account.config,
          origin,
        });
        const updated = await prisma.channelAccount.update({
          where: { id },
          data: { status: "authorization_required" },
        });
        return NextResponse.json({
          ...sanitizeChannelAccountForClient(updated),
          status: "authorization_required",
          authUrl,
          message: "Mở Shopee để chủ shop cấp quyền. Trạng thái này chưa phải sẵn sàng production.",
        });
      }

      const readiness = getShopeeAccountReadiness(account.config);
      if (!readiness.ok) {
        return NextResponse.json(
          {
            error: `Shopee account is missing: ${readiness.missing.join(", ")}`,
            missing: readiness.missing,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        id,
        type: account.type,
        status: account.status,
        ready: true,
        message: "Shopee account has authorized credentials. Webhook receive and chat send still need real end-to-end verification.",
      });
    }


    if (account.type === "tiktok_shop") {
      if (action === "disconnect") {
        const updated = await prisma.channelAccount.update({
          where: { id },
          data: { status: "disconnected" },
        });
        return NextResponse.json({
          ...sanitizeChannelAccountForClient(updated),
          message: `${updated.displayName || updated.type} disconnected`,
        });
      }

      if (action === "connect") {
        const updated = await prisma.channelAccount.update({
          where: { id },
          data: { status: "authorization_required" },
        });
        return NextResponse.json({
          ...sanitizeChannelAccountForClient(updated),
          status: "authorization_required",
          message: "Cần xác minh app, scope và URL ủy quyền trong TikTok Shop Partner Center trước khi redirect tự động. Trạng thái này chưa phải sẵn sàng production.",
        });
      }

      const readiness = getTikTokShopAccountReadiness(account.config);
      if (!readiness.ok) {
        return NextResponse.json(
          {
            error: `TikTok Shop account is missing: ${readiness.missing.join(", ")}`,
            missing: readiness.missing,
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        id,
        type: account.type,
        status: account.status,
        ready: true,
        message: "TikTok Shop account has stored credentials. Webhook receive can be tested with mocked payloads; real auth/send requires Partner Center verification.",
      });
    }
    const nextStatus = action === "connect" || action === "test" ? "connected" : "disconnected";
    const updated = await prisma.channelAccount.update({
      where: { id },
      data: {
        status: nextStatus,
        isActive: nextStatus === "connected" ? true : account.isActive,
        lastConnectedAt: nextStatus === "connected" ? new Date() : account.lastConnectedAt,
      },
    });

    return NextResponse.json({
      ...sanitizeChannelAccountForClient(updated),
      message: `${updated.displayName || updated.type} ${nextStatus}`,
    });
  } catch (error) {
    logger.error("Failed to run channel account action:", error);
    return NextResponse.json({ error: "Failed to run channel account action" }, { status: 500 });
  }
}
