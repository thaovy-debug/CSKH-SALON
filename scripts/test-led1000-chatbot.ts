import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type TestGroup =
  | "Business/contact"
  | "Product category retrieval"
  | "Technical consulting"
  | "Price/inventory behavior"
  | "Out-of-domain regression"
  | "Ambiguous/missing info";

type TestKind = "business" | "product" | "technical" | "price" | "offdomain" | "ambiguous";
type TestStatus = "pass" | "fail" | "review";

interface CliOptions {
  baseUrl: string;
  endpoint: string;
  markdownOutput: string;
  jsonOutput: string;
  delayMs: number;
  timeoutMs: number;
  start?: number;
  limit?: number;
  apiKey?: string;
  apiKeyFromDb?: boolean;
  ensureApiKey?: boolean;
  cookie?: string;
}

interface TestCase {
  id: string;
  group: TestGroup;
  kind: TestKind;
  question: string;
  expectedTerms?: string[];
}

interface ChatApiResponse {
  conversationId?: string;
  response?: unknown;
  error?: unknown;
}

interface TestResult {
  id: string;
  group: TestGroup;
  question: string;
  response: string;
  status: TestStatus;
  flags: string[];
  notes: string;
  conversationId?: string;
  httpStatus?: number;
  durationMs: number;
}

interface TestReport {
  runInfo: {
    baseUrl: string;
    endpoint: string;
    authMethod: "none" | "api_key" | "cookie";
    startedAt: string;
    finishedAt: string;
    total: number;
    passed: number;
    failed: number;
    review: number;
  };
  summaryByGroup: Record<TestGroup, { total: number; passed: number; failed: number; review: number }>;
  results: TestResult[];
}

const DEFAULT_OPTIONS: CliOptions = {
  baseUrl: "http://localhost:3000",
  endpoint: "/api/chat",
  markdownOutput: "data/test-results/led1000-chatbot-test-report.md",
  jsonOutput: "data/test-results/led1000-chatbot-test-report.json",
  delayMs: 500,
  timeoutMs: 60000,
};

const BUSINESS_TERMS = [
  "LED1000",
  "Linh Kiện LED1000",
  "Long Thịnh Phát",
  "0909003082",
  "0972 90 25 25",
  "Vườn Lài",
  "Tân Phú",
];

const PRODUCT_TERMS = [
  "adapter",
  "12V",
  "24V",
  "LED dây",
  "COB",
  "nguồn",
  "đèn năng lượng mặt trời",
  "linh kiện",
  "phụ kiện",
];

const TECHNICAL_TERMS = [
  "điện áp",
  "công suất",
  "chiều dài",
  "trong nhà",
  "ngoài trời",
  "IP",
  "màu ánh sáng",
  "RGB",
  "số lượng",
  "quy cách",
  "watt",
  "W",
];

const LED_STEERING_TERMS = ["LED1000", "linh kiện led", "đèn led", "nguồn", "LED dây", "chiếu sáng"];
const OUT_OF_DOMAIN_ACCEPTANCE_PATTERNS = [
  /(đặt bàn|món ăn|thực đơn|nhà hàng)/i,
  /(tour|du lịch|vé máy bay|khách sạn)/i,
  /(mỹ phẩm|kem dưỡng|nước hoa)/i,
];
const OUT_OF_DOMAIN_REFUSAL_PATTERN =
  /(không\s+(?:hỗ trợ|có|kinh doanh|phải)|chưa\s+hỗ trợ|không phải là|không có dịch vụ|không thuộc|không chuyên)/i;
const CONFIDENT_STOCK_PATTERN = /(hiện\s+)?(còn hàng|sẵn hàng|có sẵn|đang có hàng|hết hàng)/i;
const UNCERTAINTY_PATTERN = /(chưa có|không có dữ liệu|không thấy|cần xác nhận|liên hệ|kiểm tra|mã sản phẩm|quy cách)/i;

