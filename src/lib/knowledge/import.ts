import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import WordExtractor from "word-extractor";
import * as XLSX from "xlsx";

const MAX_ENTRY_CONTENT_LENGTH = 5000;
const MAX_IMPORTED_SECTIONS = 50;

export const SUPPORTED_KNOWLEDGE_FILE_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "csv",
  "txt",
  "md",
] as const;

export interface ImportedKnowledgeSection {
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface ImportedKnowledgeDocument {
  sections: ImportedKnowledgeSection[];
  warnings: string[];
  detectedType: string;
}

export function isSupportedKnowledgeFile(fileName: string): boolean {
  const extension = getFileExtension(fileName);
  return SUPPORTED_KNOWLEDGE_FILE_EXTENSIONS.includes(
    extension as (typeof SUPPORTED_KNOWLEDGE_FILE_EXTENSIONS)[number]
  );
}

export async function importKnowledgeDocument(
  fileName: string,
  mimeType: string,
  buffer: Buffer
): Promise<ImportedKnowledgeDocument> {
  const extension = getFileExtension(fileName);

  if (!isSupportedKnowledgeFile(fileName)) {
    throw new Error(
      "Unsupported file format. Please upload PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, or MD."
    );
  }

  switch (extension) {
    case "pdf":
      return importTextLikeDocument(
        fileName,
        "pdf",
        await extractPdfText(buffer)
      );
    case "doc":
      return importTextLikeDocument(
        fileName,
        "doc",
        await extractDocText(buffer)
      );
    case "docx":
      return importTextLikeDocument(
        fileName,
        "docx",
        await extractDocxText(buffer)
      );
    case "xls":
    case "xlsx":
    case "csv":
      return importWorkbookDocument(fileName, mimeType, buffer);
    case "txt":
    case "md":
      return importTextLikeDocument(
        fileName,
        extension,
        buffer.toString("utf8")
      );
    default:
      throw new Error(`Unsupported file extension: ${extension}`);
  }
}

function getFileExtension(fileName: string): string {
  const normalized = fileName.toLowerCase();
  const parts = normalized.split(".");
  return parts.length > 1 ? parts.at(-1) || "" : "";
}

function getBaseTitle(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Imported knowledge";
}

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/\t/g, " ")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n[ \u00a0]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function importTextLikeDocument(
  fileName: string,
  detectedType: string,
  text: string
): ImportedKnowledgeDocument {
  const normalized = normalizeText(text);
  if (!normalized) {
    throw new Error("The uploaded file does not contain extractable text.");
  }

  const warnings: string[] = [];
  let sections = splitTextIntoSections(getBaseTitle(fileName), normalized);

  if (sections.length > MAX_IMPORTED_SECTIONS) {
    sections = sections.slice(0, MAX_IMPORTED_SECTIONS);
    warnings.push(
      `The file was split into more than ${MAX_IMPORTED_SECTIONS} sections. Only the first ${MAX_IMPORTED_SECTIONS} were imported.`
    );
  }

  return { sections, warnings, detectedType };
}

function importWorkbookDocument(
  fileName: string,
  mimeType: string,
  buffer: Buffer
): ImportedKnowledgeDocument {
  const workbook =
    mimeType === "text/csv"
      ? XLSX.read(buffer.toString("utf8"), { type: "string" })
      : XLSX.read(buffer, { type: "buffer" });

  const sections: ImportedKnowledgeSection[] = [];
  const warnings: string[] = [];
  const baseTitle = getBaseTitle(fileName);

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;

    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });

    const normalizedRows = rows
      .map((row) => row.map((cell) => String(cell ?? "").trim()))
      .filter((row) => row.some(Boolean));

    if (normalizedRows.length === 0) continue;

    const header = looksLikeHeaderRow(normalizedRows[0]) ? normalizedRows[0] : null;
    const dataRows = header ? normalizedRows.slice(1) : normalizedRows;
    const lineItems = dataRows
      .map((row, index) => formatWorkbookRow(row, header, index + 1))
      .filter(Boolean);

    if (lineItems.length === 0) continue;

    const chunks = chunkStringList(lineItems, MAX_ENTRY_CONTENT_LENGTH);
    chunks.forEach((chunk, index) => {
      sections.push({
        title:
          chunks.length === 1
            ? `${baseTitle} - ${sheetName}`
            : `${baseTitle} - ${sheetName} - Phần ${index + 1}`,
        content: chunk.join("\n"),
        metadata: {
          sourceType: "spreadsheet",
          sheetName,
          rowCount: dataRows.length,
          importedFrom: fileName,
        },
      });
    });
  }

  if (sections.length === 0) {
    throw new Error("The spreadsheet does not contain usable rows to import.");
  }

  let limitedSections = sections;
  if (sections.length > MAX_IMPORTED_SECTIONS) {
    limitedSections = sections.slice(0, MAX_IMPORTED_SECTIONS);
    warnings.push(
      `The workbook generated more than ${MAX_IMPORTED_SECTIONS} knowledge entries. Only the first ${MAX_IMPORTED_SECTIONS} were imported.`
    );
  }

  return {
    sections: limitedSections,
    warnings,
    detectedType: mimeType === "text/csv" ? "csv" : "spreadsheet",
  };
}

