import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import { buildShopeeAuthStartUrlForAccount } from "@/lib/channels/shopee";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  const accountId = request.nextUrl.searchParams.get("accountId")?.trim() || "";
  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  try {
    const account = await prisma.channelAccount.findUnique({ where: { id: accountId } });
    if (!account || account.type !== "shopee") {
      return NextResponse.json({ error: "Shopee account not found" }, { status: 404 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || request.nextUrl.origin;
    const authUrl = buildShopeeAuthStartUrlForAccount({
      accountId: account.id,
      config: account.config,
      origin,
    });

    return NextResponse.redirect(authUrl);
  } catch (error) {
    logger.error("[Shopee] Failed to create auth URL", error, { accountId });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Shopee auth URL" },
      { status: 500 }
    );
  }
}
