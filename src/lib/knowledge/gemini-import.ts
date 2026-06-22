import { DOMParser } from "@xmldom/xmldom";
import JSZip from "jszip";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import * as XLSX from "xlsx";
import {
  DEFAULT_GEMINI_DOCUMENT_MODEL,
  getGeminiDocumentModelFallbackChain,
} from "@/lib/ai/catalog";
import {
  generateGeminiDocumentJson,
  shouldFallbackGeminiModel,
  shouldStopGeminiFallback,
} from "@/lib/ai/provider";
import type { ImportedKnowledgeDocument, ImportedKnowledgeSection } from "./import";

const MAX_GEMINI_TEXT_CONTEXT_CHARS = 45000;
const MAX_GEMINI_IMPORTED_SECTIONS = 200;
const MAX_DOCX_INLINE_IMAGES = 8;
const MAX_DOCX_INLINE_IMAGE_BYTES = 1_500_000;

const GEMINI_SUPPORTED_IMAGE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const GEMINI_KNOWLEDGE_TYPES = [
  "price",
  "faq",
  "policy",
  "warranty",
  "return_policy",
  "delivery_policy",
  "vat_invoice",
  "process",
  "service",
  "product",
  "product_category",
  "technical",
  "inventory",
  "promotion",
  "membership",
  "channel_accounts",
  "contact",
  "hours",
  "intro",
  "note",
] as const;

type GeminiKnowledgeType = (typeof GEMINI_KNOWLEDGE_TYPES)[number];

const GEMINI_DOCUMENT_KINDS = [
  "business_profile",
  "product_catalogue",
  "price_list",
  "inventory",
  "warranty_policy",
  "return_policy",
  "vat_invoice",
  "delivery_policy",
  "technical_guide",
  "customer_segments",
  "channel_accounts",
  "sales_script",
  "faq",
  "mixed",
  "unknown",
] as const;

type GeminiDocumentKind = (typeof GEMINI_DOCUMENT_KINDS)[number];

type GeminiContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };

interface GeminiContext {
  text: string;
  parts: GeminiContentPart[];
  warnings: string[];
  validationText?: string;
}

interface DocxImagePart {
  path: string;
  mimeType: string;
  data: string;
}

interface DocxParagraph {
  text: string;
  styleId: string;
  imageRefs: string[];
}

interface PriceValidationResult {
  sourcePriceCount: number;
  outputPriceCount: number;
  missingPrices: string[];
  missingPriceCount: number;
}

interface GeminiKnowledgeChunk {
  title?: unknown;
  content?: unknown;
  type?: unknown;
  confidence?: unknown;
  sourcePage?: unknown;
  notes?: unknown;
}

interface GeminiKnowledgeResponse {
  chunks?: GeminiKnowledgeChunk[];
  warnings?: unknown[];
  summary?: unknown;
  documentKind?: unknown;
  extractionNotes?: unknown;
}

export async function importKnowledgeDocumentWithGemini(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  apiKey: string
): Promise<ImportedKnowledgeDocument> {
  const extension = getFileExtension(fileName);
  const warnings: string[] = [];
  const parts: GeminiContentPart[] = [];
  const fileMimeType = normalizeMimeType(extension, mimeType);
  let validationText = "";

  if (fileMimeType === "application/pdf" || GEMINI_SUPPORTED_IMAGE_MIME_TYPES.has(fileMimeType)) {
    parts.push({
      inlineData: {
        mimeType: fileMimeType,
        data: buffer.toString("base64"),
      },
    });
  } else {
    const context = await extractGeminiContext(fileName, extension, mimeType, buffer);
    if (!context.text.trim() && context.parts.length === 0) {
      throw new Error("Không trích xuất được nội dung để Gemini đọc file này.");
    }

    warnings.push(...context.warnings);
    validationText = context.validationText || context.text;
    if (context.text.trim()) {
      parts.push({ text: context.text.slice(0, MAX_GEMINI_TEXT_CONTEXT_CHARS) });
    }
    parts.push(...context.parts);
  }

  const prompt = buildGeminiKnowledgePrompt(fileName, fileMimeType);
  const { jsonText, model } = await generateKnowledgeJson(prompt, apiKey, parts, warnings);

  const parsed = parseGeminiResponse(jsonText);
  const documentKind = normalizeGeminiDocumentKind(parsed.documentKind, fileName);
  if (parsed.extractionNotes) {
    warnings.push(`Ghi chú nhận diện tài liệu: ${String(parsed.extractionNotes).trim()}`);
  }
  let sections = normalizeGeminiChunks(parsed.chunks || [], fileName, model, documentKind);

  if (sections.length === 0) {
    throw new Error("Gemini không tạo được chunk kiến thức hợp lệ từ file này.");
  }

  if (sections.length > MAX_GEMINI_IMPORTED_SECTIONS) {
    warnings.push(
      `Gemini tạo hơn ${MAX_GEMINI_IMPORTED_SECTIONS} mục. Chỉ lấy ${MAX_GEMINI_IMPORTED_SECTIONS} mục đầu tiên.`
    );
  }

  const geminiWarnings = (parsed.warnings || [])
    .map((warning) => String(warning || "").trim())
    .filter(Boolean);

  sections = flagSuspiciousPriceMentions(sections, warnings);

  const priceValidation = validatePriceCoverage(validationText, sections);
  if (priceValidation.missingPriceCount > 0) {
    warnings.push(formatPriceValidationWarning(priceValidation));
    sections = downgradeSectionsForPriceReview(sections, priceValidation);
  }

  return {
    detectedType: `${extension || "file"}-gemini`,
    warnings: [...warnings, ...geminiWarnings],
    sections: sections.slice(0, MAX_GEMINI_IMPORTED_SECTIONS),
  };
}

