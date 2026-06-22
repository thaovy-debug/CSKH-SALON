import "dotenv/config";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { importKnowledgeDocumentWithGemini } from "../src/lib/knowledge/gemini-import";

type TestStatus = "pass" | "fail" | "review";

interface CliOptions {
  imageDir: string;
  markdownOutput: string;
  jsonOutput: string;
  limit?: number;
  timeoutMs: number;
  onlyFiles?: string[];
  retries: number;
  retryDelayMs: number;
}

interface ImageResult {
  fileName: string;
  fileSize: number;
  detectedType?: string;
  sectionCount: number;
  warningCount: number;
  status: TestStatus;
  flags: string[];
  notes: string[];
  durationMs: number;
  preview: string;
  sections: Array<{
    title: string;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
}

interface Report {
  runInfo: {
    imageDir: string;
    startedAt: string;
    finishedAt: string;
    total: number;
    passed: number;
    failed: number;
    review: number;
  };
  results: ImageResult[];
}

const DEFAULT_OPTIONS: CliOptions = {
  imageDir: "data/image",
  markdownOutput: "data/test-results/led1000-image-import-report.md",
  jsonOutput: "data/test-results/led1000-image-import-report.json",
  timeoutMs: 120000,
  retries: 1,
  retryDelayMs: 65000,
};

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".heif": "image/heif",
};

const PRODUCT_TERMS = [
  "led",
  "đèn",
  "den",
  "nguồn",
  "nguon",
  "12v",
  "24v",
  "220v",
  "usb",
  "cảm ứng",
  "cam ung",
  "cảm biến",
  "cam bien",
  "năng lượng",
  "nang luong",
  "công suất",
  "cong suat",
  "cm",
];

function parseOptions(argv: string[]): CliOptions {
  const options = { ...DEFAULT_OPTIONS };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [rawKey, inlineValue] = arg.split("=", 2);
    const nextValue = inlineValue ?? argv[index + 1];
    const consumeNext = inlineValue === undefined && nextValue && !nextValue.startsWith("--");

    switch (rawKey) {
      case "--image-dir":
        options.imageDir = requireValue(rawKey, nextValue);
        if (consumeNext) index += 1;
        break;
      case "--out":
        options.markdownOutput = requireValue(rawKey, nextValue);
        if (consumeNext) index += 1;
        break;
      case "--json":
        options.jsonOutput = requireValue(rawKey, nextValue);
        if (consumeNext) index += 1;
        break;
      case "--limit":
        options.limit = parsePositiveInteger(rawKey, requireValue(rawKey, nextValue));
        if (consumeNext) index += 1;
        break;
      case "--only":
        options.onlyFiles = requireValue(rawKey, nextValue)
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean);
        if (consumeNext) index += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = parsePositiveInteger(rawKey, requireValue(rawKey, nextValue));
        if (consumeNext) index += 1;
        break;
      case "--retries":
        options.retries = parseNonNegativeInteger(rawKey, requireValue(rawKey, nextValue));
        if (consumeNext) index += 1;
        break;
      case "--retry-delay-ms":
        options.retryDelayMs = parseNonNegativeInteger(rawKey, requireValue(rawKey, nextValue));
        if (consumeNext) index += 1;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

function requireValue(key: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) throw new Error(`Missing value for ${key}`);
  return value;
}