function looksLikeHeaderRow(row: string[]): boolean {
  const filled = row.filter(Boolean);
  if (filled.length < 2) return false;

  return filled.every((cell) => cell.length > 0 && cell.length < 60);
}

function formatWorkbookRow(row: string[], header: string[] | null, rowNumber: number): string {
  const values = row.filter(Boolean);
  if (values.length === 0) return "";

  if (!header) {
    return values.join(" | ");
  }

  const pairs = row
    .map((cell, index) => {
      const key = header[index]?.trim();
      const value = cell.trim();
      if (!key || !value) return "";
      return `${key}: ${value}`;
    })
    .filter(Boolean);

  return pairs.length > 0 ? pairs.join(" | ") : `Dòng ${rowNumber}: ${values.join(" | ")}`;
}

function chunkStringList(items: string[], maxLength: number): string[][] {
  const chunks: string[][] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const item of items) {
    const itemLength = item.length + 1;
    if (currentChunk.length > 0 && currentLength + itemLength > maxLength) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentLength = 0;
    }

    currentChunk.push(item);
    currentLength += itemLength;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function splitTextIntoSections(baseTitle: string, text: string): ImportedKnowledgeSection[] {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return [];
  }

  const sections: ImportedKnowledgeSection[] = [];
  let currentTitle = baseTitle;
  let currentParagraphs: string[] = [];
  let partNumber = 1;

  const flush = () => {
    const content = normalizeText(currentParagraphs.join("\n\n"));
    if (!content) return;

    const sectionTitle =
      sections.some((section) => section.title === currentTitle) || !currentTitle
        ? `${baseTitle} - Phần ${partNumber}`
        : currentTitle;

    sections.push({ title: sectionTitle, content });
    currentParagraphs = [];
    currentTitle = `${baseTitle} - Phần ${partNumber + 1}`;
    partNumber += 1;
  };

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];

    if (looksLikeHeading(paragraph) && index < paragraphs.length - 1) {
      if (currentParagraphs.length > 0) {
        flush();
      }
      currentTitle = sanitizeHeading(paragraph, baseTitle, partNumber);
      continue;
    }

    const projectedLength = currentParagraphs.join("\n\n").length + paragraph.length + 2;
    if (currentParagraphs.length > 0 && projectedLength > MAX_ENTRY_CONTENT_LENGTH) {
      flush();
    }

    currentParagraphs.push(paragraph);
  }

  if (currentParagraphs.length > 0) {
    flush();
  }

  if (sections.length > 0) {
    return sections;
  }

  return [{ title: baseTitle, content: text }];
}

function looksLikeHeading(paragraph: string): boolean {
  const compact = paragraph.replace(/\s+/g, " ").trim();
  if (!compact || compact.length > 120) return false;

  const lines = compact.split("\n").filter(Boolean);
  if (lines.length > 2) return false;

  const cleaned = compact.replace(/^[-*#\d.\)\s]+/, "").trim();
  if (cleaned.length < 4) return false;

  if (cleaned.endsWith(":") || cleaned.endsWith("?")) return true;
  if (/[.;!]$/.test(cleaned)) return false;

  const words = cleaned.split(/\s+/).filter(Boolean);
  const alphaWords = words.filter((word) => /[A-Za-zÀ-ỹ]/.test(word));
  if (alphaWords.length < 2) return false;

  const leadingCaps = alphaWords.filter((word) => /^[A-ZÀ-Ỹ0-9]/.test(word)).length;
  return leadingCaps / alphaWords.length >= 0.7;
}

function sanitizeHeading(heading: string, baseTitle: string, partNumber: number): string {
  const compact = heading.replace(/\s+/g, " ").trim();
  const cleaned = compact.replace(/^[-*#\d.\)\s]+/, "").trim();
  return cleaned || `${baseTitle} - Phần ${partNumber}`;
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const result = await parser.getText({ parseHyperlinks: false });
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractDocText(buffer: Buffer): Promise<string> {
  const extractor = new WordExtractor();
  const document = await extractor.extract(buffer);

  return [
    document.getBody(),
    document.getHeaders({ includeFooters: false }),
    document.getFooters(),
    document.getFootnotes(),
    document.getEndnotes(),
    document.getAnnotations(),
    document.getTextboxes(),
  ]
    .filter(Boolean)
    .join("\n\n");
}
