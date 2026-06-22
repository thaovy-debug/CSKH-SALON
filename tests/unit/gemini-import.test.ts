import JSZip from "jszip";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { importKnowledgeDocumentWithGemini } from "@/lib/knowledge/gemini-import";

const { mockGenerateGeminiDocumentJson } = vi.hoisted(() => ({
  mockGenerateGeminiDocumentJson: vi.fn(),
}));

vi.mock("@/lib/ai/provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/provider")>();
  return {
    ...actual,
    generateGeminiDocumentJson: mockGenerateGeminiDocumentJson,
  };
});

async function createDocxBuffer() {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Default Extension="png" ContentType="image/png"/>',
      "</Types>",
    ].join("")
  );
  zip.file(
    "word/_rels/document.xml.rels",
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>',
      "</Relationships>",
    ].join("")
  );
  zip.file(
    "word/document.xml",
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">',
      "<w:body>",
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>BẢNG GIÁ LED1000</w:t></w:r></w:p>',
      "<w:tbl>",
      "<w:tr><w:tc><w:p><w:r><w:t>Sản phẩm</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Giá</w:t></w:r></w:p></w:tc></w:tr>",
      "<w:tr><w:tc><w:p><w:r><w:t>Adapter 12V 5A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>125.000</w:t></w:r></w:p></w:tc></w:tr>",
      "</w:tbl>",
      '<w:p><w:r><w:drawing><a:blip r:embed="rId1"/></w:drawing></w:r></w:p>',
      "</w:body>",
      "</w:document>",
    ].join("")
  );
  zip.file("word/media/image1.png", Buffer.from("tiny-image"));

  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

async function createDocxBufferWithMergedPriceTable() {
  const zip = new JSZip();

  zip.file(
    "[Content_Types].xml",
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      "</Types>",
    ].join("")
  );
  zip.file(
    "word/document.xml",
    [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">',
      "<w:body>",
      '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>BẢNG GIÁ NGUỒN LED</w:t></w:r></w:p>',
      "<w:tbl>",
      '<w:tr><w:tc><w:tcPr><w:gridSpan w:val="2"/></w:tcPr><w:p><w:r><w:t>Sản phẩm</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Bán lẻ</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Thi công</w:t></w:r></w:p></w:tc></w:tr>',
      "<w:tr><w:tc><w:p><w:r><w:t>Nguồn tổ ong 24V 10A</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Power Supply</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>210.000</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>195.000</w:t></w:r></w:p></w:tc></w:tr>",
      "</w:tbl>",
      "</w:body>",
      "</w:document>",
    ].join("")
  );

  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