function buildGeminiKnowledgePrompt(fileName: string, mimeType: string): string {
  return [
    "Bạn là bộ chuyển đổi tài liệu doanh nghiệp thành Knowledge Base cho chatbot CSKH/tư vấn sản phẩm.",
    "Hãy đọc tài liệu theo bố cục thị giác nếu có: bảng, tiêu đề, cột giá, ghi chú, FAQ, chính sách, thông số kỹ thuật, catalogue, hình ảnh có chữ.",
    "Nếu input là DOCX structured extract, hãy ưu tiên các bảng markdown [TABLE n], heading và marker ảnh [IMAGE n] để khôi phục ngữ cảnh.",
    "Mục tiêu là tạo các chunk độc lập, đúng ngữ cảnh, dễ dùng cho RAG.",
    "Trước khi tách chunk, hãy nhận diện loại tài liệu tổng thể bằng documentKind để hệ thống gợi ý danh mục Knowledge Base phù hợp.",
    "documentKind hợp lệ: business_profile, product_catalogue, price_list, inventory, warranty_policy, return_policy, vat_invoice, delivery_policy, technical_guide, customer_segments, channel_accounts, sales_script, faq, mixed, unknown.",
    "Chiến lược đọc theo loại tài liệu:",
    "- price_list: giữ từng dòng sản phẩm/quy cách/đơn vị/cột giá lẻ/giá công trình/giá cửa hàng hoặc đại lý, không tự suy giá.",
    "- inventory: giữ mã hàng, tên hàng, tồn kho, tình trạng còn/hết, sản phẩm thay thế nếu có.",
    "- warranty_policy, return_policy, delivery_policy, vat_invoice: giữ điều kiện áp dụng, ngoại lệ, thông tin cần khách cung cấp và quy trình xử lý.",
    "- product_catalogue, technical_guide: giữ tên sản phẩm, mã, điện áp, công suất, kích thước, chống nước, môi trường dùng, ảnh/chữ trên ảnh nếu đọc được.",
    "- customer_segments: giữ cách phân loại khách lẻ/khách công trình/cửa hàng/đại lý và dữ kiện cần hỏi trước khi báo giá.",
    "- channel_accounts: giữ rõ nền tảng, tên tài khoản, link/số điện thoại/ID, trạng thái xác minh nếu có.",
    "Quy tắc:",
    "- Mỗi sản phẩm/nhóm sản phẩm/bảng giá/FAQ/chính sách/thông số kỹ thuật nên là một chunk riêng.",
    "- Không tạo chunk chỉ có giá mà thiếu tên sản phẩm, mã sản phẩm hoặc nhóm sản phẩm.",
    "- Với bảng giá, giữ rõ tên sản phẩm, mã sản phẩm nếu có, quy cách, điện áp, công suất, đơn vị tính, cột giá và giá tương ứng.",
    "- Không được bỏ sót giá trong bảng nguồn. Nếu có số giá ở source, phải đưa vào content đúng sản phẩm/quy cách/cột hoặc cảnh báo rõ trong warnings.",
    "- Giữ nguyên giá/range/đơn vị như source, ví dụ 900K, 1.300K, 900.000/lần, 100.000 – 150.000.",
    "- Nếu bảng có ô gộp hoặc header nhiều dòng, hãy diễn giải cột thành nhãn rõ ràng thay vì đẩy lệch giá sang cột khác.",
    "- Nếu có nhiều bảng liên quan, giữ tên nhóm lớn trong content.",
    "- Bỏ qua slogan/trang trí lặp lại nếu không giúp trả lời khách.",
    "- Không bịa dữ liệu không có trong file.",
    "- Viết tiếng Việt tự nhiên, giữ thuật ngữ sản phẩm/kỹ thuật/tiếng Anh cần thiết.",
    "- Gán type đúng bản chất nội dung: price cho bảng giá, inventory cho tồn kho, product cho sản phẩm, product_category cho nhóm sản phẩm, faq cho hỏi đáp, policy/warranty/return_policy/delivery_policy/vat_invoice cho chính sách liên quan, technical cho thông số/tư vấn kỹ thuật, promotion cho ưu đãi, channel_accounts cho tài khoản kênh bán hàng, contact/hours cho liên hệ/thời gian, intro cho giới thiệu.",
    "- confidence từ 0 đến 1, thấp hơn nếu bảng bị mờ/khó đọc/không chắc.",
    "Chỉ trả JSON hợp lệ, không markdown.",
    "Schema:",
    '{ "documentKind": "business_profile|product_catalogue|price_list|inventory|warranty_policy|return_policy|vat_invoice|delivery_policy|technical_guide|customer_segments|channel_accounts|sales_script|faq|mixed|unknown", "extractionNotes": "string optional", "chunks": [ { "title": "string", "content": "string", "type": "price|faq|policy|warranty|return_policy|delivery_policy|vat_invoice|process|service|product|product_category|technical|inventory|promotion|membership|channel_accounts|contact|hours|intro|note", "confidence": 0.0, "sourcePage": 1, "notes": "string optional" } ], "warnings": ["string"] }',
    `Tên file: ${fileName}`,
    `MIME type: ${mimeType}`,
  ].join("\n");
}