function parsePositiveInteger(key: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${key} must be a positive integer`);
  return parsed;
}

function parseNonNegativeInteger(key: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/test-led1000-image-import.ts --image-dir=data/image

Options:
  --image-dir    Directory containing real product images. Default: ${DEFAULT_OPTIONS.imageDir}
  --out          Markdown report path. Default: ${DEFAULT_OPTIONS.markdownOutput}
  --json         JSON report path. Default: ${DEFAULT_OPTIONS.jsonOutput}
  --limit        Test only the first N images.
  --only         Comma-separated file names to test.
  --timeout-ms   Timeout per image import. Default: ${DEFAULT_OPTIONS.timeoutMs}
  --retries      Retry count for transient Gemini quota/503 errors. Default: ${DEFAULT_OPTIONS.retries}
  --retry-delay-ms
                 Delay before retrying transient Gemini errors. Default: ${DEFAULT_OPTIONS.retryDelayMs}
`);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const apiKey = await loadGeminiApiKey();
  const files = await listImageFiles(options.imageDir, options.onlyFiles);
  const selectedFiles = options.limit ? files.slice(0, options.limit) : files;

  console.log(`Testing Gemini image import for ${selectedFiles.length} image(s) in ${options.imageDir}`);

  const results: ImageResult[] = [];
  for (const filePath of selectedFiles) {
    const result = await testImage(filePath, apiKey, options);
    results.push(result);
    console.log(`${result.status.toUpperCase().padEnd(6)} ${result.fileName} sections=${result.sectionCount}`);
  }

  const finishedAt = new Date().toISOString();
  const report = buildReport(options, startedAt, finishedAt, results);
  await writeReports(report, options);

  console.log("");
  console.log(`Total: ${report.runInfo.total}`);
  console.log(`Passed: ${report.runInfo.passed}`);
  console.log(`Failed: ${report.runInfo.failed}`);
  console.log(`Needs review: ${report.runInfo.review}`);
  console.log(`Markdown report: ${options.markdownOutput}`);
  console.log(`JSON report: ${options.jsonOutput}`);

  if (report.runInfo.failed > 0) process.exitCode = 1;
}

async function loadGeminiApiKey(): Promise<string> {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/linhkienled1000?schema=public";
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const settings = await prisma.settings.findFirst({ select: { aiApiKey: true } });
    if (!settings?.aiApiKey) {
      throw new Error("Missing Gemini API key in local settings.");
    }
    return settings.aiApiKey;
  } finally {
    await prisma.$disconnect();
  }
}

async function listImageFiles(imageDir: string, onlyFiles?: string[]): Promise<string[]> {
  const directory = path.resolve(imageDir);
  const entries = await import("fs/promises").then((fs) => fs.readdir(directory, { withFileTypes: true }));
  const onlySet = new Set((onlyFiles || []).map((fileName) => fileName.toLowerCase()));
  return entries
    .filter((entry) => entry.isFile() && MIME_BY_EXTENSION[path.extname(entry.name).toLowerCase()])
    .filter((entry) => onlySet.size === 0 || onlySet.has(entry.name.toLowerCase()))
    .map((entry) => path.join(directory, entry.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

async function testImage(filePath: string, apiKey: string, options: CliOptions): Promise<ImageResult> {
  const startedAt = Date.now();
  const fileName = path.basename(filePath);
  const extension = path.extname(fileName).toLowerCase();
  const mimeType = MIME_BY_EXTENSION[extension] || "application/octet-stream";
  const buffer = await readFile(filePath);

  try {
    const document = await importWithRetries(fileName, mimeType, buffer, apiKey, options);
    const combined = document.sections.map((section) => `${section.title}\n${section.content}`).join("\n");
    const flags: string[] = [];
    const notes: string[] = [];
    const matched = matchedTerms(combined, PRODUCT_TERMS);

    if (document.sections.length === 0) {
      flags.push("no_sections");
      notes.push("Gemini did not return any knowledge sections.");
    }
    if (combined.trim().length < 80) {
      flags.push("very_short_content");
      notes.push("Extracted content is too short for reliable RAG.");
    }
    if (matched.length === 0) {
      flags.push("missing_product_terms");
      notes.push("No LED/product/spec terms were detected in extracted content.");
    }
    const qualityWarnings = document.warnings.filter(isQualityWarning);
    const transientWarnings = document.warnings.filter((warning) => !isQualityWarning(warning));
    if (qualityWarnings.length > 0) {
      flags.push("quality_warnings");
      notes.push(`Quality warnings: ${qualityWarnings.join(" | ")}`);
    }
    if (transientWarnings.length > 0) {
      notes.push(`Model/fallback notes: ${transientWarnings.join(" | ")}`);
    }

    const status: TestStatus =
      flags.includes("no_sections") || flags.includes("very_short_content")
        ? "fail"
        : flags.length > 0
          ? "review"
          : "pass";

    return {
      fileName,
      fileSize: buffer.byteLength,
      detectedType: document.detectedType,
      sectionCount: document.sections.length,
      warningCount: document.warnings.length,
      status,
      flags,
      notes,
      durationMs: Date.now() - startedAt,
      preview: combined.replace(/\s+/g, " ").slice(0, 500),
      sections: document.sections.map((section) => ({
        title: section.title,
        content: section.content,
        metadata: section.metadata,
      })),
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      fileName,
      fileSize: buffer.byteLength,
      sectionCount: 0,
      warningCount: 0,
      status: "fail",
      flags: [isTransientGeminiError(errorMessage) ? "transient_gemini_error" : "import_error"],
      notes: [errorMessage],
      durationMs: Date.now() - startedAt,
      preview: "",
      sections: [],
    };
  }
}

async function importWithRetries(
  fileName: string,
  mimeType: string,
  buffer: Buffer,
  apiKey: string,
  options: CliOptions
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= options.retries; attempt += 1) {
    try {
      return await withTimeout(
        importKnowledgeDocumentWithGemini(fileName, mimeType, buffer, apiKey),
        options.timeoutMs,
        `Timed out importing ${fileName}`
      );
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= options.retries || !isTransientGeminiError(message)) break;
      await delay(options.retryDelayMs);
    }
  }
  throw lastError;
}

function isTransientGeminiError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("429") ||
    normalized.includes("503") ||
    normalized.includes("quota") ||
    normalized.includes("rate") ||
    normalized.includes("resource_exhausted") ||
    normalized.includes("unavailable")
  );
}

