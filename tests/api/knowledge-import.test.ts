import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseJsonResponse } from "../helpers/request";

const mockImportKnowledgeDocument = vi.fn();
const mockIndexKnowledgeEntry = vi.fn();

vi.mock("@/lib/knowledge/import", () => ({
  importKnowledgeDocument: mockImportKnowledgeDocument,
}));

vi.mock("@/lib/ai/semantic-search", () => ({
  indexKnowledgeEntry: mockIndexKnowledgeEntry,
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

  return new NextRequest("http://localhost:3000/api/knowledge/import", {
    method: "POST",
    body: formData,
  });
}

function textFile(content = "Nội dung kiến thức") {
  return new Blob([content], { type: "text/plain" });
}

describe("POST /api/knowledge/import", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockImportKnowledgeDocument.mockReset();
    mockIndexKnowledgeEntry.mockReset();

    mockPrisma.category.findUnique.mockResolvedValue({ id: "cat-1", name: "FAQ" });
    mockPrisma.settings.findFirst.mockResolvedValue({ aiApiKey: "" });
    mockPrisma.knowledgeEntry.create.mockImplementation(async ({ data }) => ({
      id: `entry-${data.metadata.chunkIndex}`,
      title: data.title,
      metadata: data.metadata,
    }));
    mockImportKnowledgeDocument.mockResolvedValue({
      detectedType: "txt",
      warnings: [],
      sections: [
        { title: "FAQ import", content: "Câu hỏi thường gặp" },
        { title: "Bảng giá import", content: "Bảng giá dịch vụ" },
      ],
    });
  });

  it("requires authentication", async () => {
    const routeAuth = await import("@/lib/route-auth");
    (routeAuth.requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
    );
    (routeAuth.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const { POST } = await import("@/app/api/knowledge/import/route");
    const response = await POST(createMultipartRequest({ file: textFile(), categoryId: "cat-1" }));

    expect(response.status).toBe(401);
  });

  it("rejects missing file", async () => {
    const { POST } = await import("@/app/api/knowledge/import/route");
    const response = await POST(createMultipartRequest({ categoryId: "cat-1" }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("File");
  });

  it("rejects missing categoryId", async () => {
    const { POST } = await import("@/app/api/knowledge/import/route");
    const response = await POST(createMultipartRequest({ file: textFile() }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("Category ID");
  });

  it("rejects unknown category", async () => {
    mockPrisma.category.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/knowledge/import/route");
    const response = await POST(
      createMultipartRequest({ file: textFile(), categoryId: "cat-missing" })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(404);
    expect(data.error).toContain("Category not found");
  });

  it("rejects unsupported files from parser", async () => {
    mockImportKnowledgeDocument.mockRejectedValue(new Error("Unsupported file format"));

    const { POST } = await import("@/app/api/knowledge/import/route");
    const response = await POST(createMultipartRequest({ file: textFile(), categoryId: "cat-1" }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("Unsupported");
  });

  it("creates KnowledgeEntry chunks and skips embedding without API key", async () => {
    const { POST } = await import("@/app/api/knowledge/import/route");
    const response = await POST(
      createMultipartRequest({
        file: textFile(),
        categoryId: "cat-1",
        priority: "2",
        isActive: "false",
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.chunksCreated).toBe(2);
    expect(data.chunksIndexed).toBe(0);
    expect(data.embeddingSkipped).toBe(2);
    expect(data.warnings[0]).toContain("AI API key");
    expect(mockPrisma.knowledgeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: "cat-1",
          priority: 2,
          isActive: false,
          metadata: expect.objectContaining({
            source: "file-import",
            sourceFileName: "knowledge.txt",
            sourceType: "txt",
            chunkIndex: 0,
            chunkCount: 2,
            importBatchId: expect.any(String),
            contentHash: expect.any(String),
          }),
        }),
      })
    );
  });

  it("indexes imported chunks when API key exists", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({ aiApiKey: "gemini-key" });
    mockIndexKnowledgeEntry.mockResolvedValue(true);

    const { POST } = await import("@/app/api/knowledge/import/route");
    const response = await POST(createMultipartRequest({ file: textFile(), categoryId: "cat-1" }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.chunksIndexed).toBe(2);
    expect(data.embeddingSkipped).toBe(0);
    expect(mockIndexKnowledgeEntry).toHaveBeenCalledTimes(2);
  });

  it("keeps chunks and returns warning when embedding fails", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({ aiApiKey: "gemini-key" });
    mockIndexKnowledgeEntry.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const { POST } = await import("@/app/api/knowledge/import/route");
    const response = await POST(createMultipartRequest({ file: textFile(), categoryId: "cat-1" }));
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.chunksCreated).toBe(2);
    expect(data.chunksIndexed).toBe(1);
    expect(data.embeddingSkipped).toBe(1);
    expect(data.warnings.some((warning: string) => warning.includes("embedding"))).toBe(true);
  });
});