function parseGeminiResponse(jsonText: string): GeminiKnowledgeResponse {
  const cleaned = jsonText
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(cleaned) as GeminiKnowledgeResponse;
  } catch {
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");
    if (jsonStart >= 0 && jsonEnd > jsonStart) {
      return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1)) as GeminiKnowledgeResponse;
    }
    throw new Error("Gemini trả về JSON không hợp lệ.");
  }
}

async function generateKnowledgeJson(
  prompt: string,
  apiKey: string,
  parts: GeminiContentPart[],
  warnings: string[]
): Promise<{ jsonText: string; model: string }> {
  const modelChain = getGeminiDocumentModelFallbackChain(DEFAULT_GEMINI_DOCUMENT_MODEL);
  let lastError: unknown;

  for (const [index, model] of modelChain.entries()) {
    try {
      const jsonText = await generateGeminiDocumentJson(prompt, apiKey, parts, model);
      if (index > 0) {
        warnings.push(
          `Model ${modelChain[0]} không dùng được cho lần đọc này, đã thử lại thành công bằng ${model}.`
        );
      }
      return { jsonText, model };
    } catch (error) {
      lastError = error;
      if (shouldStopGeminiFallback(error) || !shouldFallbackGeminiModel(error)) {
        throw error;
      }

      const nextModel = modelChain[index + 1];
      if (nextModel) {
        warnings.push(
          `Model ${model} không dùng được cho lần đọc này (${errorMessage(error)}), thử tiếp ${nextModel}.`
        );
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Tất cả Gemini document import fallback models đều thất bại.");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function normalizeGeminiChunks(
  chunks: GeminiKnowledgeChunk[],
  fileName: string,
  model: string,
  documentKind: GeminiDocumentKind
): ImportedKnowledgeSection[] {
  return chunks.flatMap((chunk, index) => {
    const title = String(chunk.title || `${fileName} - Mục ${index + 1}`).trim();
    const content = String(chunk.content || "").trim();
    if (!title || !content) return [];

    const confidence = Number(chunk.confidence);
    const sourcePage = Number(chunk.sourcePage);
    const type = normalizeGeminiType(chunk.type, title, content);

    const section: ImportedKnowledgeSection = {
      title: title.slice(0, 500),
      content,
      metadata: {
        sourceFormat: "gemini-document",
        parserConfidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.8,
        geminiType: type,
        documentKind,
        geminiModel: model,
        ...(Number.isFinite(sourcePage) && sourcePage > 0 ? { sourcePage } : {}),
        ...(chunk.notes ? { geminiNotes: String(chunk.notes) } : {}),
      },
    };

    return [section];
  });
}

function normalizeGeminiDocumentKind(rawKind: unknown, fileName: string): GeminiDocumentKind {
  const raw = normalizeKeyword(typeof rawKind === "string" ? rawKind : "").replace(/\s+/g, "_");
  const directKind = GEMINI_DOCUMENT_KINDS.find((kind) => kind === raw);
  if (directKind) return directKind;

  const fileHint = normalizeKeyword(fileName);
  if (/bang gia|bao gia|price|gia/.test(fileHint)) return "price_list";
  if (/ton kho|inventory|stock|hang ton/.test(fileHint)) return "inventory";
  if (/bao hanh|warranty/.test(fileHint)) return "warranty_policy";
  if (/doi tra|return|refund/.test(fileHint)) return "return_policy";
  if (/vat|hoa don|invoice|mst/.test(fileHint)) return "vat_invoice";
  if (/catalogue|catalog|san pham|product/.test(fileHint)) return "product_catalogue";
  if (/ky thuat|technical|thong so|lap dat/.test(fileHint)) return "technical_guide";
  if (/facebook|zalo|shopee|channel|kenh/.test(fileHint)) return "channel_accounts";

  return "unknown";
}

function normalizeGeminiType(
  rawType: unknown,
  title: string,
  content: string
): GeminiKnowledgeType {
  const raw = normalizeKeyword(typeof rawType === "string" ? rawType : "").replace(/\s+/g, "_");
  const directType = GEMINI_KNOWLEDGE_TYPES.find((type) => type === raw);
  if (directType) return directType;

  const aliases: Record<string, GeminiKnowledgeType> = {
    pricing: "price",
    prices: "price",
    banggia: "price",
    "bang-gia": "price",
    question: "faq",
    qa: "faq",
    qna: "faq",
    guarantee: "warranty",
    warranty_policy: "warranty",
    vat: "vat_invoice",
    invoice: "vat_invoice",
    return: "return_policy",
    delivery: "delivery_policy",
    procedure: "process",
    workflow: "process",
    package: "service",
    products: "product",
    category: "product_category",
    product_categories: "product_category",
    stock: "inventory",
    warehouse: "inventory",
    promo: "promotion",
    voucher: "promotion",
    member: "membership",
    vip: "membership",
    channels: "channel_accounts",
    social: "channel_accounts",
    address: "contact",
    opening_hours: "hours",
    duration: "hours",
    introduction: "intro",
  };
  if (aliases[raw]) return aliases[raw];

  const haystack = normalizeKeyword(`${title}\n${content}`);

  if (/\b(faq|q&a|q:|a:)\b|cau hoi|tra loi/.test(haystack)) return "faq";
  if (/vat|hoa don|xuat hoa don|ma so thue|mst/.test(haystack)) return "vat_invoice";
  if (/ton kho|con hang|het hang|hang thay the|san pham thay the/.test(haystack)) {
    return "inventory";
  }
  if (/bao hanh|chinh sach|cam ket|khong ap dung|dieu kien|bao ro/.test(haystack)) {
    return haystack.includes("bao hanh") ? "warranty" : "policy";
  }
  if (/doi tra|tra hang|doi hang|hoan tien/.test(haystack)) return "return_policy";
  if (/giao hang|van chuyen|nhan hang|kiem hang/.test(haystack)) return "delivery_policy";
  if (/quy trinh|cac buoc|buoc \d|process|ritual/.test(haystack)) return "process";
  if (/hotline|dia chi|lien he|dat lich|website|social|facebook|instagram|tiktok/.test(haystack)) {
    return "contact";
  }
  if (/thoi gian|duration|phut|gio|hour/.test(haystack) && !hasPriceTokens(content)) {
    return "hours";
  }
  if (
    /the vip|the dich vu|membership|silver card|yellow card|platinum card|diamond card/.test(
      haystack
    )
  ) {
    return "membership";
  }
  if (/voucher|uu dai|khuyen mai|giam gia|tang \d|gift/.test(haystack)) return "promotion";
  if (/bang gia|gia dich vu|price|gia:|vnd|vnđ/.test(haystack) || hasPriceTokens(content)) {
    return "price";
  }
  if (/thong so|ky thuat|dien ap|cong suat|lap dat|chong nuoc|ip65|ip67/.test(haystack)) {
    return "technical";
  }
  if (/san pham|product|den led|led day|module|adapter|nguon|phu kien|linh kien/.test(haystack)) {
    return "product";
  }
  if (/facebook|zalo|shopee|lazada|kenh ban|fanpage|social/.test(haystack)) {
    return "channel_accounts";
  }
  if (/gioi thieu|cam on|thuong hieu|dong hanh|hanh trinh/.test(haystack)) return "intro";
  if (/tu van|ky thuat|dien ap|cong suat|lap dat|bao gia/.test(haystack)) {
    return "service";
  }

  return "note";
}

function normalizeKeyword(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9&:+/ -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function validatePriceCoverage(
  sourceText: string,
  sections: ImportedKnowledgeSection[]
): PriceValidationResult {
  const sourcePrices = countNormalizedPrices(sourceText);
  const outputPrices = countNormalizedPrices(sections.map((section) => section.content).join("\n"));
  const missingPrices: string[] = [];
  let missingPriceCount = 0;

  for (const [price, sourceCount] of sourcePrices.entries()) {
    const outputCount = outputPrices.get(price) || 0;
    if (outputCount >= sourceCount) continue;

    missingPrices.push(price);
    missingPriceCount += sourceCount - outputCount;
  }

  return {
    sourcePriceCount: [...sourcePrices.values()].reduce((total, count) => total + count, 0),
    outputPriceCount: [...outputPrices.values()].reduce((total, count) => total + count, 0),
    missingPrices,
    missingPriceCount,
  };
}

function countNormalizedPrices(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of extractPriceTokens(text)) {
    const normalized = normalizePriceToken(token);
    if (!normalized) continue;
    counts.set(normalized, (counts.get(normalized) || 0) + 1);
  }

  return counts;
}

function extractPriceTokens(text: string): string[] {
  const priceToken =
    "(?:\\+?\\s*)?(?:\\d{1,3}(?:[.,]\\d{3})+\\s*(?:đ|d|vnd)?|\\d+(?:[.,]\\d+)?\\s*(?:k|đ|d|vnd|tr|triệu|million|m))";
  return (
    text.match(
      new RegExp(
        `(?:từ|from)?\\s*${priceToken}(?:\\s*[-–]\\s*${priceToken})?(?:\\s*\\+)?(?:\\s*\\/\\s*(?:lần|lan|chùm|chum|tép|tep))?`,
        "giu"
      )
    ) || []
  );
}

function normalizePriceToken(token: string): string {
  let normalized = token
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/đồng/g, "đ")
    .replace(/vnđ/g, "vnd")
    .replace(/vnd\*/g, "vnd")
    .replace(/\/lan/g, "/lần")
    .replace(/\/chum/g, "/chùm")
    .replace(/\/tep/g, "/tép")
    .trim();

  normalized = normalized.replace(/\bfrom/g, "từ").replace(/^\+/, "");
  normalized = normalized.replace(/(\d+(?:[.,]\d+)?)k\b/g, (_, value: string) => {
    const numberValue = Number(value.replace(",", "."));
    if (!Number.isFinite(numberValue)) return `${value}k`;
    return `${Math.round(numberValue * 1000)}`;
  });
  normalized = normalized.replace(
    /(\d+(?:[.,]\d+)?)(?:tr|triệu|million|m)\b/g,
    (_, value: string) => {
      const numberValue = Number(value.replace(",", "."));
      if (!Number.isFinite(numberValue)) return value;
      return `${Math.round(numberValue * 1_000_000)}`;
    }
  );
  normalized = normalized.replace(/[.,](?=\d{3}\b)/g, "");
  normalized = normalized.replace(/(?:đ|d|vnd)$/g, "");

  return normalized;
}

function formatPriceValidationWarning(validation: PriceValidationResult): string {
  const examples = validation.missingPrices.slice(0, 12).join(", ");
  const suffix = validation.missingPrices.length > 12 ? ", ..." : "";
  return `Cảnh báo kiểm chứng giá: output thiếu ${validation.missingPriceCount}/${validation.sourcePriceCount} giá từ source. Chỉ các mục có giá/ưu đãi/thẻ sẽ bị đánh dấu cần kiểm tra. Giá thiếu: ${examples}${suffix}`;
}

function flagSuspiciousPriceMentions(
  sections: ImportedKnowledgeSection[],
  warnings: string[]
): ImportedKnowledgeSection[] {
  const suspiciousSections = new Map<number, string[]>();

  sections.forEach((section, index) => {
    const suspiciousPrices = findSuspiciousLowVndPrices(section.content);
    if (suspiciousPrices.length > 0) {
      suspiciousSections.set(index, suspiciousPrices);
    }
  });

  if (suspiciousSections.size === 0) return sections;

  const examples = [...suspiciousSections.values()].flat().slice(0, 8).join(", ");
  warnings.push(
    `Cảnh báo giá đáng nghi: phát hiện giá VNĐ quá thấp (${examples}). Có thể Gemini/OCR đọc thiếu K hoặc thiếu số 0, nên kiểm tra các mục được đánh dấu.`
  );

  return sections.map((section, index) => {
    const suspiciousPrices = suspiciousSections.get(index);
    if (!suspiciousPrices) return section;

    const metadata = section.metadata || {};
    const currentConfidence =
      typeof metadata.parserConfidence === "number" ? metadata.parserConfidence : 0.8;
    const currentReasons = Array.isArray(metadata.reviewReasons)
      ? metadata.reviewReasons.filter((reason): reason is string => typeof reason === "string")
      : [];

    return {
      ...section,
      metadata: {
        ...metadata,
        parserConfidence: Math.min(currentConfidence, 0.65),
        requiresReview: true,
        reviewLabel: "Giá đáng nghi",
        reviewReasons: [...new Set([...currentReasons, "suspicious-low-vnd-price"])],
        suspiciousPrices,
      },
    };
  });
}

function findSuspiciousLowVndPrices(text: string): string[] {
  const matches = text.matchAll(
    /(?:^|[^\d])((?:từ\s*)?\d{1,3}\s*(?:vnđ|vnd|đ)\*?)(?=\s|$|[.,;:)])/giu
  );
  const suspicious = new Set<string>();

  for (const match of matches) {
    const value = match[1].trim();
    const number = Number(value.replace(/[^\d]/g, ""));
    if (Number.isFinite(number) && number > 0 && number < 10_000) {
      suspicious.add(value);
    }
  }

  return [...suspicious];
}

function downgradeSectionsForPriceReview(
  sections: ImportedKnowledgeSection[],
  validation: PriceValidationResult
): ImportedKnowledgeSection[] {
  if (validation.sourcePriceCount === 0) return sections;
  const missingRatio = validation.missingPriceCount / validation.sourcePriceCount;
  const maxConfidence = missingRatio >= 0.15 ? 0.55 : 0.7;

  return sections.map((section) => {
    if (!isPriceReviewCandidate(section)) {
      return section;
    }

    const metadata = section.metadata || {};
    const currentConfidence =
      typeof metadata.parserConfidence === "number" ? metadata.parserConfidence : 0.8;
    const currentReasons = Array.isArray(metadata.reviewReasons)
      ? metadata.reviewReasons.filter((reason): reason is string => typeof reason === "string")
      : [];

    return {
      ...section,
      metadata: {
        ...metadata,
        parserConfidence: Math.min(currentConfidence, maxConfidence),
        requiresReview: true,
        reviewLabel:
          typeof metadata.reviewLabel === "string" ? metadata.reviewLabel : "Cần kiểm tra giá",
        reviewReasons: [...new Set([...currentReasons, "missing-source-prices"])],
        priceValidation: {
          sourcePriceCount: validation.sourcePriceCount,
          outputPriceCount: validation.outputPriceCount,
          missingPriceCount: validation.missingPriceCount,
          missingPrices: validation.missingPrices.slice(0, 30),
        },
      },
    };
  });
}

function isPriceReviewCandidate(section: ImportedKnowledgeSection): boolean {
  const metadata = section.metadata || {};
  const type =
    typeof metadata.geminiType === "string"
      ? (metadata.geminiType as GeminiKnowledgeType)
      : normalizeGeminiType("", section.title, section.content);
  const hasSectionPrice = hasPriceTokens(`${section.title}\n${section.content}`);

  if (type === "price" || type === "promotion" || type === "membership") {
    return hasSectionPrice;
  }

  if (["faq", "policy", "warranty", "process", "contact", "hours", "intro"].includes(type)) {
    return false;
  }

  if (!hasSectionPrice) {
    return false;
  }

  const haystack = normalizeKeyword(`${section.title}\n${section.content}`);
  return /gia|vnd|vnđ|price|uu dai|voucher|bill|combo|bao gia|san pham|product/.test(
    haystack
  );
}

function hasPriceTokens(text: string): boolean {
  return extractPriceTokens(text).length > 0;
}

async function extractTextContext(
  fileName: string,
  extension: string,
  mimeType: string,
  buffer: Buffer
): Promise<string> {
  switch (extension) {
    case "docx": {
      const [htmlResult, textResult] = await Promise.all([
        mammoth.convertToHtml({ buffer }),
        mammoth.extractRawText({ buffer }),
      ]);
      return [
        `DOCX HTML từ ${fileName}:`,
        htmlResult.value,
        `DOCX raw text từ ${fileName}:`,
        textResult.value,
      ].join("\n\n");
    }
    case "doc": {
      const extractor = new WordExtractor();
      const document = await extractor.extract(buffer);
      return document.getBody();
    }
    case "xls":
    case "xlsx":
    case "csv":
      return extractWorkbookText(extension, mimeType, buffer);
    case "txt":
    case "md":
      return buffer.toString("utf8");
    default:
      return "";
  }
}

async function extractGeminiContext(
  fileName: string,
  extension: string,
  mimeType: string,
  buffer: Buffer
): Promise<GeminiContext> {
  if (extension === "docx") {
    return extractDocxStructuredContext(fileName, buffer);
  }

  const text = await extractTextContext(fileName, extension, mimeType, buffer);
  return {
    text,
    parts: [],
    warnings: [
      "Gemini đang đọc nội dung text trích xuất từ file. Với tài liệu nhiều layout hoặc ảnh, PDF/ảnh vẫn cho kết quả tốt hơn.",
    ],
  };
}

async function extractDocxStructuredContext(
  fileName: string,
  buffer: Buffer
): Promise<GeminiContext> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const documentXml = await zip.file("word/document.xml")?.async("text");
    if (!documentXml) {
      throw new Error("DOCX missing word/document.xml");
    }

    const relationships = await readDocxRelationships(zip);
    const document = new DOMParser().parseFromString(documentXml, "application/xml");
    const body = firstDescendantElement(document, "body");
    if (!body) {
      throw new Error("DOCX missing document body");
    }

    const imageParts = new Map<string, DocxImagePart>();
    const lines = [
      `DOCX structured extract từ ${fileName}.`,
      "Ghi chú: bảng Word được giữ theo dạng markdown table; ảnh trong DOCX được đính kèm sau phần text bằng marker [IMAGE n].",
      "",
    ];
    let tableIndex = 1;

    for (const child of childElements(body)) {
      if (localName(child) === "p") {
        const paragraph = parseDocxParagraph(child, relationships, zip, imageParts);
        if (!paragraph.text && paragraph.imageRefs.length === 0) continue;

        if (paragraph.text) {
          if (isDocxHeading(paragraph)) {
            lines.push("", `## ${paragraph.text}`);
          } else if (isDocxListParagraph(paragraph)) {
            lines.push(`- ${paragraph.text}`);
          } else {
            lines.push(paragraph.text);
          }
        }

        for (const ref of paragraph.imageRefs) {
          lines.push(`[IMAGE ${ref}]`);
        }
        continue;
      }

      if (localName(child) === "tbl") {
        const table = serializeDocxTable(child, relationships, zip, imageParts, tableIndex);
        if (table) {
          lines.push("", table);
          tableIndex += 1;
        }
      }
    }

    await hydrateDocxImages(zip, imageParts);

    const imageEntries = [...imageParts.entries()];
    const acceptedImages = imageEntries
      .filter(
        ([, image]) =>
          GEMINI_SUPPORTED_IMAGE_MIME_TYPES.has(image.mimeType) &&
          Buffer.from(image.data, "base64").byteLength <= MAX_DOCX_INLINE_IMAGE_BYTES
      )
      .slice(0, MAX_DOCX_INLINE_IMAGES);
    const omittedImageCount = imageEntries.length - acceptedImages.length;
    const warnings = [
      "DOCX được đọc bằng OpenXML: giữ paragraph, heading, bảng/cell và gửi kèm ảnh nhỏ cho Gemini. Cách này không cần LibreOffice nhưng vẫn có thể kém PDF nếu Word dùng layout rất phức tạp.",
    ];

    if (omittedImageCount > 0) {
      warnings.push(
        `Bỏ qua ${omittedImageCount} ảnh DOCX do vượt giới hạn số lượng/kích thước để tránh request Gemini quá lớn.`
      );
    }

    return {
      text: lines.join("\n").trim(),
      parts: acceptedImages.map(([, image]) => ({
        inlineData: { mimeType: image.mimeType, data: image.data },
      })),
      warnings,
    };
  } catch {
    const [htmlResult, textResult] = await Promise.all([
      mammoth.convertToHtml({ buffer }),
      mammoth.extractRawText({ buffer }),
    ]);

    return {
      text: [
        `DOCX fallback HTML từ ${fileName}:`,
        htmlResult.value,
        `DOCX fallback raw text từ ${fileName}:`,
        textResult.value,
      ].join("\n\n"),
      parts: [],
      warnings: [
        "Không đọc được cấu trúc OpenXML của DOCX nên đã fallback sang mammoth HTML/raw text. Một số bố cục bảng/ảnh có thể bị mất.",
      ],
    };
  }
}

