import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import WordExtractor from "word-extractor";
import * as XLSX from "xlsx";

export const DEFAULT_KNOWLEDGE_CHUNK_MAX_CHARS = 1400;
export const DEFAULT_KNOWLEDGE_CHUNK_OVERLAP_CHARS = 160;

const MAX_IMPORTED_SECTIONS = 200;

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

interface ChunkOptions {
  maxChars?: number;
  overlapChars?: number;
}

interface HtmlTableSectionOptions {
  baseTitle: string;
  fileName: string;
}

const FAQ_QUESTION_LABEL_PATTERN = "(?:Câu\\s*hỏi|Cau\\s*hoi|Hỏi|Hoi|Question|Q)";
const FAQ_ANSWER_LABEL_PATTERN = "(?:Trả\\s*lời|Tra\\s*loi|Đáp|Dap|Answer|A)";

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
      return importTextLikeDocument(fileName, "pdf", await extractPdfText(buffer));
    case "doc":
      return importTextLikeDocument(fileName, "doc", await extractDocText(buffer));
    case "docx":
      return importDocxDocument(fileName, buffer);
    case "xls":
    case "xlsx":
    case "csv":
      return importWorkbookDocument(fileName, extension, mimeType, buffer);
    case "txt":
    case "md":
      return importTextLikeDocument(fileName, extension, buffer.toString("utf8"));
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
  return (
    fileName
      .replace(/\.[^.]+$/, "")
      .replace(/[_-]+/g, " ")
      .trim() || "Imported knowledge"
  );
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
    if (detectedType === "pdf") {
      throw new Error(
        "File PDF có thể là bản scan hoặc không có text đọc được. OCR chưa được hỗ trợ trong phase này."
      );
    }

    throw new Error("The uploaded file does not contain extractable text.");
  }

  const sections =
    splitFaqSections(getBaseTitle(fileName), normalized) ||
    splitPriceCatalogueSections(getBaseTitle(fileName), normalized) ||
    splitTextIntoSections(getBaseTitle(fileName), normalized);

  return limitImportedSections({ sections, warnings: [], detectedType });
}

async function importDocxDocument(
  fileName: string,
  buffer: Buffer
): Promise<ImportedKnowledgeDocument> {
  const warnings: string[] = [];
  const baseTitle = getBaseTitle(fileName);
  const htmlResult = await mammoth.convertToHtml({ buffer });
  for (const message of htmlResult.messages || []) {
    if (message.message) {
      warnings.push(`DOCX parser: ${message.message}`);
    }
  }

  const tableSections = parseHtmlTableSections(htmlResult.value, {
    baseTitle,
    fileName,
  });

  if (tableSections.length > 0) {
    const introText = htmlToText(htmlResult.value.split(/<table[\s>]/i)[0] || "");
    const rawIntroSections = introText
      ? splitTextIntoSections(baseTitle, introText, {
          maxChars: DEFAULT_KNOWLEDGE_CHUNK_MAX_CHARS,
        }).slice(0, 2)
      : [];
    const introSections = rawIntroSections.map((section, index) => ({
      ...section,
      title:
        index === 0
          ? `${baseTitle} - Thông tin chung`
          : `${baseTitle} - Thông tin chung ${index + 1}`,
      metadata: {
        ...(section.metadata || {}),
        sourceFormat: "docx-intro",
        parserConfidence: 0.7,
      },
    }));

    return limitImportedSections({
      sections: [...introSections, ...tableSections],
      warnings,
      detectedType: "docx",
    });
  }

  const textResult = await mammoth.extractRawText({ buffer });
  const imported = importTextLikeDocument(fileName, "docx", textResult.value);
  return limitImportedSections({
    ...imported,
    warnings: [...warnings, ...imported.warnings],
  });
}

