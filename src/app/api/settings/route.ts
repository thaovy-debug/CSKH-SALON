import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maskSettingsSecrets, SECRET_FIELDS } from "@/lib/security";
import { updateSettingsSchema, validateBody } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { requireAuth, isAuthenticated } from "@/lib/route-auth";
import { DEFAULT_GEMINI_MODEL, GEMINI_PROVIDER } from "@/lib/ai/catalog";

const DEFAULT_BUSINESS_SETTINGS = {
  businessName: "LED1000 / Linh Kiện LED1000",
  businessDesc:
    "Chuyên đèn LED, nguồn điện, linh kiện LED, phụ kiện chiếu sáng, đèn trang trí và thiết bị điện liên quan.",
  welcomeMessage:
    "Xin chào! LED1000 có thể hỗ trợ bạn tìm đèn LED, nguồn điện, linh kiện hoặc phụ kiện phù hợp. Bạn cần dùng cho mục đích nào và có thông số điện áp/công suất chưa?",
  tone: "friendly",
  language: "auto",
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "settings:read");
  if (!isAuthenticated(auth)) return auth;

  try {
    let settings = await prisma.settings.findUnique({
      where: { id: "default" },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: "default",
          aiProvider: GEMINI_PROVIDER,
          aiModel: DEFAULT_GEMINI_MODEL,
          ...DEFAULT_BUSINESS_SETTINGS,
        },
      });
    }

    return NextResponse.json(maskSettingsSecrets(settings));
  } catch (error) {
    logger.error("Failed to fetch settings:", error);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, "settings:update");
  if (!isAuthenticated(auth)) return auth;

  try {
    const body = await request.json();

    // Remove fields that should not be updated directly
    delete body.id;
    delete body.createdAt;
    delete body.updatedAt;

    // Filter out masked secrets to prevent overwriting with "***"
    for (const field of SECRET_FIELDS) {
      if (body[field] === "***") {
        delete body[field];
      }
    }

    const validation = validateBody(updateSettingsSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    const settings = await prisma.settings.upsert({
      where: { id: "default" },
      update: validation.data,
      create: { id: "default", ...validation.data },
    });

    return NextResponse.json(maskSettingsSecrets(settings));
  } catch (error) {
    logger.error("Failed to update settings:", error);
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
  }
}