async function readDocxRelationships(zip: JSZip): Promise<Map<string, string>> {
  const relationshipXml = await zip.file("word/_rels/document.xml.rels")?.async("text");
  const relationships = new Map<string, string>();
  if (!relationshipXml) return relationships;

  const document = new DOMParser().parseFromString(relationshipXml, "application/xml");
  for (const relationship of descendantElements(document, "Relationship")) {
    const id = getAttribute(relationship, "Id");
    const target = getAttribute(relationship, "Target");
    if (!id || !target || /^https?:\/\//i.test(target)) continue;
    relationships.set(id, normalizeDocxPartPath("word", target));
  }

  return relationships;
}

function parseDocxParagraph(
  paragraph: Element,
  relationships: Map<string, string>,
  zip: JSZip,
  imageParts: Map<string, DocxImagePart>
): DocxParagraph {
  const style = firstDescendantElement(paragraph, "pStyle");
  const styleId = style ? getAttribute(style, "val") : "";
  const imageRefs = collectDocxImageRefs(paragraph, relationships, zip, imageParts);

  return {
    text: normalizeDocxText(readDocxText(paragraph)),
    styleId,
    imageRefs,
  };
}

function serializeDocxTable(
  table: Element,
  relationships: Map<string, string>,
  zip: JSZip,
  imageParts: Map<string, DocxImagePart>,
  tableIndex: number
): string {
  const verticalMergeCarry = new Map<number, string>();
  const rows = childElements(table, "tr")
    .map((row) => {
      const values: string[] = [];
      let columnIndex = 0;

      for (const cell of childElements(row, "tc")) {
        const cellText = readDocxTableCellText(cell, relationships, zip, imageParts);
        const columnSpan = getDocxGridSpan(cell);
        const verticalMerge = getDocxVerticalMerge(cell);

        for (let spanIndex = 0; spanIndex < columnSpan; spanIndex += 1) {
          values[columnIndex + spanIndex] = cellText;
        }

        if (verticalMerge === "restart") {
          for (let spanIndex = 0; spanIndex < columnSpan; spanIndex += 1) {
            verticalMergeCarry.set(columnIndex + spanIndex, cellText);
          }
        } else if (verticalMerge === "continue") {
          for (let spanIndex = 0; spanIndex < columnSpan; spanIndex += 1) {
            values[columnIndex + spanIndex] =
              verticalMergeCarry.get(columnIndex + spanIndex) || cellText;
          }
        } else {
          for (let spanIndex = 0; spanIndex < columnSpan; spanIndex += 1) {
            verticalMergeCarry.delete(columnIndex + spanIndex);
          }
        }

        columnIndex += columnSpan;
      }

      return values;
    })
    .filter((row) => row.some(Boolean));

  if (rows.length === 0) return "";

  const width = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) =>
    Array.from({ length: width }, (_, index) => escapeMarkdownCell(row[index] || ""))
  );
  const header = normalizedRows[0];
  const separator = Array.from({ length: width }, () => "---");
  const bodyRows = normalizedRows.slice(1);

  return [
    `[TABLE ${tableIndex}]`,
    `Columns: ${width}`,
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...bodyRows.map((row) => `| ${row.join(" | ")} |`),
    `[END TABLE ${tableIndex}]`,
  ].join("\n");
}

