import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

type TestStatus = "pass" | "fail" | "review";

interface CliOptions {
  baseUrl: string;
  endpoint: string;
  markdownOutput: string;
  jsonOutput: string;
  timeoutMs: number;
  delayMs: number;
  apiKeyFromDb: boolean;
  apiKey?: string;
}

interface Turn {
  message: string;
  expectedAny?: string[];
  expectedAll?: string[];
  forbidden?: RegExp[];
}

interface Scenario {
  id: string;
  title: string;
  turns: Turn[];
}

interface TurnResult {
  message: string;
  response: string;
  status: TestStatus;
  flags: string[];
  notes: string[];
  durationMs: number;
}

interface ScenarioResult {
  id: string;
  title: string;
  conversationId?: string;
  status: TestStatus;
  flags: string[];
  notes: string[];
  turns: TurnResult[];
}

interface Report {
  runInfo: {
    baseUrl: string;
    endpoint: string;
    startedAt: string;
    finishedAt: string;
    total: number;
    passed: number;
    failed: number;
    review: number;
  };
  results: ScenarioResult[];
}

const DEFAULT_OPTIONS: CliOptions = {
  baseUrl: "http://localhost:3000",
  endpoint: "/api/chat",
  markdownOutput: "data/test-results/led1000-real-conversations-report.md",
  jsonOutput: "data/test-results/led1000-real-conversations-report.json",
  timeoutMs: 120000,
  delayMs: 300,
  apiKeyFromDb: true,
};