const TEST_CASES: TestCase[] = [
  {
    id: "BIZ-01",
    group: "Business/contact",
    kind: "business",
    question: "LED1000 là bên nào?",
  },
  { id: "BIZ-02", group: "Business/contact", kind: "business", question: "Shop ở đâu?" },
  { id: "BIZ-03", group: "Business/contact", kind: "business", question: "Hotline là gì?" },
  {
    id: "BIZ-04",
    group: "Business/contact",
    kind: "business",
    question: "LED1000 bán những nhóm sản phẩm nào?",
  },
  {
    id: "CAT-01",
    group: "Product category retrieval",
    kind: "product",
    question: "Có bán adapter 12V không?",
    expectedTerms: ["adapter", "12V", "nguồn"],
  },
  {
    id: "CAT-02",
    group: "Product category retrieval",
    kind: "product",
    question: "Có bán nguồn 24V không?",
    expectedTerms: ["nguồn", "24V"],
  },
  {
    id: "CAT-03",
    group: "Product category retrieval",
    kind: "product",
    question: "Có bán LED dây không?",
    expectedTerms: ["LED dây"],
  },
  {
    id: "CAT-04",
    group: "Product category retrieval",
    kind: "product",
    question: "Có LED dây COB không?",
    expectedTerms: ["LED dây", "COB"],
  },
  {
    id: "CAT-05",
    group: "Product category retrieval",
    kind: "product",
    question: "Có đèn năng lượng mặt trời không?",
    expectedTerms: ["đèn năng lượng mặt trời", "năng lượng mặt trời"],
  },
  {
    id: "CAT-06",
    group: "Product category retrieval",
    kind: "product",
    question: "Có linh kiện đèn LED không?",
    expectedTerms: ["linh kiện", "phụ kiện", "LED"],
  },
  {
    id: "TECH-01",
    group: "Technical consulting",
    kind: "technical",
    question: "Tôi cần LED dây ngoài trời thì nên chọn loại nào?",
  },
  {
    id: "TECH-02",
    group: "Technical consulting",
    kind: "technical",
    question: "Tôi muốn hắt trần phòng khách thì cần loại LED nào?",
  },
  {
    id: "TECH-03",
    group: "Technical consulting",
    kind: "technical",
    question: "Nguồn 12V 5A dùng cho LED dây được không?",
  },
  {
    id: "TECH-04",
    group: "Technical consulting",
    kind: "technical",
    question: "Tôi chưa biết chọn nguồn bao nhiêu W thì cần cung cấp thông tin gì?",
  },
  {
    id: "TECH-05",
    group: "Technical consulting",
    kind: "technical",
    question: "LED dây COB khác gì LED dây thường?",
  },
  {
    id: "TECH-06",
    group: "Technical consulting",
    kind: "technical",
    question: "Đèn LED dây 12V và 220V khác nhau thế nào?",
  },
  {
    id: "PRICE-01",
    group: "Price/inventory behavior",
    kind: "price",
    question: "Giá adapter 12V 5A bao nhiêu?",
  },
  {
    id: "PRICE-02",
    group: "Price/inventory behavior",
    kind: "price",
    question: "Giá LED dây COB 12V bao nhiêu?",
  },
  {
    id: "PRICE-03",
    group: "Price/inventory behavior",
    kind: "price",
    question: "Có giá đèn LED dây Rạng Đông không?",
  },
  {
    id: "PRICE-04",
    group: "Price/inventory behavior",
    kind: "price",
    question: "Còn hàng đèn LED dây chống nước không?",
  },
  {
    id: "OOD-01",
    group: "Out-of-domain regression",
    kind: "offdomain",
    question: "Tôi muốn đặt bàn ăn tối thì sao?",
  },
  {
    id: "OOD-02",
    group: "Out-of-domain regression",
    kind: "offdomain",
    question: "Có tư vấn tour du lịch không?",
  },
  {
    id: "OOD-03",
    group: "Out-of-domain regression",
    kind: "offdomain",
    question: "Bên mình có bán mỹ phẩm không?",
  },
  {
    id: "AMB-01",
    group: "Ambiguous/missing info",
    kind: "ambiguous",
    question: "Tôi cần mua đèn cho bảng hiệu, tư vấn giúp tôi.",
  },
  {
    id: "AMB-02",
    group: "Ambiguous/missing info",
    kind: "ambiguous",
    question: "Tôi muốn mua nguồn cho LED dây 10m, chọn loại nào?",
  },
];