function readDocxTableCellText(
  cell: Element,
  relationships: Map<string, string>,
  zip: JSZip,
  imageParts: Map<string, DocxImagePart>
): string {
  const cellImages = collectDocxImageRefs(cell, relationships, zip, imageParts);
  const nestedTables = childElements(cell, "tbl").map((table, index) =>
    serializeDocxTable(table, relationships, zip, imageParts, index + 1)
  );
  const cellParagraphs = childElements(cell, "p")
    .map((paragraph) => normalizeDocxText(readDocxText(paragraph)))
    .filter(Boolean);
  const imageMarkers = cellImages.map((ref) => `[IMAGE ${ref}]`);

  return [...cellParagraphs, ...nestedTables, ...imageMarkers].join(" / ");
}

function getDocxGridSpan(cell: Element): number {
  const gridSpan = firstDescendantElement(cell, "gridSpan");
  const value = gridSpan ? Number(getAttribute(gridSpan, "val")) : 1;
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : 1;
}

function getDocxVerticalMerge(cell: Element): "restart" | "continue" | "" {
  const verticalMerge = firstDescendantElement(cell, "vMerge");
  if (!verticalMerge) return "";
  const value = getAttribute(verticalMerge, "val");
  return value === "restart" ? "restart" : "continue";
}