describe("Gemini knowledge import", () => {
  beforeEach(() => {
    mockGenerateGeminiDocumentJson.mockReset();
    mockGenerateGeminiDocumentJson.mockResolvedValue(
      JSON.stringify({
        chunks: [
          {
            title: "Adapter 12V 5A",
            content: "Sản phẩm: Adapter 12V 5A\nGiá: 125.000",
            type: "price",
            confidence: 0.9,
          },
        ],
      })
    );
  });

  it("extracts DOCX structure as tables and image parts before calling Gemini", async () => {
    const buffer = await createDocxBuffer();

    const imported = await importKnowledgeDocumentWithGemini(
      "bang-gia.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      buffer,
      "gemini-key"
    );

    expect(imported.detectedType).toBe("docx-gemini");
    expect(imported.warnings[0]).toContain("OpenXML");
    expect(imported.sections[0]).toEqual(
      expect.objectContaining({
        title: "Adapter 12V 5A",
        content: "Sản phẩm: Adapter 12V 5A\nGiá: 125.000",
      })
    );

    const [, , parts] = mockGenerateGeminiDocumentJson.mock.calls[0];
    expect(parts[0]).toEqual(
      expect.objectContaining({
        text: expect.stringContaining("[TABLE 1]"),
      })
    );
    expect(parts[0].text).toContain("| Adapter 12V 5A | 125.000 |");
    expect(parts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          inlineData: expect.objectContaining({ mimeType: "image/png" }),
        }),
      ])
    );
  });

  it("falls back to another Gemini document model when the first model is unavailable", async () => {
    mockGenerateGeminiDocumentJson
      .mockRejectedValueOnce(
        new Error("Gemini document import error (gemini-2.5-pro, HTTP 503): overloaded")
      )
      .mockResolvedValueOnce(
        JSON.stringify({
          chunks: [
            {
              title: "Adapter 12V 5A",
              content: "Sản phẩm: Adapter 12V 5A\nGiá: 125.000",
              type: "price",
              confidence: 0.9,
            },
          ],
        })
      );

    const imported = await importKnowledgeDocumentWithGemini(
      "bang-gia.md",
      "text/markdown",
      Buffer.from("Adapter 12V 5A\nGiá: 125.000"),
      "gemini-key"
    );

    expect(imported.sections[0].title).toBe("Adapter 12V 5A");
    expect(imported.warnings.join("\n")).toContain("gemini-2.5-pro");
    expect(imported.warnings.join("\n")).toContain("gemini-3.5-flash");
    expect(mockGenerateGeminiDocumentJson.mock.calls[0][3]).toBe("gemini-2.5-pro");
    expect(mockGenerateGeminiDocumentJson.mock.calls[1][3]).toBe("gemini-3.5-flash");
  });

  it("warns and lowers confidence when Gemini output misses source prices", async () => {
    mockGenerateGeminiDocumentJson.mockResolvedValueOnce(
      JSON.stringify({
        chunks: [
          {
            title: "Giới thiệu LED1000",
            content: "LED1000 tư vấn nguồn, LED dây và phụ kiện theo nhu cầu chiếu sáng.",
            type: "intro",
            confidence: 1,
          },
          {
            title: "Lưu ý chọn nguồn LED",
            content: "Cần kiểm tra điện áp, công suất và môi trường lắp đặt trước khi chọn nguồn.",
            type: "price",
            confidence: 1,
          },
          {
            title: "Nguồn tổ ong 24V 10A",
            content: "Sản phẩm: Nguồn tổ ong 24V 10A\nGiá bán lẻ: 210.000",
            type: "price",
            confidence: 1,
          },
        ],
      })
    );

    const imported = await importKnowledgeDocumentWithGemini(
      "nguon-led.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      await createDocxBufferWithMergedPriceTable(),
      "gemini-key"
    );

    expect(imported.warnings.some((warning) => warning.includes("Cảnh báo kiểm chứng giá"))).toBe(
      true
    );
    expect(imported.warnings.join("\n")).toContain("195000");
    expect(imported.sections[0].metadata?.requiresReview).not.toBe(true);
    expect(imported.sections[0].metadata?.parserConfidence).toBe(1);
    expect(imported.sections[0].metadata?.geminiType).toBe("intro");
    expect(imported.sections[1].metadata?.requiresReview).not.toBe(true);
    expect(imported.sections[1].metadata?.parserConfidence).toBe(1);
    expect(imported.sections[2].metadata?.requiresReview).toBe(true);
    expect(imported.sections[2].metadata?.reviewLabel).toBe("Cần kiểm tra giá");
    expect(imported.sections[2].metadata?.parserConfidence).toBeLessThan(1);

    const [, , parts] = mockGenerateGeminiDocumentJson.mock.calls[0];
    expect(parts[0].text).toContain("| Sản phẩm | Sản phẩm | Bán lẻ | Thi công |");
  });

  it("flags suspicious low VND prices without requiring a global missing-price warning", async () => {
    mockGenerateGeminiDocumentJson.mockResolvedValueOnce(
      JSON.stringify({
        chunks: [
          {
            title: "LED dây COB 12V",
            content: "LED dây COB 12V\nƯu đãi từ 850 VNĐ*",
            type: "promotion",
            confidence: 1,
          },
        ],
      })
    );

    const imported = await importKnowledgeDocumentWithGemini(
      "uu-dai.txt",
      "text/plain",
      Buffer.from("LED dây COB 12V\nƯu đãi từ 850 VNĐ*"),
      "gemini-key"
    );

    expect(imported.warnings.some((warning) => warning.includes("giá đáng nghi"))).toBe(true);
    expect(imported.warnings.some((warning) => warning.includes("Cảnh báo kiểm chứng giá"))).toBe(
      false
    );
    expect(imported.sections[0].metadata?.requiresReview).toBe(true);
    expect(imported.sections[0].metadata?.reviewLabel).toBe("Giá đáng nghi");
    expect(imported.sections[0].metadata?.suspiciousPrices).toEqual(["từ 850 VNĐ*"]);
  });
});