function limitImportedSections(document: ImportedKnowledgeDocument): ImportedKnowledgeDocument {
  if (document.sections.length <= MAX_IMPORTED_SECTIONS) return document;

  return {
    ...document,
    sections: document.sections.slice(0, MAX_IMPORTED_SECTIONS),
    warnings: [
      ...document.warnings,
      `The file was split into more than ${MAX_IMPORTED_SECTIONS} sections. Only the first ${MAX_IMPORTED_SECTIONS} were imported.`,
    ],
  };
}

function parseHtmlTableSections(
  html: string,
  options: HtmlTableSectionOptions
): ImportedKnowledgeSection[] {
  const tables = html.match(/<table[\s\S]*?<\/table>/gi) || [];
  const sections: ImportedKnowledgeSection[] = [];

  tables.forEach((tableHtml, tableIndex) => {
    const rows = parseHtmlTableRows(tableHtml);
    const tableSections = tableRowsToKnowledgeSections(rows, {
      ...options,
      tableIndex,
    });
    sections.push(...tableSections);
  });

  return sections;
}

function parseHtmlTableRows(tableHtml: string): string[][] {
  const rowMatches = tableHtml.match(/<tr[\s\S]*?<\/tr>/gi) || [];

  return rowMatches
    .map((rowHtml) => {
      const cellMatches = rowHtml.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) || [];
      return cellMatches.map(htmlToText).filter((cell) => cell.length > 0);
    })
    .filter((row) => row.length > 0);
}

function tableRowsToKnowledgeSections(
  rows: string[][],
  options: HtmlTableSectionOptions & { tableIndex: number }
): ImportedKnowledgeSection[] {
  const sections: ImportedKnowledgeSection[] = [];
  const headingRows: string[][] = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    let row = rows[rowIndex];
    let priceCells = getPriceCells(row);
    let mergedPriceOnlyRow = false;

    if (priceCells.length === 0 && rowIndex < rows.length - 1) {
      const nextRow = rows[rowIndex + 1];
      const nextPriceCells = getPriceCells(nextRow);
      if (nextPriceCells.length > 0 && nextPriceCells.length === nextRow.length) {
        row = [...row, ...nextRow];
        mergedPriceOnlyRow = true;
        priceCells = row
          .map((cell, cellIndex) => ({ cell, cellIndex }))
          .filter(({ cell }) => isPriceLine(cell));
        rowIndex += 1;
      }
    }

    if (priceCells.length === 0) {
      headingRows.push(row);
      continue;
    }

    const descriptorCells = row.filter((cell) => !isPriceLine(cell));
    if (descriptorCells.length === 0) {
      continue;
    }

    const tableContext = flattenTableContext(headingRows);
    const title = pickTableRowTitle(descriptorCells, tableContext, options.baseTitle);
    const inlinePriceLabels = findInlinePriceLabels(descriptorCells, priceCells.length);
    const priceLines = priceCells.map(({ cell, cellIndex }, priceIndex) => {
      const label =
        inlinePriceLabels[priceIndex] ||
        (mergedPriceOnlyRow
          ? ""
          : findPriceColumnLabel(headingRows, {
              cellIndex,
              priceIndex,
              priceCount: priceCells.length,
              descriptorCount: descriptorCells.length,
            }));
      return label ? `Giá ${label}: ${cell}` : `Giá: ${cell}`;
    });
    const contextLines = tableContext.slice(0, 8).filter((line) => !descriptorCells.includes(line));
    const contentLines = [...contextLines, ...descriptorCells, ...priceLines].filter(
      (line, index, allLines) => !isCatalogueNoise(line) && allLines.indexOf(line) === index
    );

    sections.push({
      title,
      content: normalizeText(contentLines.join("\n")),
      metadata: {
        sourceFormat: "docx-table",
        sourceType: "table",
        tableIndex: options.tableIndex,
        rowIndex,
        priceCount: priceCells.length,
        parserConfidence: priceCells.length > 0 && descriptorCells.length > 0 ? 0.92 : 0.65,
        importedFrom: options.fileName,
      },
    });
  }

  return sections;
}

function getPriceCells(row: string[]): Array<{ cell: string; cellIndex: number }> {
  return row
    .map((cell, cellIndex) => ({ cell, cellIndex }))
    .filter(({ cell }) => isPriceLine(cell));
}