function collectDocxImageRefs(
  node: Element,
  relationships: Map<string, string>,
  zip: JSZip,
  imageParts: Map<string, DocxImagePart>
): string[] {
  const refs: string[] = [];
  const imageIds = [
    ...descendantElements(node, "blip").map((element) => getAttribute(element, "embed")),
    ...descendantElements(node, "imagedata").map((element) => getAttribute(element, "id")),
  ].filter(Boolean);

  for (const relationshipId of imageIds) {
    const path = relationships.get(relationshipId);
    if (!path || imageParts.has(path)) {
      if (path) refs.push(String([...imageParts.keys()].indexOf(path) + 1));
      continue;
    }

    if (!zip.file(path)) continue;

    const imageNumber = imageParts.size + 1;
    refs.push(String(imageNumber));
    imageParts.set(path, {
      path,
      mimeType: mimeTypeFromPath(path),
      data: "",
    });
  }

  return refs;
}

async function hydrateDocxImages(zip: JSZip, imageParts: Map<string, DocxImagePart>) {
  await Promise.all(
    [...imageParts.entries()].map(async ([path, image]) => {
      const file = zip.file(path);
      if (!file) {
        imageParts.delete(path);
        return;
      }

      imageParts.set(path, {
        ...image,
        data: await file.async("base64"),
      });
    })
  );
}