function isQualityWarning(warning: string): boolean {
  const normalized = normalizeText(warning);
  if (normalized.startsWith("model ")) return false;
  if (normalized.includes("da thu lai thanh cong")) return false;
  if (normalized.includes("ghi chu nhan dien tai lieu")) return false;
  return (
    normalized.includes("khong co thong tin") ||
    normalized.includes("khong the doc") ||
    normalized.includes("khong doc") ||
    normalized.includes("mo") ||
    normalized.includes("khong chac") ||
    normalized.includes("can kiem tra")
  );
}

function matchedTerms(text: string, terms: string[]): string[] {
  const normalized = normalizeText(text);
  return terms.filter((term) => normalized.includes(normalizeText(term)));
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then(resolve)
      .catch(reject)
      .finally(() => clearTimeout(timeout));
  });
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildReport(
  options: CliOptions,
  startedAt: string,
  finishedAt: string,
  results: ImageResult[]
): Report {
  return {
    runInfo: {
      imageDir: options.imageDir,
      startedAt,
      finishedAt,
      total: results.length,
      passed: results.filter((result) => result.status === "pass").length,
      failed: results.filter((result) => result.status === "fail").length,
      review: results.filter((result) => result.status === "review").length,
    },
    results,
  };
}

async function writeReports(report: Report, options: CliOptions) {
  await mkdir(path.dirname(options.markdownOutput), { recursive: true });
  await mkdir(path.dirname(options.jsonOutput), { recursive: true });
  await Promise.all([
    writeFile(options.jsonOutput, JSON.stringify(report, null, 2), "utf8"),
    writeFile(options.markdownOutput, renderMarkdown(report), "utf8"),
  ]);
}

function renderMarkdown(report: Report): string {
  return [
    "# LED1000 Real Image Import Test Report",
    "",
    "## Run info",
    "",
    `- Image directory: ${report.runInfo.imageDir}`,
    `- Date/time: ${report.runInfo.startedAt} to ${report.runInfo.finishedAt}`,
    `- Total images: ${report.runInfo.total}`,
    `- Passed: ${report.runInfo.passed}`,
    `- Failed: ${report.runInfo.failed}`,
    `- Needs review: ${report.runInfo.review}`,
    "",
    "## Results",
    "",
    "| File | Status | Sections | Flags | Preview |",
    "| --- | --- | ---: | --- | --- |",
    ...report.results.map(
      (result) =>
        `| ${escapeTable(result.fileName)} | ${result.status} | ${result.sectionCount} | ${escapeTable(
          result.flags.join(", ") || "-"
        )} | ${escapeTable(result.preview)} |`
    ),
    "",
    "## Notes",
    "",
    "- This test checks whether Gemini can extract product-like knowledge from real product images.",
    "- Passing here means the image can seed Knowledge Base review, not that OCR/vision is production-perfect.",
  ].join("\n");
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ").slice(0, 600);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
