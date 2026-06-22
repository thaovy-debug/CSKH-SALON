import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import {
  ACCOUNT_CHANNEL_TYPES,
  getDisplayName,
  getExternalAccountId,
  isAccountChannelType,
  mergeAccountConfigPreservingSecrets,
  sanitizeChannelAccountForClient,
} from "@/lib/channels/accounts";

function getAccountInput(body: Record<string, unknown>) {
  const type = String(body.type || "").trim();
  const rawConfig = body.config && typeof body.config === "object" ? body.config : {};
  const config = { ...(rawConfig as Record<string, unknown>) };
  const externalAccountId = String(
    body.externalAccountId || getExternalAccountId(type, config) || ""
  ).trim();
  if (externalAccountId) config.externalAccountId = externalAccountId;
  const displayName = String(
    body.displayName || getDisplayName(type, config, externalAccountId)
  ).trim();
  if (displayName) config.displayName = displayName;

  return { type, config, externalAccountId, displayName };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "channels:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    const type = request.nextUrl.searchParams.get("type")?.trim() || "";
    const accounts = await prisma.channelAccount.findMany({
      where: type && isAccountChannelType(type) ? { type } : undefined,
      orderBy: [{ type: "asc" }, { isDefault: "desc" }, { displayName: "asc" }],
    });

    return NextResponse.json(accounts.map(sanitizeChannelAccountForClient));
  } catch (error) {
    logger.error("Failed to fetch channel accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch channel accounts" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const { type, config, externalAccountId, displayName } = getAccountInput(body);

    if (!isAccountChannelType(type)) {
      return NextResponse.json(
        { error: "Invalid account type. Must be one of: " + ACCOUNT_CHANNEL_TYPES.join(", ") },
        { status: 400 }
      );
    }

    if (!externalAccountId) {
      return NextResponse.json(
        { error: "externalAccountId, Page ID, OA ID, Shop/Seller ID, or business account ID is required" },
        { status: 400 }
      );
    }

    const existing = await prisma.channelAccount.findUnique({
      where: { type_externalAccountId: { type, externalAccountId } },
    });
    const mergedConfig = mergeAccountConfigPreservingSecrets(
      type,
      config,
      existing?.config
    );
    const isDefault = typeof body.isDefault === "boolean" ? body.isDefault : !existing;

    if (isDefault) {
      await prisma.channelAccount.updateMany({
        where: { type },
        data: { isDefault: false },
      });
    }

    const explicitStatus = typeof body.status === "string" ? body.status : undefined;
    const marketplaceSavedStatus = type === "shopee" || type === "tiktok_shop" ? "config_saved" : undefined;
    const nextUpdateStatus =
      explicitStatus ||
      ((type === "shopee" || type === "tiktok_shop") && (!existing || existing.status === "disconnected") ? marketplaceSavedStatus : undefined);
    const nextCreateStatus = explicitStatus || marketplaceSavedStatus || "disconnected";

    const account = await prisma.channelAccount.upsert({
      where: { type_externalAccountId: { type, externalAccountId } },
      update: {
        displayName,
        config: mergedConfig as Prisma.InputJsonValue,
        isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
        isDefault,
        status: nextUpdateStatus,
        lastError: "",
      },
      create: {
        type,
        externalAccountId,
        displayName,
        config: mergedConfig as Prisma.InputJsonValue,
        isActive: typeof body.isActive === "boolean" ? body.isActive : true,
        isDefault,
        status: nextCreateStatus,
      },
    });

    return NextResponse.json(sanitizeChannelAccountForClient(account), { status: 201 });
  } catch (error) {
    logger.error("Failed to save channel account:", error);
    return NextResponse.json(
      { error: "Failed to save channel account" },
      { status: 500 }
    );
  }
}