function readDocxText(node: Element): string {
  const parts: string[] = [];

  const visit = (current: Node) => {
    if (current.nodeType === 1) {
      const element = current as Element;
      const name = localName(element);
      if (name === "t") {
        parts.push(element.textContent || "");
        return;
      }
      if (name === "tab") {
        parts.push(" ");
        return;
      }
      if (name === "br" || name === "cr") {
        parts.push("\n");
        return;
      }
    }

    for (const child of Array.from(current.childNodes || [])) {
      visit(child);
    }
  };

  visit(node);
  return parts.join("");
}

function normalizeDocxText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r/g, "")
    .replace(/[ \u00a0]+/g, " ")
    .replace(/\n[ \u00a0]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isDocxHeading(paragraph: DocxParagraph): boolean {
  return /heading|title|subtitle/i.test(paragraph.styleId) || isMostlyHeadingText(paragraph.text);
}

function isDocxListParagraph(paragraph: DocxParagraph): boolean {
  return Boolean(paragraph.text) && /^\s*(?:[-*•]|\d+[\).])\s+/.test(paragraph.text);
}

function isMostlyHeadingText(text: string): boolean {
  const cleaned = text.trim();
  if (!cleaned || cleaned.length > 140 || /[.!?]$/.test(cleaned)) return false;
  const letters = cleaned.match(/[A-Za-zÀ-ỹ]/g) || [];
  if (letters.length < 4) return false;
  const uppercase = letters.filter((char) => char === char.toUpperCase()).length;
  return uppercase / letters.length >= 0.65;
}