const SCENARIOS: Scenario[] = [
  {
    id: "REAL-01",
    title: "Khách hỏi LED dây ngoài trời cho bảng hiệu",
    turns: [
      {
        message: "Chào shop, tôi cần mua LED dây ngoài trời để làm bảng hiệu khoảng 8m.",
        expectedAny: ["ngoài trời", "chống nước", "IP", "12V", "24V", "220V", "chiều dài", "nguồn"],
      },
      {
        message: "Tôi chưa biết dùng 12V hay 220V, bảng hiệu ở ngoài trời có mưa.",
        expectedAny: ["thợ", "kỹ thuật", "chống nước", "an toàn", "nguồn", "220V", "12V"],
      },
    ],
  },
  {
    id: "REAL-02",
    title: "Khách công trình hỏi giá nguồn",
    turns: [
      {
        message: "Tôi là khách công trình, cần 10 cái nguồn tổ ong 12V 20A, báo giá sơ bộ giúp tôi.",
        expectedAny: ["khách công trình", "giá công trình", "185.000", "185000", "DEMO-PS12-20A"],
      },
      {
        message: "Giá này đã gồm VAT chưa?",
        expectedAny: ["VAT", "chưa gồm", "nhân viên", "xác nhận"],
      },
    ],
  },
  {
    id: "REAL-03",
    title: "Khách hỏi tồn kho và sản phẩm thay thế",
    turns: [
      {
        message: "Còn hàng LED dây COB 24V cuộn 10m không?",
        expectedAny: ["hết hàng", "theo dữ liệu", "tồn kho", "thay thế", "COB12", "LED24"],
      },
      {
        message: "Nếu hết thì đổi sang loại nào gần giống?",
        expectedAny: ["thay thế", "12V", "LED dây", "chống nước", "nhân viên", "xác nhận"],
      },
    ],
  },
  {
    id: "REAL-04",
    title: "Khách cần xuất VAT",
    turns: [
      {
        message: "Bên mình xuất VAT được không, tôi mua cho công ty?",
        expectedAny: ["mã số thuế", "MST", "tên công ty", "email", "hóa đơn", "nhân viên"],
      },
      {
        message: "Tôi cần chuẩn bị thông tin gì?",
        expectedAny: ["tên công ty", "mã số thuế", "địa chỉ", "email", "số lượng"],
      },
    ],
  },
  {
    id: "REAL-05",
    title: "Khách ngoài ngành",
    turns: [
      {
        message: "Shop có tư vấn tour du lịch Đà Lạt không?",
        expectedAny: ["không", "LED1000", "đèn LED", "nguồn", "chiếu sáng"],
        forbidden: [/có\s+(?:tư vấn|tour|dịch vụ)\s+du lịch/i],
      },
    ],
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
      case "--timeout-ms":
        options.timeoutMs = parsePositiveInteger(rawKey, requireValue(rawKey, nextValue));
        if (consumeNext) index += 1;
        break;
      case "--delay-ms":
        options.delayMs = parseNonNegativeInteger(rawKey, requireValue(rawKey, nextValue));
        if (consumeNext) index += 1;
        break;
      case "--api-key":
        options.apiKey = requireValue(rawKey, nextValue);
        options.apiKeyFromDb = false;
        if (consumeNext) index += 1;
        break;
      case "--api-key-from-db":
        options.apiKeyFromDb = true;
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
  npx tsx scripts/test-led1000-real-conversations.ts --base-url=http://localhost:3000

Options:
  --base-url        Local app origin. Default: ${DEFAULT_OPTIONS.baseUrl}
  --endpoint        Chat endpoint. Default: ${DEFAULT_OPTIONS.endpoint}
  --out             Markdown report path. Default: ${DEFAULT_OPTIONS.markdownOutput}
  --json            JSON report path. Default: ${DEFAULT_OPTIONS.jsonOutput}
  --timeout-ms      Request timeout per turn. Default: ${DEFAULT_OPTIONS.timeoutMs}
  --delay-ms        Delay between turns. Default: ${DEFAULT_OPTIONS.delayMs}
  --api-key         API key to send as X-API-Key. The value is never written to reports.
  --api-key-from-db Load newest active API key from the local database. Default.
`);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  if (options.apiKeyFromDb) options.apiKey = await loadApiKeyFromDb();
  if (!options.apiKey) throw new Error("Missing API key.");

  const startedAt = new Date().toISOString();
  const results: ScenarioResult[] = [];

  console.log(`Running ${SCENARIOS.length} LED1000 real conversation scenario(s)`);

  for (const scenario of SCENARIOS) {
    const result = await runScenario(scenario, options);
    results.push(result);
    console.log(`${result.status.toUpperCase().padEnd(6)} ${scenario.id} ${scenario.title}`);
    if (options.delayMs > 0) await delay(options.delayMs);
  }

  const report = buildReport(options, startedAt, new Date().toISOString(), results);
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

async function loadApiKeyFromDb(): Promise<string> {
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
    if (!apiKey?.key) throw new Error("No active API key found in local database.");
    return apiKey.key;
  } finally {
    await prisma.$disconnect();
  }
}

async function runScenario(scenario: Scenario, options: CliOptions): Promise<ScenarioResult> {
  let conversationId: string | undefined;
  const turnResults: TurnResult[] = [];

  for (const turn of scenario.turns) {
    const result = await runTurn(turn, options, conversationId);
    turnResults.push(result);
    if (result.conversationId) conversationId = result.conversationId;
    if (options.delayMs > 0) await delay(options.delayMs);
  }

  const flags = [...new Set(turnResults.flatMap((turn) => turn.flags))];
  const notes = [...new Set(turnResults.flatMap((turn) => turn.notes))];
  const status: TestStatus = turnResults.some((turn) => turn.status === "fail")
    ? "fail"
    : turnResults.some((turn) => turn.status === "review")
      ? "review"
      : "pass";

  return {
    id: scenario.id,
    title: scenario.title,
    conversationId,
    status,
    flags,
    notes,
    turns: turnResults,
  };
}

async function runTurn(
  turn: Turn,
  options: CliOptions,
  conversationId?: string
): Promise<TurnResult & { conversationId?: string }> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(`${options.baseUrl}${options.endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": options.apiKey || "",
      },
      body: JSON.stringify({
        message: turn.message,
        conversationId,
        channel: "api",
        customerName: "Khách test LED1000",
        customerContact: `test-${crypto.randomUUID()}@led1000.local`,
      }),
      signal: controller.signal,
    });
    const payload = (await response.json().catch(() => null)) as {
      conversationId?: string;
      response?: unknown;
      error?: unknown;
    } | null;

    const text =
      typeof payload?.response === "string"
        ? payload.response
        : payload?.error
          ? JSON.stringify(payload.error)
          : JSON.stringify(payload);
    const evaluated = evaluateTurn(turn, text, response.status);

    return {
      ...evaluated,
      durationMs: Date.now() - startedAt,
      conversationId: payload?.conversationId || conversationId,
    };
  } catch (error) {
    return {
      message: turn.message,
      response: "",
      status: "fail",
      flags: [error instanceof DOMException && error.name === "AbortError" ? "timeout" : "api_error"],
      notes: [error instanceof Error ? error.message : String(error)],
      durationMs: Date.now() - startedAt,
      conversationId,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function evaluateTurn(
  turn: Turn,
  response: string,
  httpStatus: number
): Omit<TurnResult, "durationMs"> {
  const flags: string[] = [];
  const notes: string[] = [];

  if (httpStatus < 200 || httpStatus >= 300) {
    flags.push(`http_${httpStatus}`);
    notes.push(`HTTP status ${httpStatus}`);
  }
  if (!response.trim()) {
    flags.push("empty_response");
    notes.push("Empty response.");
  }

  if (turn.expectedAny && matchedTerms(response, turn.expectedAny).length === 0) {
    flags.push("missing_expected_terms");
    notes.push(`Expected one of: ${turn.expectedAny.join(", ")}`);
  }

  const missingAll = (turn.expectedAll || []).filter((term) => !matchedTerms(response, [term]).length);
  if (missingAll.length > 0) {
    flags.push("missing_required_terms");
    notes.push(`Missing required terms: ${missingAll.join(", ")}`);
  }

  const forbiddenMatches = (turn.forbidden || []).filter((pattern) => pattern.test(response));
  if (forbiddenMatches.length > 0) {
    flags.push("forbidden_pattern");
    notes.push("Response matched a forbidden pattern.");
  }

  const status: TestStatus =
    flags.some((flag) => flag.startsWith("http_") || flag === "empty_response" || flag === "forbidden_pattern")
      ? "fail"
      : flags.length > 0
        ? "review"
        : "pass";

  return {
    message: turn.message,
    response,
    status,
    flags,
    notes,
  };
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

function buildReport(
  options: CliOptions,
  startedAt: string,
  finishedAt: string,
  results: ScenarioResult[]
): Report {
  return {
    runInfo: {
      baseUrl: options.baseUrl,
      endpoint: options.endpoint,
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
    "# LED1000 Real Conversation Test Report",
    "",
    "## Run info",
    "",
    `- Base URL: ${report.runInfo.baseUrl}`,
    `- Endpoint: ${report.runInfo.endpoint}`,
    `- Date/time: ${report.runInfo.startedAt} to ${report.runInfo.finishedAt}`,
    `- Total scenarios: ${report.runInfo.total}`,
    `- Passed: ${report.runInfo.passed}`,
    `- Failed: ${report.runInfo.failed}`,
    `- Needs review: ${report.runInfo.review}`,
    "",
    "## Results",
    "",
    "| Scenario | Status | Flags | Last response |",
    "| --- | --- | --- | --- |",
    ...report.results.map((result) => {
      const last = result.turns.at(-1)?.response || "";
      return `| ${result.id} ${escapeTable(result.title)} | ${result.status} | ${escapeTable(
        result.flags.join(", ") || "-"
      )} | ${escapeTable(last.replace(/\s+/g, " ").slice(0, 500))} |`;
    }),
    "",
    "## Notes",
    "",
    "- These scenarios keep conversationId between turns to test realistic multi-turn behavior.",
    "- Price/inventory answers still require human source-data review before production.",
  ].join("\n");
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