function parseOptions(argv: string[]): CliOptions {
  const options = { ...DEFAULT_OPTIONS };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const [rawKey, inlineValue] = arg.split("=", 2);
    const nextValue = inlineValue ?? argv[index + 1];
    const consumeNext = inlineValue === undefined && nextValue && !nextValue.startsWith("--");

    switch (rawKey) {
      case "--base-url":
        options.baseUrl = requireValue(rawKey, nextValue);
        if (consumeNext) index += 1;
        break;
      case "--endpoint":
        options.endpoint = requireValue(rawKey, nextValue);
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
      case "--delay-ms":
        options.delayMs = parseNonNegativeInteger(rawKey, requireValue(rawKey, nextValue));
        if (consumeNext) index += 1;
        break;
      case "--timeout-ms":
        options.timeoutMs = parseNonNegativeInteger(rawKey, requireValue(rawKey, nextValue));
        if (consumeNext) index += 1;
        break;
      case "--limit":
        options.limit = parseNonNegativeInteger(rawKey, requireValue(rawKey, nextValue));
        if (consumeNext) index += 1;
        break;
      case "--start":
        options.start = parsePositiveInteger(rawKey, requireValue(rawKey, nextValue));
        if (consumeNext) index += 1;
        break;
      case "--api-key":
        options.apiKey = requireValue(rawKey, nextValue);
        if (consumeNext) index += 1;
        break;
      case "--api-key-from-db":
        options.apiKeyFromDb = true;
        break;
      case "--ensure-api-key":
        options.apiKeyFromDb = true;
        options.ensureApiKey = true;
        break;
      case "--cookie":
        options.cookie = requireValue(rawKey, nextValue);
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

  return {
    ...options,
    baseUrl: options.baseUrl.replace(/\/+$/, ""),
    endpoint: options.endpoint.startsWith("/") ? options.endpoint : `/${options.endpoint}`,
  };
}

function requireValue(key: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${key}`);
  }
  return value;
}

function parseNonNegativeInteger(key: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`${key} must be a non-negative integer`);
  }
  return parsed;
}

function parsePositiveInteger(key: string, value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${key} must be a positive integer`);
  }
  return parsed;
}

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/test-led1000-chatbot.ts --base-url=http://localhost:3000

Options:
  --base-url     Local app origin. Default: ${DEFAULT_OPTIONS.baseUrl}
  --endpoint     Chat endpoint. Default: ${DEFAULT_OPTIONS.endpoint}
  --out          Markdown report path. Default: ${DEFAULT_OPTIONS.markdownOutput}
  --json         JSON report path. Default: ${DEFAULT_OPTIONS.jsonOutput}
  --delay-ms     Delay between requests. Default: ${DEFAULT_OPTIONS.delayMs}
  --timeout-ms   Request timeout. Default: ${DEFAULT_OPTIONS.timeoutMs}
  --start        Run from this 1-based test index. Default: 1.
  --limit        Run only the first N test cases.
  --api-key      API key to send as X-API-Key. The value is never written to reports.
  --api-key-from-db
                 Load the newest active API key from the local database. The key is never printed.
  --ensure-api-key
                 Create a local active API key when none exists, then use it. The key is never printed.
  --cookie       Auth cookie. Accepts either the raw token or "linhkienled1000-token=...".
