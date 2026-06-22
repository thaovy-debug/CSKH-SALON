import { NextRequest, NextResponse } from "next/server";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import { exchangeShopeeAuthCode } from "@/lib/channels/shopee";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "channels:update");
  if (!isAuthenticated(auth)) return auth;

  const accountId = request.nextUrl.searchParams.get("accountId")?.trim() || "";
  const code = request.nextUrl.searchParams.get("code")?.trim() || "";
  const shopId =
    request.nextUrl.searchParams.get("shop_id")?.trim() ||
    request.nextUrl.searchParams.get("shopId")?.trim() ||
    "";

  if (!accountId || !code || !shopId) {
    return NextResponse.json(
      { error: "accountId, code, and shop_id are required" },
      { status: 400 }
    );
  }

  try {
    await exchangeShopeeAuthCode({ accountId, code, shopId });
    const redirectUrl = new URL("/channels/accounts", request.nextUrl.origin);
    redirectUrl.searchParams.set("channel", "shopee");
    redirectUrl.searchParams.set("status", "authorized");
    redirectUrl.searchParams.set("shopId", shopId);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    logger.error("[Shopee] Auth callback failed", error, { accountId, shopId });
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Shopee authorization failed" },
      { status: 500 }
    );
  }
}

