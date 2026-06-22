import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  DEFAULT_KNOWLEDGE_CHUNK_MAX_CHARS,
  importKnowledgeDocument,
  splitTextIntoSections,
} from "@/lib/knowledge/import";

describe("knowledge import helpers", () => {
  it("rejects unsupported file types", async () => {
    await expect(importKnowledgeDocument("malware.exe", "", Buffer.from("hello"))).rejects.toThrow(
      "Unsupported file format"
    );
  });

  it("rejects empty text content", async () => {
    await expect(
      importKnowledgeDocument("empty.txt", "text/plain", Buffer.from("   \n\n"))
    ).rejects.toThrow("extractable text");
  });

  it("keeps short text in one chunk", () => {
    const sections = splitTextIntoSections("FAQ", "Nguồn LED 12V có bảng giá theo công suất.");

    expect(sections).toHaveLength(1);
    expect(sections[0].content).toContain("Nguồn LED 12V");
  });

  it("splits long text into bounded chunks with overlap", () => {
    const longText = Array.from(
      { length: 80 },
      (_, index) => `Câu ${index} về LED.`
    ).join(" ");
    const sections = splitTextIntoSections("Bảng giá", longText, {
      maxChars: 300,
      overlapChars: 50,
    });

    expect(sections.length).toBeGreaterThan(1);
    expect(sections.every((section) => section.content.length <= 300)).toBe(true);
    expect(sections[1].content).toContain(
      sections[0].content.slice(-20).trim().split(/\s+/).at(-1) || ""
    );
  });

  it("uses RAG-sized chunks by default", () => {
    const longParagraph = "A".repeat(DEFAULT_KNOWLEDGE_CHUNK_MAX_CHARS + 800);
    const sections = splitTextIntoSections("Long", longParagraph);

    expect(sections.length).toBeGreaterThan(1);
    expect(
      sections.every((section) => section.content.length <= DEFAULT_KNOWLEDGE_CHUNK_MAX_CHARS)
    ).toBe(true);
  });

  it("formats XLSX rows with sheet and header context", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Sản phẩm", "Điện áp", "Giá"],
      ["LED dây COB", "12V", "85k/m"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Bảng giá");
    const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

    const imported = await importKnowledgeDocument(
      "bang-gia.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer
    );

    expect(imported.detectedType).toBe("xlsx");
    expect(imported.sections[0].content).toContain("Sheet: Bảng giá");
    expect(imported.sections[0].content).toContain("Sản phẩm: LED dây COB");
    expect(imported.sections[0].metadata?.sheetName).toBe("Bảng giá");
  });

  it("splits FAQ documents into one entry per question", async () => {
    const imported = await importKnowledgeDocument(
      "faq.txt",
      "text/plain",
      Buffer.from(
        [
          "FAQ NGUỒN LED",
          "Câu hỏi: Adapter 12V 5A giá bao nhiêu?Trả lời: Dạ giá cần đối chiếu bảng giá chính thức trước khi báo khách ạ.",
          "Câu hỏi: Có nguồn 24V không?Trả lời: Dạ có nhóm nguồn LED 24V, cần kiểm tra model và công suất khách cần.",
        ].join("\n")
      )
    );

    expect(imported.sections).toHaveLength(2);
    expect(imported.sections[0].title).toBe("Adapter 12V 5A giá bao nhiêu?");
    expect(imported.sections[0].content).toContain("Nhóm: FAQ NGUỒN LED");
    expect(imported.sections[1].content).toContain("Dạ có nhóm nguồn LED 24V");
  });

  it("accepts common FAQ labels beyond the exact Vietnamese template", async () => {
    const imported = await importKnowledgeDocument(
      "faq.txt",
      "text/plain",
      Buffer.from(
        [
          "General Questions",
          "Q: LED dây ngoài trời cần chọn loại nào?",
          "A: Nên chọn loại chống nước và kiểm tra điện áp trước khi mua.",
          "Hỏi: Có tư vấn nguồn cho LED dây không?",
          "Đáp: Dạ có tư vấn theo điện áp, chiều dài dây và công suất.",
        ].join("\n")
      )
    );

    expect(imported.sections).toHaveLength(2);
    expect(imported.sections[0].title).toBe("LED dây ngoài trời cần chọn loại nào?");
    expect(imported.sections[0].metadata?.parserConfidence).toBe(0.95);
    expect(imported.sections[1].content).toContain("Dạ có tư vấn theo điện áp");
  });

  it("groups price catalogue lines around product names and prices", async () => {
    const imported = await importKnowledgeDocument(
      "data.txt",
      "text/plain",
      Buffer.from(
        [
          "BẢNG GIÁ",
          "NGUỒN LED",
          "ADAPTER 12V 5A",
          "Adapter dùng cho LED dây 12V",
          "125.000đ",
          "LED dây COB 12V",
          "Ánh sáng mềm, phù hợp hắt trần",
          "85.000đ",
          "Nguồn tổ ong 24V 10A",
          "Dùng cho hệ LED 24V công suất lớn",
          "210.000đ",
        ].join("\n")
      )
    );

    expect(imported.sections.some((section) => section.title === "ADAPTER 12V 5A")).toBe(true);
    expect(imported.sections.some((section) => section.title === "LED dây COB 12V")).toBe(true);
    expect(
      imported.sections.find((section) => section.title === "ADAPTER 12V 5A")?.content
    ).toContain("Giá: 125.000đ");
  });

  it("imports spreadsheet price tables as one knowledge entry per row", async () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["BẢNG GIÁ NGUỒN LED"],
      ["Sản phẩm", "Giá bán lẻ", "Giá thi công"],
      ["Adapter 12V 5A", "125k", "115k"],
      ["Nguồn tổ ong 24V 10A", "210.000đ", "195.000đ"],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "LED1000");
    const buffer = Buffer.from(XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }));

    const imported = await importKnowledgeDocument(
      "led1000.xlsx",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      buffer
    );

    expect(imported.sections).toHaveLength(2);
    expect(imported.sections[0].title).toBe("Adapter 12V 5A");
    expect(imported.sections[0].content).toContain("BẢNG GIÁ NGUỒN LED");
    expect(imported.sections[0].content).toContain("Giá bán lẻ: 125k");
    expect(imported.sections[0].metadata?.sourceFormat).toBe("spreadsheet-row");
    expect(imported.sections[1].content).toContain("195.000đ");
  });
});
