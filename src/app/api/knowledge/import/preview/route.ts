import { NextRequest, NextResponse } from "next/server";
import { importKnowledgeDocumentWithGemini } from "@/lib/knowledge/gemini-import";
import { importKnowledgeDocument } from "@/lib/knowledge/import";
import { suggestLed1000CategoryForImport } from "@/lib/knowledge/led1000-taxonomy";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { isAuthenticated, requireAuth } from "@/lib/route-auth";

export const runtime = "nodejs";

const MAX_IMPORT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const PREVIEW_CONTENT_LENGTH = 500;
const LOW_CONFIDENCE_THRESHOLD = 0.75;

interface PreviewErrorContext extends Record<string, unknown> {
  mode: string;
  filename?: string;
  fileType?: string;
  fileSize?: number;
}

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Failed to preview knowledge file";
}

function getMetadataNumber(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getMetadataString(metadata: Record<string, unknown> | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "knowledge:create");
  if (!isAuthenticated(auth)) return auth;

  const errorContext: PreviewErrorContext = { mode: "unknown" };

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const mode = String(formData.get("mode") || "parser").trim();
    errorContext.mode = mode;

    if (!isUploadedFile(file) || !file.name) {
      return NextResponse.json({ error: "File is required", mode, status: 400 }, { status: 400 });
    }

    errorContext.filename = file.name;
    errorContext.fileType = file.type || "";
    errorContext.fileSize = file.size;

    if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
      return NextResponse.json(
        {
          error: "File is too large. Maximum supported size is 10MB.",
          mode,
          filename: file.name,
          status: 400,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const imported =
      mode === "gemini"
        ? await importWithGemini(file.name, file.type || "", buffer)
        : await importKnowledgeDocument(file.name, file.type || "", buffer);
    const confidenceValues = imported.sections
      .map((section) => getMetadataNumber(section.metadata, "parserConfidence"))
      .filter((value): value is number => value !== null);
    const lowConfidenceCount = confidenceValues.filter(
      (value) => value < LOW_CONFIDENCE_THRESHOLD
    ).length;
    const averageConfidence =
      confidenceValues.length > 0
        ? confidenceValues.reduce((total, value) => total + value, 0) / confidenceValues.length
        : null;
    const warnings = [...imported.warnings];

    if (lowConfidenceCount > 0) {
      warnings.push(
        `${lowConfidenceCount} mục có độ chắc parser thấp, nên kiểm tra nội dung trước khi import.`
      );
    }

    const availableCategories =
      (await prisma.category.findMany({
        select: { id: true, name: true },
        orderBy: { sortOrder: "asc" },
      })) || [];
    const categorySuggestion = suggestLed1000CategoryForImport(
      imported,
      file.name,
      availableCategories
    );

    if (categorySuggestion.categoryName) {
      warnings.push(
        `Gợi ý danh mục: ${categorySuggestion.categoryName} (${categorySuggestion.reason})`
      );
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      sourceType: imported.detectedType,
      suggestedKnowledgeKind: categorySuggestion.knowledgeKind,
      suggestedCategoryId: categorySuggestion.categoryId,
      suggestedCategoryName: categorySuggestion.categoryName,
      categorySuggestionConfidence: categorySuggestion.confidence,
      categorySuggestionReason: categorySuggestion.reason,
      chunkCount: imported.sections.length,
      previewCount: imported.sections.length,
      lowConfidenceCount,
      averageConfidence,
      warnings,
      sections: imported.sections.map((section, index) => ({
        index,
        title: section.title,
        content: section.content,
        contentPreview:
          section.content.length > PREVIEW_CONTENT_LENGTH
            ? `${section.content.slice(0, PREVIEW_CONTENT_LENGTH).trim()}...`
            : section.content,
        contentLength: section.content.length,
        sourceFormat: getMetadataString(section.metadata, "sourceFormat"),
        parserConfidence: getMetadataNumber(section.metadata, "parserConfidence"),
        metadata: section.metadata || {},
      })),
    });
  } catch (error) {
    const message = errorMessage(error);
    logger.error("Failed to preview knowledge file:", error, errorContext);

    return NextResponse.json(
      {
        error: message,
        mode: errorContext.mode,
        filename: errorContext.filename,
        status: 400,
      },
      { status: 400 }
    );
  }
}

async function importWithGemini(fileName: string, mimeType: string, buffer: Buffer) {
  const settings = await prisma.settings.findFirst({ select: { aiApiKey: true } });
  if (!settings?.aiApiKey) {
    throw new Error("Chưa cấu hình Gemini API key nên không thể dùng chế độ Đọc bằng Gemini.");
  }

  return importKnowledgeDocumentWithGemini(fileName, mimeType, buffer, settings.aiApiKey);
}