function firstDescendantElement(node: Node, name: string): Element | null {
  return descendantElements(node, name)[0] || null;
}

function descendantElements(node: Node, name?: string): Element[] {
  const elements: Element[] = [];
  const expected = name?.toLowerCase();

  const visit = (current: Node) => {
    if (current.nodeType === 1) {
      const element = current as Element;
      if (!expected || localName(element).toLowerCase() === expected) {
        elements.push(element);
      }
    }

    for (const child of Array.from(current.childNodes || [])) {
      visit(child);
    }
  };

  visit(node);
  return elements;
}

function childElements(node: Node, name?: string): Element[] {
  const expected = name?.toLowerCase();
  return Array.from(node.childNodes || []).filter((child): child is Element => {
    return (
      child.nodeType === 1 && (!expected || localName(child as Element).toLowerCase() === expected)
    );
  });
}

function localName(element: Element): string {
  return element.localName || element.nodeName.split(":").pop() || element.nodeName;
}

function getAttribute(element: Element, localAttributeName: string): string {
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index);
    if (!attribute) continue;
    const attributeLocalName =
      attribute.localName || attribute.name.split(":").pop() || attribute.name;
    if (attributeLocalName.toLowerCase() === localAttributeName.toLowerCase()) {
      return attribute.value;
    }
  }

  return "";
}

function normalizeDocxPartPath(baseDirectory: string, target: string): string {
  const parts = `${baseDirectory}/${target}`.split("/");
  const normalized: string[] = [];

  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      normalized.pop();
      continue;
    }
    normalized.push(part);
  }

  return normalized.join("/");
}

function escapeMarkdownCell(value: string): string {
  return normalizeDocxText(value).replace(/\|/g, "\\|");
}

function mimeTypeFromPath(path: string): string {
  const extension = getFileExtension(path);
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "bmp":
      return "image/bmp";
    default:
      return "application/octet-stream";
  }
}

function extractWorkbookText(extension: string, mimeType: string, buffer: Buffer): string {
  const workbook =
    extension === "csv" || mimeType === "text/csv"
      ? XLSX.read(buffer.toString("utf8"), { type: "string" })
      : XLSX.read(buffer, { type: "buffer" });

  return workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) return "";
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
      header: 1,
      raw: false,
      blankrows: false,
      defval: "",
    });
    const textRows = rows
      .map((row) =>
        row
          .map((cell) => String(cell ?? "").trim())
          .filter(Boolean)
          .join(" | ")
      )
      .filter(Boolean);
    return [`Sheet: ${sheetName}`, ...textRows].join("\n");
  })
    .filter(Boolean)
    .join("\n\n");
}

function normalizeMimeType(extension: string, mimeType: string): string {
  if (mimeType) return mimeType;
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    default:
      return "text/plain";
  }
}

function getFileExtension(fileName: string): string {
  const normalized = fileName.toLowerCase();
  const parts = normalized.split(".");
  return parts.length > 1 ? parts.at(-1) || "" : "";
}
