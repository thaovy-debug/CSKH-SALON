import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseJsonResponse } from "../helpers/request";

const mockImportKnowledgeDocument = vi.fn();
const mockImportKnowledgeDocumentWithGemini = vi.fn();

vi.mock("@/lib/knowledge/import", () => ({
  importKnowledgeDocument: mockImportKnowledgeDocument,
}));

vi.mock("@/lib/knowledge/gemini-import", () => ({
  importKnowledgeDocumentWithGemini: mockImportKnowledgeDocumentWithGemini,
}));

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

function createMultipartRequest(fields: Record<string, string | Blob>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Blob) {
      formData.append(key, value, "knowledge.txt");
    } else {
      formData.append(key, value);
    }
  }

  return new NextRequest("http://localhost:3000/api/knowledge/import/preview", {
    method: "POST",
    body: formData,
  });
}

function textFile(content = "Nội dung kiến thức") {
  return new Blob([content], { type: "text/plain" });
}

describe("POST /api/knowledge/import/preview", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockImportKnowledgeDocument.mockReset();
    mockImportKnowledgeDocumentWithGemini.mockReset();
    mockPrisma.knowledgeEntry.create.mockReset?.();
    mockPrisma.settings.findFirst.mockReset?.();
    mockPrisma.category.findMany.mockReset?.();
    mockPrisma.settings.findFirst.mockResolvedValue({ aiApiKey: "" });
    mockPrisma.category.findMany.mockResolvedValue([
      { id: "cat-led1000-price-list", name: "LED1000 - Bảng giá" },
      { id: "cat-led1000-product-catalogue", name: "LED1000 - Catalogue sản phẩm" },
    ]);
    mockImportKnowledgeDocument.mockResolvedValue({
      detectedType: "txt",
      warnings: ["Parser warning"],
      sections: [
        {
          title: "FAQ import",
          content: "Câu hỏi thường gặp",
          metadata: { sourceFormat: "faq", parserConfidence: 0.95 },
        },
        {
          title: "Bảng giá import",
          content: "Bảng giá sản phẩm",
          metadata: { sourceFormat: "price-catalogue", parserConfidence: 0.65 },
        },
      ],
    });
    mockImportKnowledgeDocumentWithGemini.mockResolvedValue({
      detectedType: "pdf-gemini",
      warnings: ["Gemini warning"],
      sections: [
        {
          title: "Adapter 12V 5A",
          content: "Giá bán lẻ: 125.000\nGiá thi công: 115.000",
          metadata: { sourceFormat: "gemini-document", parserConfidence: 0.88 },
        },
      ],
    });
  });

  it("requires authentication", async () => {
    const routeAuth = await import("@/lib/route-auth");
    (routeAuth.requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
    );
    (routeAuth.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const { POST } = await import("@/app/api/knowledge/import/preview/route");
    const response = await POST(createMultipartRequest({ file: textFile() }));

    expect(response.status).toBe(401);
  });

  it("returns parsed preview without creating knowledge entries", async () => {
    const { POST } = await import("@/app/api/knowledge/import/preview/route");
    const response = await POST(createMultipartRequest({ file: textFile() }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.chunkCount).toBe(2);
    expect(data.previewCount).toBe(2);
    expect(data.lowConfidenceCount).toBe(1);
    expect(data.averageConfidence).toBeCloseTo(0.8);
    expect(data.suggestedKnowledgeKind).toBe("price_list");
    expect(data.suggestedCategoryId).toBe("cat-led1000-price-list");
    expect(data.warnings).toEqual(
      expect.arrayContaining([
        "Parser warning",
        "1 mục có độ chắc parser thấp, nên kiểm tra nội dung trước khi import.",
      ])
    );
    expect(data.sections[0]).toEqual(
      expect.objectContaining({
        title: "FAQ import",
        sourceFormat: "faq",
        parserConfidence: 0.95,
      })
    );
    expect(mockPrisma.knowledgeEntry.create).not.toHaveBeenCalled();
  });

  it("uses Gemini preview mode when requested and an API key exists", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({ aiApiKey: "gemini-key" });

    const { POST } = await import("@/app/api/knowledge/import/preview/route");
    const response = await POST(createMultipartRequest({ file: textFile(), mode: "gemini" }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.sourceType).toBe("pdf-gemini");
    expect(data.chunkCount).toBe(1);
    expect(data.suggestedCategoryName).toBe("LED1000 - Bảng giá");
    expect(data.sections[0]).toEqual(
      expect.objectContaining({
        title: "Adapter 12V 5A",
        sourceFormat: "gemini-document",
        parserConfidence: 0.88,
      })
    );
    expect(mockPrisma.settings.findFirst).toHaveBeenCalledWith({ select: { aiApiKey: true } });
    expect(mockImportKnowledgeDocumentWithGemini).toHaveBeenCalledWith(
      "knowledge.txt",
      "text/plain",
      expect.any(Buffer),
      "gemini-key"
    );
    expect(mockImportKnowledgeDocument).not.toHaveBeenCalled();
  });

  it("rejects Gemini preview mode when API key is missing", async () => {
    const { POST } = await import("@/app/api/knowledge/import/preview/route");
    const response = await POST(createMultipartRequest({ file: textFile(), mode: "gemini" }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("Gemini API key");
    expect(mockImportKnowledgeDocumentWithGemini).not.toHaveBeenCalled();
  });

  it("rejects missing file", async () => {
    const { POST } = await import("@/app/api/knowledge/import/preview/route");
    const response = await POST(createMultipartRequest({}));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("File");
    expect(data.status).toBe(400);
    expect(data.mode).toBe("parser");
  });

  it("returns preview error context when parsing fails", async () => {
    mockImportKnowledgeDocument.mockRejectedValue(new Error("Parser exploded"));

    const { POST } = await import("@/app/api/knowledge/import/preview/route");
    const response = await POST(createMultipartRequest({ file: textFile() }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data).toEqual(
      expect.objectContaining({
        error: "Parser exploded",
        filename: "knowledge.txt",
        mode: "parser",
        status: 400,
      })
    );
  });
});
