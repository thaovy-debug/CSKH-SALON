import { createHash, randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { indexKnowledgeEntry } from "@/lib/ai/semantic-search";
import { importKnowledgeDocument } from "@/lib/knowledge/import";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isAuthenticated, requireAuth } from "@/lib/route-auth";

export const runtime = "nodejs";

const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "size" in value &&
    "arrayBuffer" in value &&
    typeof (value as File).arrayBuffer === "function"
  );
}

function parsePriority(value: FormDataEntryValue | null): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, Math.trunc(parsed)));
}

function parseBoolean(value: FormDataEntryValue | null, defaultValue: boolean): boolean {
  if (value === null) return defaultValue;
  const normalized = String(value).toLowerCase().trim();
  if (["false", "0", "off", "no"].includes(normalized)) return false;
  if (["true", "1", "on", "yes"].includes(normalized)) return true;
  return defaultValue;
}

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to import knowledge file";
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "knowledge:create");
  if (!isAuthenticated(auth)) return auth;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const categoryId = String(formData.get("categoryId") || "").trim();
    const priority = parsePriority(formData.get("priority"));
    const isActive = parseBoolean(formData.get("isActive"), true);

    if (!isUploadedFile(file) || !file.name) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    if (!categoryId) {
      return NextResponse.json({ error: "Category ID is required" }, { status: 400 });
    }

    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File is too large. Maximum supported size is 10MB." },
        { status: 400 }
      );
    }

    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    if (!category) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imported = await importKnowledgeDocument(file.name, file.type || "", buffer);

    if (imported.sections.length === 0) {
      return NextResponse.json(
        { error: "The uploaded file does not contain importable content." },
        { status: 400 }
      );
    }

    const importBatchId = randomUUID();
    const chunkCount = imported.sections.length;
    const createdEntries = [];

    for (let index = 0; index < imported.sections.length; index += 1) {
      const section = imported.sections[index];
      const metadata = {
        ...(section.metadata || {}),
        source: "file-import",
        sourceFileName: file.name,
        sourceType: imported.detectedType,
        mimeType: file.type || "",
        chunkIndex: index,
        chunkCount,
        importBatchId,
        contentHash: contentHash(section.content),
      };

      const entry = await prisma.knowledgeEntry.create({
        data: {
          categoryId,
          title: (section.title || `${file.name} - Part ${index + 1}`).trim().slice(0, 500),
          content: section.content,
          priority,
          isActive,
          metadata,
        },
      });

      createdEntries.push(entry);
    }

    const warnings = [...imported.warnings];
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
          logger.error("Failed to index imported knowledge entry:", error, { entryId: entry.id });
          warnings.push(`Không tạo được embedding cho chunk: ${entry.title}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      sourceType: imported.detectedType,
      chunksCreated: createdEntries.length,
      chunksIndexed,
      embeddingSkipped: createdEntries.length - chunksIndexed,
      warnings,
    });
  } catch (error) {
    const message = errorMessage(error);
    logger.error("Failed to import knowledge file:", error);

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