function flattenTableContext(rows: string[][]): string[] {
  return rows.flatMap((row) => row.flatMap((cell) => splitCellLines(cell))).filter(Boolean);
}

function splitCellLines(cell: string): string[] {
  return cell
    .split(/\n+|\s+\|\s+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function pickTableRowTitle(
  descriptorCells: string[],
  tableContext: string[],
  fallbackTitle: string
): string {
  const descriptorCandidates = descriptorCells
    .flatMap(splitTitleLines)
    .filter(isServiceTitleCandidate);
  const contextCandidates = tableContext.filter(isServiceTitleCandidate);

  const pipeCandidate = descriptorCandidates.find((line) => line.includes("|"));
  if (pipeCandidate) return pipeCandidate.split("|")[0].trim().slice(0, 120);

  const vietnameseDescriptor = descriptorCandidates.find((line) => !looksMostlyEnglish(line));
  if (vietnameseDescriptor) return vietnameseDescriptor.slice(0, 120);

  if (descriptorCandidates[0]) return descriptorCandidates[0].slice(0, 120);

  const contextPipeCandidate = contextCandidates.find((line) => line.includes("|"));
  if (contextPipeCandidate) return contextPipeCandidate.split("|")[0].trim().slice(0, 120);

  const contextCandidate = contextCandidates.find((line) => !looksMostlyEnglish(line));
  if (contextCandidate) return contextCandidate.slice(0, 120);

  return (contextCandidates[0] || fallbackTitle).slice(0, 120);
}

function splitTitleLines(cell: string): string[] {
  return cell
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
}

function isServiceTitleCandidate(line: string): boolean {
  return (
    Boolean(line) &&
    !isPriceLine(line) &&
    !isCatalogueHeaderOnly(line) &&
    !isCatalogueDescriptionLine(line)
  );
}

function findInlinePriceLabels(descriptorCells: string[], priceCount: number): string[] {
  if (priceCount <= 0) return [];

  const lines = descriptorCells.flatMap(splitCellLines);
  if (lines.length === priceCount && lines.every(isCompactServicePriceLabel)) {
    return lines;
  }

  const tail = lines.slice(-priceCount);
  if (tail.length !== priceCount || !tail.every(isInlinePriceLabelCandidate)) {
    return [];
  }

  return tail;
}

function isCompactServicePriceLabel(line: string): boolean {
  return (
    line.length <= 60 &&
    !isCatalogueDescriptionLine(line) &&
    !looksMostlyEnglish(line) &&
    !/[.!?]$/.test(line)
  );
}

function isInlinePriceLabelCandidate(line: string): boolean {
  return /^(?:\d+\s*[-–]?\s*\d*\s*(?:cm|sợi|tep|tép)|[SMLX]{1,2}|size\s+[SMLX]{1,2}|trẻ em|người lớn)$/i.test(
    line.trim()
  );
}

function findPriceColumnLabel(
  headingRows: string[][],
  options: { cellIndex: number; priceIndex: number; priceCount: number; descriptorCount: number }
): string {
  for (let rowIndex = headingRows.length - 1; rowIndex >= 0; rowIndex -= 1) {
    const headingRow = headingRows[rowIndex];
    const label =
      headingRow.length === options.priceCount
        ? headingRow[options.priceIndex]
        : headingRow.length === options.priceCount + options.descriptorCount
          ? headingRow[options.cellIndex]
          : headingRow[options.cellIndex] || headingRow[options.priceIndex];
    if (label && !isPriceLine(label) && isPriceColumnLabelCandidate(label)) {
      return splitCellLines(label).join(" ");
    }
  }

  return "";
}

function isPriceColumnLabelCandidate(label: string): boolean {
  const normalized = normalizeText(label);
  return (
    normalized.length <= 80 &&
    !/khách vui lòng|liên hệ|báo giá|tham khảo/i.test(normalized) &&
    !isCatalogueDescriptionLine(normalized)
  );
}

function htmlToText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .split(/\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .join("\n");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function importWorkbookDocument(
  fileName: string,
  extension: string,
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

    const rowSections = spreadsheetRowsToKnowledgeSections(normalizedRows, {
      baseTitle,
      fileName,
      sheetName,
    });
    if (rowSections.length > 0) {
      sections.push(...rowSections);
      continue;
    }

    const header = looksLikeHeaderRow(normalizedRows[0]) ? normalizedRows[0] : null;
    const dataRows = header ? normalizedRows.slice(1) : normalizedRows;
    const lineItems = dataRows
      .map((row, index) => formatWorkbookRow(row, header, index + 1))
      .filter(Boolean);

    if (lineItems.length === 0) continue;

    const chunks = chunkStringList(lineItems, DEFAULT_KNOWLEDGE_CHUNK_MAX_CHARS);
    chunks.forEach((chunk, index) => {
      sections.push({
        title:
          chunks.length === 1
            ? `${baseTitle} - ${sheetName}`
            : `${baseTitle} - ${sheetName} - Phần ${index + 1}`,
        content: normalizeText([`Sheet: ${sheetName}`, ...chunk].join("\n")),
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
    detectedType: extension,
  };
}

function spreadsheetRowsToKnowledgeSections(
  rows: string[][],
  options: HtmlTableSectionOptions & { sheetName: string }
): ImportedKnowledgeSection[] {
  const sections: ImportedKnowledgeSection[] = [];
  let context: string[] = [];
  let header: string[] | null = null;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex].map((cell) => normalizeText(cell));
    const filled = row.filter(Boolean);
    if (filled.length === 0) continue;

    if (filled.length === 1 && !isPriceLine(filled[0])) {
      context = [...context.slice(-4), filled[0]];
      header = null;
      continue;
    }

    if (looksLikeSpreadsheetHeaderRow(row)) {
      header = row;
      continue;
    }

    const hasPrice = row.some(isPriceLine);
    const hasUsefulHeader = header?.some(isKnowledgeTableHeaderCell) || false;
    const shouldCreateRowSection = hasPrice || (Boolean(header) && hasUsefulHeader);
    if (!shouldCreateRowSection) {
      continue;
    }

    const title = pickSpreadsheetRowTitle(row, header, context, options.baseTitle, rowIndex + 1);
    const content = formatSpreadsheetSectionContent(row, header, context, options.sheetName);
    if (!content) continue;

    sections.push({
      title,
      content,
      metadata: {
        sourceFormat: "spreadsheet-row",
        sourceType: "spreadsheet",
        sheetName: options.sheetName,
        rowIndex,
        parserConfidence: hasPrice ? 0.9 : 0.72,
        importedFrom: options.fileName,
      },
    });
  }

  return sections.length >= 2 ? sections : [];
}

function looksLikeSpreadsheetHeaderRow(row: string[]): boolean {
  if (!looksLikeHeaderRow(row)) return false;
  return row.some(isKnowledgeTableHeaderCell) || row.some(isPriceTierHeaderCell);
}

function isKnowledgeTableHeaderCell(cell: string): boolean {
  return /^(dịch vụ|dich vu|tên|ten|name|service|gói|goi|combo|nội dung|noi dung|mô tả|mo ta|description|giá|gia|price|size)$/i.test(
    cell.trim()
  );
}

function isPriceTierHeaderCell(cell: string): boolean {
  return /^(giá|gia|price|đơn giá|don gia|giá bán|gia ban|bán lẻ|ban le|bán sỉ|ban si|sỉ|si|lẻ|le|size|kích thước|kich thuoc|quy cách|quy cach|model|mã|ma|sku|điện áp|dien ap|công suất|cong suat)/i.test(
    cell.trim()
  );
}

function pickSpreadsheetRowTitle(
  row: string[],
  header: string[] | null,
  context: string[],
  baseTitle: string,
  rowNumber: number
): string {
  if (header) {
    const serviceIndex = header.findIndex((cell) =>
      /^(dịch vụ|dich vu|tên|ten|name|service|gói|goi|combo)$/i.test(cell.trim())
    );
    const serviceValue = serviceIndex >= 0 ? row[serviceIndex]?.trim() : "";
    if (serviceValue && !isPriceLine(serviceValue)) {
      return serviceValue.slice(0, 120);
    }
  }

  const candidate = row.find(
    (cell) =>
      cell &&
      !isPriceLine(cell) &&
      !isCatalogueHeaderOnly(cell) &&
      !isCatalogueDescriptionLine(cell)
  );

  return (candidate || context.at(-1) || `${baseTitle} - Dòng ${rowNumber}`).slice(0, 120);
}

function formatSpreadsheetSectionContent(
  row: string[],
  header: string[] | null,
  context: string[],
  sheetName: string
): string {
  const contentLines = [`Sheet: ${sheetName}`, ...context.slice(-5)];

  if (header) {
    contentLines.push(formatWorkbookRow(row, header, 0));
  } else {
    const descriptorLines = row.filter((cell) => cell && !isPriceLine(cell));
    const priceLines = row
      .map((cell, cellIndex) => ({ cell, cellIndex }))
      .filter(({ cell }) => isPriceLine(cell))
      .map(({ cell, cellIndex }) => `Giá cột ${cellIndex + 1}: ${cell}`);
    contentLines.push(...descriptorLines, ...priceLines);
  }

  return normalizeText(contentLines.filter(Boolean).join("\n"));
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

function splitFaqSections(baseTitle: string, text: string): ImportedKnowledgeSection[] | null {
  const questionRegex = new RegExp(`${FAQ_QUESTION_LABEL_PATTERN}\\s*[:：.-]`, "i");
  const answerRegex = new RegExp(`${FAQ_ANSWER_LABEL_PATTERN}\\s*[:：.-]`, "i");
  if (!questionRegex.test(text) || !answerRegex.test(text)) {
    return null;
  }

  const questionLineRegex = new RegExp(`^${FAQ_QUESTION_LABEL_PATTERN}\\s*[:：.-]\\s*(.+)$`, "i");
  const answerLineRegex = new RegExp(`^${FAQ_ANSWER_LABEL_PATTERN}\\s*[:：.-]\\s*(.+)$`, "i");
  const markerRegex = new RegExp(
    `(^|[\\n\\s?!.])(${FAQ_QUESTION_LABEL_PATTERN}|${FAQ_ANSWER_LABEL_PATTERN})\\s*[:：.-]`,
    "gi"
  );

  const lines = text
    .replace(markerRegex, "$1\n$2:")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: ImportedKnowledgeSection[] = [];
  let currentGroup = baseTitle;
  let currentQuestion = "";
  let answerLines: string[] = [];

  const flush = () => {
    const answer = normalizeText(answerLines.join(" "));
    if (!currentQuestion || !answer) return;

    sections.push({
      title: currentQuestion.replace(/\?+$/, "?"),
      content: normalizeText(
        [`Nhóm: ${currentGroup}`, `Câu hỏi: ${currentQuestion}`, `Trả lời: ${answer}`].join("\n")
      ),
      metadata: {
        sourceFormat: "faq",
        faqGroup: currentGroup,
        parserConfidence: 0.95,
      },
    });
  };

  for (const line of lines) {
    const questionMatch = line.match(questionLineRegex);
    if (questionMatch) {
      flush();
      currentQuestion = questionMatch[1].trim();
      answerLines = [];
      continue;
    }

    const answerMatch = line.match(answerLineRegex);
    if (answerMatch) {
      answerLines.push(answerMatch[1].trim());
      continue;
    }

    if (looksLikeFaqGroupHeading(line)) {
      flush();
      currentQuestion = "";
      answerLines = [];
      currentGroup = sanitizeFaqHeading(line, baseTitle);
      continue;
    }

    if (currentQuestion && answerLines.length > 0) {
      answerLines.push(line);
      continue;
    }

    currentGroup = sanitizeFaqHeading(line, baseTitle);
  }

  flush();

  return sections.length > 0 ? sections : null;
}

function sanitizeFaqHeading(line: string, baseTitle: string): string {
  const cleaned = line.replace(/^\d+[\).\s-]+/, "").trim();
  return cleaned || baseTitle;
}

function looksLikeFaqGroupHeading(line: string): boolean {
  const questionLineRegex = new RegExp(`^${FAQ_QUESTION_LABEL_PATTERN}\\s*[:：.-]`, "i");
  const answerLineRegex = new RegExp(`^${FAQ_ANSWER_LABEL_PATTERN}\\s*[:：.-]`, "i");
  return (
    /FAQ|CÂU HỎI|QUESTIONS?/i.test(line) &&
    !questionLineRegex.test(line) &&
    !answerLineRegex.test(line)
  );
}

function splitPriceCatalogueSections(
  baseTitle: string,
  text: string
): ImportedKnowledgeSection[] | null {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line && !/^[_\s]+$/.test(line) && line.toLowerCase() !== "asd");

  const priceLineCount = lines.filter(isPriceLine).length;
  if (priceLineCount < 3) return null;

  const sections: ImportedKnowledgeSection[] = [];
  const introLines = lines
    .slice(0, Math.min(lines.findIndex(isPriceLine), 18))
    .filter((line) => !isCatalogueNoise(line));
  if (introLines.length > 3) {
    sections.push({
      title: baseTitle,
      content: normalizeText(introLines.join("\n")),
      metadata: {
        sourceFormat: "price-catalogue",
        catalogueSection: "intro",
        parserConfidence: 0.72,
      },
    });
  }

  for (let index = 0; index < lines.length; index += 1) {
    if (!isPriceLine(lines[index]) || (index > 0 && isPriceLine(lines[index - 1]))) {
      continue;
    }

    const descriptorLines = collectDescriptorLines(lines, index);
    const usefulDescriptorLines = descriptorLines.filter((line) => !isCatalogueNoise(line));
    const title = pickCatalogueTitle(usefulDescriptorLines);
    if (!title) continue;

    const prices: string[] = [];
    let priceIndex = index;
    while (priceIndex < lines.length && isPriceLine(lines[priceIndex])) {
      prices.push(lines[priceIndex]);
      priceIndex += 1;
    }

    const noteLines = collectCatalogueNotes(lines, priceIndex);
    const contentLines = [
      ...usefulDescriptorLines,
      formatPriceLines(prices, descriptorLines),
      ...noteLines,
    ].filter(Boolean);

    sections.push({
      title,
      content: normalizeText(contentLines.join("\n")),
      metadata: {
        sourceFormat: "price-catalogue",
        priceCount: prices.length,
        parserConfidence: prices.length > 0 && usefulDescriptorLines.length > 0 ? 0.88 : 0.62,
      },
    });
  }

  return sections.length > 0 ? sections : null;
}

function isPriceLine(line: string): boolean {
  const priceToken =
    "(?:\\+?\\s*)?(?:\\d{1,3}(?:[.,]\\d{3})+\\s*(?:đ|d|vnd)?|\\d+(?:[.,]\\d+)?\\s*(?:k|đ|d|vnd|tr|triệu|million|m))";
  const normalized = line
    .trim()
    .replace(/\s+/g, " ")
    .replace(/đồng/gi, "đ")
    .replace(/\s*\/\s*(?:lần|lan|chùm|chum|tép|tep)$/gi, "");

  return new RegExp(
    `^(?:từ|from)?\\s*${priceToken}(?:\\s*[-–]\\s*${priceToken})?(?:\\s*\\+)?$`,
    "iu"
  ).test(normalized);
}

function collectDescriptorLines(lines: string[], priceIndex: number): string[] {
  const collected: string[] = [];
  for (let index = priceIndex - 1; index >= 0 && collected.length < 7; index -= 1) {
    const line = lines[index];
    if (isPriceLine(line) || /^[_\s]+$/.test(line)) break;
    if (
      collected.length > 0 &&
      isLongCatalogueNote(line) &&
      collected.some((item) => isCatalogueTitleCandidate(item) && !isCatalogueDescriptionLine(item))
    ) {
      break;
    }
    collected.unshift(line);
  }

  return collected;
}

function collectCatalogueNotes(lines: string[], startIndex: number): string[] {
  const notes: string[] = [];
  for (let index = startIndex; index < lines.length && notes.length < 3; index += 1) {
    const line = lines[index];
    if (isPriceLine(line)) break;
    if (looksLikeCatalogueServiceStart(lines, index)) break;
    if (isLongCatalogueNote(line)) {
      notes.push(line);
    }
  }

  return notes;
}

function looksLikeCatalogueServiceStart(lines: string[], index: number): boolean {
  if (index >= lines.length - 1) return false;
  const line = lines[index];
  const next = lines[index + 1];
  const nextNext = lines[index + 2];

  return (
    !isCatalogueNoise(line) &&
    !isPriceLine(line) &&
    (isPriceLine(next) || isPriceLine(nextNext || ""))
  );
}

function pickCatalogueTitle(lines: string[]): string {
  const serviceLines = lines.filter((line) => !isCatalogueHeaderOnly(line));
  if (serviceLines.length === 0) return "";

  const pipeCandidate = [...serviceLines]
    .reverse()
    .find(
      (line) =>
        line.includes("|") && isCatalogueTitleCandidate(line) && !isCatalogueDescriptionLine(line)
    );
  if (pipeCandidate) {
    return pipeCandidate.split("|")[0].trim().slice(0, 120);
  }

  const uppercaseCandidate = [...serviceLines]
    .reverse()
    .find((line) => isMostlyUppercaseHeading(line) && isCatalogueTitleCandidate(line));
  if (uppercaseCandidate) {
    return uppercaseCandidate.slice(0, 120);
  }

  const candidate = serviceLines.find(
    (line) =>
      isCatalogueTitleCandidate(line) &&
      !looksMostlyEnglish(line) &&
      !isCatalogueDescriptionLine(line)
  );

  return (candidate || serviceLines.find(isCatalogueTitleCandidate) || serviceLines[0]).slice(
    0,
    120
  );
}

function isCatalogueTitleCandidate(line: string): boolean {
  return (
    line.length <= 90 &&
    !/[→]/.test(line) &&
    !/^(Free|Technical Director)/i.test(line)
  );
}

function isCatalogueDescriptionLine(line: string): boolean {
  return / \+ |^\d+\s*bước|^Dành cho|^Để đạt|^Cấp độ/i.test(
    line
  );
}

function isMostlyUppercaseHeading(line: string): boolean {
  const letters = line.match(/[A-Za-zÀ-ỹ]/g) || [];
  if (letters.length < 3) return false;
  const uppercase = letters.filter((char) => char === char.toUpperCase()).length;
  return uppercase / letters.length >= 0.75;
}

function looksMostlyEnglish(line: string): boolean {
  const latinWords = line.match(/[A-Za-z]+/g) || [];
  const vietnameseChars = line.match(/[À-ỹ]/g) || [];
  return latinWords.length > 0 && vietnameseChars.length === 0;
}

function formatPriceLines(prices: string[], descriptorLines: string[]): string {
  if (prices.length === 4 && descriptorLines.some((line) => /^S$/i.test(line))) {
    return `Giá Size S: ${prices[0]}\nGiá Size M: ${prices[1]}\nGiá Size L: ${prices[2]}\nGiá Size XL: ${prices[3]}`;
  }

  return prices.length === 1 ? `Giá: ${prices[0]}` : `Giá: ${prices.join(" | ")}`;
}

function isCatalogueNoise(line: string): boolean {
  return (
    isCatalogueHeaderOnly(line) ||
    /^IT'S NEVER TOO EXPENSIVE/i.test(line) ||
    /^\(?Giá đã bao gồm VAT\)?$/i.test(line)
  );
}

function isCatalogueHeaderOnly(line: string): boolean {
  return /^(S|M|L|XL|ON TOP)$/i.test(
    line
  );
}

function isLongCatalogueNote(line: string): boolean {
  return line.length >= 70 || /^(Miễn phí|Free|Giá|Phù hợp|Tùy|Quy trình|Mô tả)/i.test(line);
}

export function splitTextIntoSections(
  baseTitle: string,
  text: string,
  options: ChunkOptions = {}
): ImportedKnowledgeSection[] {
  const maxChars = options.maxChars ?? DEFAULT_KNOWLEDGE_CHUNK_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_KNOWLEDGE_CHUNK_OVERLAP_CHARS;
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
  let overlapText = "";
  let hasNewContent = false;

  const flush = (preserveOverlap = true) => {
    if (!hasNewContent) {
      currentParagraphs = [];
      overlapText = "";
      return;
    }

    const content = normalizeText(currentParagraphs.join("\n\n"));
    if (!content) return;

    const sectionTitle =
      sections.some((section) => section.title === currentTitle) || !currentTitle
        ? `${baseTitle} - Phần ${partNumber}`
        : currentTitle;

    sections.push({ title: sectionTitle, content });
    overlapText = preserveOverlap ? getOverlapText(content, overlapChars) : "";
    currentParagraphs = overlapText ? [overlapText] : [];
    hasNewContent = false;
    currentTitle = `${baseTitle} - Phần ${partNumber + 1}`;
    partNumber += 1;
  };

  for (let index = 0; index < paragraphs.length; index += 1) {
    const paragraph = paragraphs[index];
    const paragraphChunks =
      paragraph.length > maxChars
        ? splitLongParagraph(paragraph, maxChars, overlapChars)
        : [paragraph];

    if (
      paragraphChunks.length === 1 &&
      looksLikeHeading(paragraph) &&
      index < paragraphs.length - 1
    ) {
      if (currentParagraphs.length > 0) {
        flush(false);
      }
      currentTitle = sanitizeHeading(paragraph, baseTitle, partNumber);
      continue;
    }

    for (const paragraphChunk of paragraphChunks) {
      const currentLength = currentParagraphs.join("\n\n").length;
      const projectedLength = currentLength + paragraphChunk.length + (currentLength > 0 ? 2 : 0);
      if (currentParagraphs.length > 0 && projectedLength > maxChars) {
        flush();
      }

      currentParagraphs.push(paragraphChunk);
      hasNewContent = true;
    }
  }

  if (currentParagraphs.length > 0) {
    flush();
  }

  if (sections.length > 0) {
    return sections;
  }

  return [{ title: baseTitle, content: text }];
}

function splitLongParagraph(text: string, maxChars: number, overlapChars: number): string[] {
  const sentences = text
    .match(/[^.!?。！？]+[.!?。！？]?/g)
    ?.map((sentence) => sentence.trim())
    .filter(Boolean) || [text];
  const chunks: string[] = [];
  let current = "";

  const pushCurrent = () => {
    const normalized = normalizeText(current);
    if (!normalized) return;
    chunks.push(normalized);
    current = getOverlapText(normalized, overlapChars);
  };

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current) pushCurrent();
      for (let start = 0; start < sentence.length; start += maxChars - overlapChars) {
        chunks.push(sentence.slice(start, start + maxChars).trim());
      }
      current = "";
      continue;
    }

    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length > maxChars) {
      pushCurrent();
      current = current ? `${current} ${sentence}` : sentence;
    } else {
      current = next;
    }
  }

  if (current) pushCurrent();

  return chunks.filter(Boolean);
}

function getOverlapText(text: string, overlapChars: number): string {
  if (overlapChars <= 0 || text.length <= overlapChars) return "";

  const tail = text.slice(-overlapChars);
  const wordBoundary = tail.search(/\s\S+$/);
  return (wordBoundary > 0 ? tail.slice(wordBoundary).trim() : tail.trim()).slice(0, overlapChars);
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