`);
}

async function run() {
  const options = parseOptions(process.argv.slice(2));
  if (options.apiKeyFromDb) {
    options.apiKey = await loadApiKeyFromDb(options.ensureApiKey);
  }
  const startedAt = new Date().toISOString();
  const results: TestResult[] = [];
  const startIndex = Math.max((options.start || 1) - 1, 0);
  const selectedCases = TEST_CASES.slice(startIndex);
  const testCases =
    options.limit && options.limit > 0 ? selectedCases.slice(0, options.limit) : selectedCases;

  console.log(`Running ${testCases.length} LED1000 chatbot API tests against ${options.baseUrl}${options.endpoint}`);
  console.log(`Auth: ${getAuthMethod(options)}`);

  for (let index = 0; index < testCases.length; index += 1) {
    const testCase = testCases[index];
    const result = await runTestCase(testCase, options);
    results.push(result);
    console.log(`${result.status.toUpperCase().padEnd(6)} ${testCase.id} ${testCase.question}`);

    if (index < testCases.length - 1 && options.delayMs > 0) {
      await delay(options.delayMs);
    }
  }

  const finishedAt = new Date().toISOString();
  const report = buildReport(options, startedAt, finishedAt, results);
  await writeReportFiles(report, options);

  console.log("");
  console.log(`Total: ${report.runInfo.total}`);
  console.log(`Passed: ${report.runInfo.passed}`);
  console.log(`Failed: ${report.runInfo.failed}`);
  console.log(`Needs review: ${report.runInfo.review}`);
  console.log(`Markdown report: ${options.markdownOutput}`);
  console.log(`JSON report: ${options.jsonOutput}`);

  if (report.runInfo.failed > 0) {
    process.exitCode = 1;
  }
}

async function loadApiKeyFromDb(ensure = false): Promise<string> {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/linhkienled1000?schema=public";
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    const apiKey = await prisma.apiKey.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
      select: { key: true },
    });

    if (!apiKey?.key && ensure) {
      const created = await prisma.apiKey.create({
        data: {
          name: "LED1000 Mock Chatbot Test",
          key: `linhkienled1000_${crypto.randomBytes(32).toString("hex")}`,
          isActive: true,
        },
        select: { key: true },
      });
      return created.key;
    }

    if (!apiKey?.key) {
      throw new Error("No active API key found in database.");
    }

    return apiKey.key;
  } finally {
    await prisma.$disconnect();
  }
}

async function runTestCase(testCase: TestCase, options: CliOptions): Promise<TestResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const headers = buildRequestHeaders(options);
    const response = await fetch(`${options.baseUrl}${options.endpoint}`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        message: testCase.question,
        channel: "api",
        customerName: `LED1000 Test Harness ${testCase.id}`,
        customerContact: "",
      }),
      signal: controller.signal,
    });

    const text = await response.text();
    const parsed = parseJson(text);
    const body = parsed && typeof parsed === "object" ? (parsed as ChatApiResponse) : {};
    const answer = typeof body.response === "string" ? body.response : text;

    if (!response.ok) {
      return {
        id: testCase.id,
        group: testCase.group,
        question: testCase.question,
        response: answer,
        status: "fail",
        flags: [`http_${response.status}`],
        notes: stringifyUnknown(body.error) || "API returned a non-2xx response.",
        conversationId: body.conversationId,
        httpStatus: response.status,
        durationMs: Date.now() - startedAt,
      };
    }

    return {
      ...evaluateResponse(testCase, answer),
      conversationId: body.conversationId,
      httpStatus: response.status,
      durationMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      id: testCase.id,
      group: testCase.group,
      question: testCase.question,
      response: "",
      status: "fail",
      flags: [error instanceof DOMException && error.name === "AbortError" ? "timeout" : "api_error"],
      notes: stringifyUnknown(error),
      durationMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildRequestHeaders(options: CliOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.apiKey) {
    headers["X-API-Key"] = options.apiKey;
  }

  if (options.cookie) {
    headers.Cookie = options.cookie.includes("=")
      ? options.cookie
      : `linhkienled1000-token=${options.cookie}`;
  }

  return headers;
}

function evaluateResponse(testCase: TestCase, response: string): Omit<TestResult, "conversationId" | "httpStatus" | "durationMs"> {
  const flags: string[] = [];
  const notes: string[] = [];

  if (!response.trim()) {
    flags.push("empty_response");
    notes.push("API returned an empty response.");
  }

  if (testCase.kind === "business") {
    const terms = matchedTerms(response, BUSINESS_TERMS);
    if (terms.length === 0) {
      flags.push("missing_business_contact_terms");
      notes.push("Expected at least one LED1000 business/contact term.");
    }
  }

  if (testCase.kind === "product") {
    const terms = matchedTerms(response, testCase.expectedTerms ?? PRODUCT_TERMS);
    if (terms.length === 0) {
      flags.push("missing_product_terms");
      notes.push("Expected at least one product/category term.");
    }
  }

  if (testCase.kind === "technical" || testCase.kind === "ambiguous") {
    const terms = matchedTerms(response, TECHNICAL_TERMS);
    if (terms.length < 2) {
      flags.push("needs_technical_spec_review");
      notes.push("Expected the answer to ask for or mention more technical specs.");
    }
  }

  if (testCase.kind === "price") {
    flags.push("price_inventory_manual_review");
    notes.push("Price/inventory answers require human review against the imported KB/source data.");

    if (CONFIDENT_STOCK_PATTERN.test(response) && !UNCERTAINTY_PATTERN.test(response)) {
      flags.push("possible_inventory_hallucination");
      notes.push("Response appears to assert stock status without an uncertainty/checking cue.");
    }
  }

  if (testCase.kind === "offdomain") {
    const acceptsOutOfDomainRole = OUT_OF_DOMAIN_ACCEPTANCE_PATTERNS.some((pattern) =>
      pattern.test(response)
    );
    const refusesOutOfDomainRole = OUT_OF_DOMAIN_REFUSAL_PATTERN.test(response);
    const steersToLed = matchedTerms(response, LED_STEERING_TERMS).length > 0;

    if (acceptsOutOfDomainRole && !refusesOutOfDomainRole) {
      flags.push("accepts_out_of_domain_role");
      notes.push("Response appears to accept an unrelated business identity.");
    }

    if (!steersToLed) {
      flags.push("missing_led1000_redirect");
      notes.push("Expected the answer to steer back to LED1000/LED product support.");
    }
  }

  return {
    id: testCase.id,
    group: testCase.group,
    question: testCase.question,
    response,
    status: getStatus(flags),
    flags,
    notes: notes.join(" "),
  };
}

function getStatus(flags: string[]): TestStatus {
  const failFlags = new Set([
    "empty_response",
    "missing_business_contact_terms",
    "missing_product_terms",
    "possible_inventory_hallucination",
    "accepts_out_of_domain_role",
  ]);

  if (flags.some((flag) => failFlags.has(flag) || flag.startsWith("http_") || flag === "api_error" || flag === "timeout")) {
    return "fail";
  }

  if (flags.length > 0) {
    return "review";
  }

  return "pass";
}

function buildReport(options: CliOptions, startedAt: string, finishedAt: string, results: TestResult[]): TestReport {
  const summaryByGroup = TEST_CASES.reduce(
    (summary, testCase) => {
      summary[testCase.group] = { total: 0, passed: 0, failed: 0, review: 0 };
      return summary;
    },
    {} as Record<TestGroup, { total: number; passed: number; failed: number; review: number }>
  );

  for (const result of results) {
    const summary = summaryByGroup[result.group];
    summary.total += 1;
    if (result.status === "pass") summary.passed += 1;
    if (result.status === "fail") summary.failed += 1;
    if (result.status === "review") summary.review += 1;
  }

  return {
    runInfo: {
      baseUrl: options.baseUrl,
      endpoint: options.endpoint,
      authMethod: getAuthMethod(options),
      startedAt,
      finishedAt,
      total: results.length,
      passed: results.filter((result) => result.status === "pass").length,
      failed: results.filter((result) => result.status === "fail").length,
      review: results.filter((result) => result.status === "review").length,
    },
    summaryByGroup,
    results,
  };
}

async function writeReportFiles(report: TestReport, options: CliOptions) {
  await mkdir(path.dirname(options.markdownOutput), { recursive: true });
  await mkdir(path.dirname(options.jsonOutput), { recursive: true });
  await writeFile(options.markdownOutput, renderMarkdownReport(report), "utf8");
  await writeFile(options.jsonOutput, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

function renderMarkdownReport(report: TestReport): string {
  const failedOrReview = report.results.filter((result) => result.status !== "pass");

  return [
    "# LED1000 Chatbot API Test Report",
    "",
    "## Run info",
    "",
    `- Base URL: ${report.runInfo.baseUrl}`,
    `- Endpoint: ${report.runInfo.endpoint}`,
    `- Auth method: ${report.runInfo.authMethod}`,
    `- Date/time: ${report.runInfo.startedAt} to ${report.runInfo.finishedAt}`,
    `- Total tests: ${report.runInfo.total}`,
    `- Passed: ${report.runInfo.passed}`,
    `- Failed: ${report.runInfo.failed}`,
    `- Needs review: ${report.runInfo.review}`,
    "",
    "## Summary by group",
    "",
    "| Group | Total | Passed | Failed | Review |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...Object.entries(report.summaryByGroup).map(
      ([group, summary]) => `| ${escapeMarkdownTable(group)} | ${summary.total} | ${summary.passed} | ${summary.failed} | ${summary.review} |`
    ),
    "",
    "## Failed / review cases",
    "",
    failedOrReview.length === 0
      ? "No failed or review cases."
      : [
          "| ID | Group | Status | Flags | Notes |",
          "| --- | --- | --- | --- | --- |",
          ...failedOrReview.map(
            (result) =>
              `| ${result.id} | ${escapeMarkdownTable(result.group)} | ${result.status} | ${escapeMarkdownTable(
                result.flags.join(", ") || "-"
              )} | ${escapeMarkdownTable(result.notes || "-")} |`
          ),
        ].join("\n"),
    "",
    "## Full results table",
    "",
    "| ID | Group | Question | Status | Flags | Short response |",
    "| --- | --- | --- | --- | --- | --- |",
    ...report.results.map(
      (result) =>
        `| ${result.id} | ${escapeMarkdownTable(result.group)} | ${escapeMarkdownTable(result.question)} | ${
          result.status
        } | ${escapeMarkdownTable(result.flags.join(", ") || "-")} | ${escapeMarkdownTable(shorten(result.response, 180))} |`
    ),
    "",
    "## Notes",
    "",
    "- This is heuristic validation, not final human approval.",
    "- Review price/inventory answers manually.",
    "- Each test sends a new API request without reusing `conversationId`, so answers are less likely to be affected by prior test context.",
    "",
  ].join("\n");
}

function matchedTerms(text: string, terms: string[]): string[] {
  const normalized = text.toLocaleLowerCase("vi-VN");
  return terms.filter((term) => normalized.includes(term.toLocaleLowerCase("vi-VN")));
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function stringifyUnknown(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value;
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shorten(value: string, maxLength: number): string {
  const singleLine = value.replace(/\s+/g, " ").trim();
  if (singleLine.length <= maxLength) return singleLine;
  return `${singleLine.slice(0, maxLength - 3)}...`;
}

function escapeMarkdownTable(value: string): string {
  return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

function getAuthMethod(options: CliOptions): "none" | "api_key" | "cookie" {
  if (options.apiKey) return "api_key";
  if (options.cookie) return "cookie";
  return "none";
}

run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
