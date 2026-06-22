import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { parseJsonResponse } from "../helpers/request";

const mockIndexKnowledgeEntry = vi.fn();

vi.mock("@/lib/ai/semantic-search", () => ({
  indexKnowledgeEntry: mockIndexKnowledgeEntry,
}));

const mockPrisma = prisma as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;

function createJsonRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost:3000/api/knowledge/import/reviewed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/knowledge/import/reviewed", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockIndexKnowledgeEntry.mockReset();

    mockPrisma.category.findUnique.mockResolvedValue({ id: "cat-new", name: "Test FAQ" });
    mockPrisma.settings.findFirst.mockResolvedValue({ aiApiKey: "" });
    mockPrisma.knowledgeEntry.create.mockImplementation(async ({ data }) => ({
      id: `entry-${data.metadata.chunkIndex}`,
      title: data.title,
      metadata: data.metadata,
    }));
  });

  it("requires authentication", async () => {
    const routeAuth = await import("@/lib/route-auth");
    (routeAuth.requireAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      NextResponse.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 })
    );
    (routeAuth.isAuthenticated as ReturnType<typeof vi.fn>).mockReturnValueOnce(false);

    const { POST } = await import("@/app/api/knowledge/import/reviewed/route");
    const response = await POST(createJsonRequest({}));

    expect(response.status).toBe(401);
  });

  it("creates entries from reviewed chunks and preserves selected category", async () => {
    const { POST } = await import("@/app/api/knowledge/import/reviewed/route");
    const response = await POST(
      createJsonRequest({
        categoryId: "cat-new",
        filename: "faq.docx",
        sourceType: "docx",
        priority: 2,
        isActive: false,
        sections: [
          {
            title: "Combo 40 phút bao nhiêu?",
            content: "Dạ combo 40 phút giá 160.000đ.",
            metadata: { sourceFormat: "faq", parserConfidence: 0.95 },
          },
        ],
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.chunksCreated).toBe(1);
    expect(mockPrisma.category.findUnique).toHaveBeenCalledWith({ where: { id: "cat-new" } });
    expect(mockPrisma.knowledgeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          categoryId: "cat-new",
          priority: 2,
          isActive: false,
          title: "Combo 40 phút bao nhiêu?",
          metadata: expect.objectContaining({
            source: "reviewed-file-import",
            sourceFileName: "faq.docx",
            sourceType: "docx",
            sourceFormat: "faq",
            reviewed: true,
          }),
        }),
      })
    );
  });

  it("indexes reviewed chunks when API key exists", async () => {
    mockPrisma.settings.findFirst.mockResolvedValue({ aiApiKey: "gemini-key" });
    mockIndexKnowledgeEntry.mockResolvedValue(true);

    const { POST } = await import("@/app/api/knowledge/import/reviewed/route");
    const response = await POST(
      createJsonRequest({
        categoryId: "cat-new",
        filename: "faq.docx",
        sourceType: "docx",
        sections: [{ title: "FAQ", content: "Nội dung FAQ" }],
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(200);
    expect(data.chunksIndexed).toBe(1);
    expect(data.embeddingSkipped).toBe(0);
    expect(mockIndexKnowledgeEntry).toHaveBeenCalledWith("entry-0", "gemini-key");
  });

  it("rejects empty reviewed chunks", async () => {
    const { POST } = await import("@/app/api/knowledge/import/reviewed/route");
    const response = await POST(
      createJsonRequest({
        categoryId: "cat-new",
        sections: [{ title: "", content: "" }],
      })
    );
    const data = await parseJsonResponse(response);

    expect(response.status).toBe(400);
    expect(data.error).toContain("title and content");
  });
});
