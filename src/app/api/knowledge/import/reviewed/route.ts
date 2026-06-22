import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { indexKnowledgeEntry } from "@/lib/ai/semantic-search";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isAuthenticated, requireAuth } from "@/lib/route-auth";

export const runtime = "nodejs";

const MAX_REVIEWED_SECTIONS = 200;

interface ReviewedSection {
  title?: unknown;
  content?: unknown;
  metadata?: unknown;
}

function parsePriority(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(parsed)));
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === "boolean") return value;
  const normalized = String(value).toLowerCase().trim();
  if (["false", "0", "off", "no"].includes(normalized)) return false;
  if (["true", "1", "on", "yes"].includes(normalized)) return true;
  return defaultValue;
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to import reviewed knowledge";
}

function normalizeMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return metadata as Record<string, unknown>;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "knowledge:create");
  if (!isAuthenticated(auth)) return auth;

  try {
    const body = await request.json();
    const categoryId = String(body.categoryId || "").trim();
    const filename = String(body.filename || "Reviewed import").trim();
    const sourceType = String(body.sourceType || "reviewed").trim();
    const priority = parsePriority(body.priority);
    const isActive = parseBoolean(body.isActive, true);
    const sections = Array.isArray(body.sections) ? (body.sections as ReviewedSection[]) : [];

    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    if (sections.length === 0) {
      return NextResponse.json(
        { error: "At least one reviewed chunk is required" },
        { status: 400 }
      );
    }

    if (sections.length > MAX_REVIEWED_SECTIONS) {
      return NextResponse.json(
        { error: `Cannot import more than ${MAX_REVIEWED_SECTIONS} reviewed chunks.` },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const cleanedSections = sections
      .map((section, index) => ({
        title: String(section.title || `${filename} - Part ${index + 1}`).trim(),
        content: String(section.content || "").trim(),
        metadata: normalizeMetadata(section.metadata),
      }))
      .filter((section) => section.title && section.content);

    if (cleanedSections.length === 0) {
      return NextResponse.json(
        { error: "Reviewed chunks must include title and content." },
        { status: 400 }
      );
    }

    const importBatchId = randomUUID();
    const chunkCount = cleanedSections.length;
    const createdEntries = [];

    for (let index = 0; index < cleanedSections.length; index += 1) {
      const section = cleanedSections[index];
      const metadata = {
        ...section.metadata,
        source: "reviewed-file-import",
        sourceFileName: filename,
        sourceType,
        chunkIndex: index,
        chunkCount,
        importBatchId,
        contentHash: contentHash(section.content),
        reviewed: true,
      };

      const entry = await prisma.knowledgeEntry.create({
        data: {
          categoryId,
          title: section.title.slice(0, 500),
          content: section.content,
          priority,
          isActive,
          metadata,
        },
      });

      createdEntries.push(entry);
    }

    const warnings: string[] = [];
    const settings = await prisma.settings.findFirst({ select: { aiApiKey: true } });
    let chunksIndexed = 0;

    if (!settings?.aiApiKey) {
      warnings.push("AI API key chưa cấu hình, đã import nội dung nhưng chưa tạo embedding.");
    } else {
      for (const entry of createdEntries) {
        try {
          const indexed = await indexKnowledgeEntry(entry.id, settings.aiApiKey);
          if (indexed) {
            chunksIndexed += 1;
          } else {
            warnings.push(`Không tạo được embedding cho chunk: ${entry.title}`);
          }
        } catch (error) {
          logger.error("Failed to index reviewed knowledge entry:", error, { entryId: entry.id });
          warnings.push(`Không tạo được embedding cho chunk: ${entry.title}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      filename,
      sourceType,
      chunksCreated: createdEntries.length,
      chunksIndexed,
      embeddingSkipped: createdEntries.length - chunksIndexed,
      warnings,
    });
  } catch (error) {
    const message = errorMessage(error);
    logger.error("Failed to import reviewed knowledge:", error);

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
