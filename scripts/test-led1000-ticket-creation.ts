import "dotenv/config";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { executeToolCall } from "../src/lib/ai/tools";

type TestStatus = "pass" | "fail";

interface CliOptions {
  markdownOutput: string;
  jsonOutput: string;
  cleanupPrevious: boolean;
}

interface TicketCase {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  type: "quotation" | "consultation" | "complaint" | "warranty";
  department: string;
  customerMessage: string;
}

interface TicketResult {
  id: string;
  title: string;
  status: TestStatus;
  flags: string[];
  notes: string[];
  ticketId?: string;
  conversationId?: string;
  ticket?: {
    title: string;
    priority: string;
    type: string;
    status: string;
    departmentName?: string | null;
  };
}

interface Report {
  runInfo: {
    startedAt: string;
    finishedAt: string;
    total: number;
    passed: number;
    failed: number;
  };
  results: TicketResult[];
}

const DEFAULT_OPTIONS: CliOptions = {
  markdownOutput: "data/test-results/led1000-ticket-creation-report.md",
  jsonOutput: "data/test-results/led1000-ticket-creation-report.json",
  cleanupPrevious: true,
};

const CASES: TicketCase[] = [
  {
    id: "TICKET-01",
    title: "[LED1000 TEST] Xác nhận báo giá công trình nguồn 12V 20A",
    description:
      "Khách công trình cần chốt báo giá chính thức 10 cái nguồn tổ ong 12V 20A và cần nhân viên xác nhận giá cuối.",
    priority: "high",
    type: "quotation",
    department: "Tư vấn sản phẩm",
    customerMessage: "Tôi cần chốt 10 cái nguồn 12V 20A cho công trình, báo giá chính thức giúp tôi.",
  },
  {
    id: "TICKET-02",
    title: "[LED1000 TEST] Kiểm tồn kho LED dây COB 24V",
    description:
      "Khách hỏi sản phẩm đang hết hàng trong dữ liệu demo và cần nhân viên xác nhận tồn kho/sản phẩm thay thế.",
    priority: "medium",
    type: "consultation",
    department: "Tư vấn sản phẩm",
    customerMessage: "Còn hàng LED dây COB 24V cuộn 10m không, nếu hết thì thay bằng loại nào?",
  },
  {
    id: "TICKET-03",
    title: "[LED1000 TEST] Yêu cầu xuất VAT",
    description:
      "Khách cần xuất hóa đơn VAT cho đơn công ty, cần nhân viên xác nhận thông tin công ty/MST và giá cuối.",
    priority: "medium",
    type: "quotation",
    department: "Chăm sóc khách hàng",
    customerMessage: "Tôi cần xuất VAT cho đơn hàng công ty.",
  },
  {
    id: "TICKET-04",
    title: "[LED1000 TEST] Tư vấn kỹ thuật bảng hiệu ngoài trời",
    description:
      "Khách cần tư vấn thi công LED dây/nguồn ngoài trời cho bảng hiệu có rủi ro kỹ thuật, cần nhân viên kỹ thuật xác nhận.",
    priority: "high",
    type: "consultation",
    department: "Kỹ thuật",
    customerMessage: "Tôi muốn tự đấu LED dây ngoài trời 220V cho bảng hiệu lớn, tư vấn an toàn giúp tôi.",
  },
  {
    id: "TICKET-05",
    title: "[LED1000 TEST] Bảo hành nguồn LED",
    description:
      "Khách báo nguồn LED có lỗi và cần nhân viên tiếp nhận bảo hành theo mã hàng/ngày mua/hình ảnh lỗi.",
    priority: "high",
    type: "warranty",
    department: "Chăm sóc khách hàng",
    customerMessage: "Nguồn LED tôi mua bị lỗi, cần bảo hành.",
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
      case "--out":
        options.markdownOutput = requireValue(rawKey, nextValue);
        if (consumeNext) index += 1;
        break;
      case "--json":
        options.jsonOutput = requireValue(rawKey, nextValue);
        if (consumeNext) index += 1;
        break;
      case "--no-cleanup-previous":
        options.cleanupPrevious = false;
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

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/test-led1000-ticket-creation.ts

Options:
  --out                  Markdown report path. Default: ${DEFAULT_OPTIONS.markdownOutput}
  --json                 JSON report path. Default: ${DEFAULT_OPTIONS.jsonOutput}
  --no-cleanup-previous  Keep existing [LED1000 TEST] tickets before creating new ones.
`);
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const prisma = createPrismaClient();

  try {
    if (options.cleanupPrevious) {
      await prisma.ticket.deleteMany({ where: { title: { startsWith: "[LED1000 TEST]" } } });
    }

    const results: TicketResult[] = [];
    console.log(`Creating ${CASES.length} LED1000 handoff ticket test case(s)`);

    for (const testCase of CASES) {
      const result = await runTicketCase(prisma, testCase);
      results.push(result);
      console.log(`${result.status.toUpperCase().padEnd(6)} ${testCase.id} ${testCase.title}`);
    }

    const report = buildReport(startedAt, new Date().toISOString(), results);
    await writeReports(report, options);

    console.log("");
    console.log(`Total: ${report.runInfo.total}`);
    console.log(`Passed: ${report.runInfo.passed}`);
    console.log(`Failed: ${report.runInfo.failed}`);
    console.log(`Markdown report: ${options.markdownOutput}`);
    console.log(`JSON report: ${options.jsonOutput}`);

    if (report.runInfo.failed > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

function createPrismaClient() {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgres@localhost:5432/linhkienled1000?schema=public";
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

async function runTicketCase(
  prisma: PrismaClient,
  testCase: TicketCase
): Promise<TicketResult> {
  const conversation = await prisma.conversation.create({
    data: {
      channel: "api",
      customerName: "Khách test chuyển nhân viên",
      customerContact: `${testCase.id.toLowerCase()}@led1000.local`,
      messages: {
        create: {
          role: "customer",
          content: testCase.customerMessage,
        },
      },
    },
  });

  const rawResult = await executeToolCall(
    "create_ticket",
    {
      title: testCase.title,
      description: testCase.description,
      priority: testCase.priority,
      type: testCase.type,
      department: testCase.department,
    },
    conversation.id
  );

  const parsed = parseToolResult(rawResult);
  const ticketId = typeof parsed.ticketId === "string" ? parsed.ticketId : undefined;
  const flags: string[] = [];
  const notes: string[] = [];

  if (!parsed.success) {
    flags.push("tool_failed");
    notes.push(rawResult);
  }

  const ticket = ticketId
    ? await prisma.ticket.findUnique({
        where: { id: ticketId },
        include: { department: { select: { name: true } } },
      })
    : null;

  if (!ticket) {
    flags.push("ticket_missing");
    notes.push("Ticket was not found after tool call.");
  } else {
    if (ticket.conversationId !== conversation.id) {
      flags.push("conversation_not_linked");
      notes.push("Ticket is not linked to the expected conversation.");
    }
    if (ticket.priority !== testCase.priority) {
      flags.push("priority_mismatch");
      notes.push(`Expected priority ${testCase.priority}, got ${ticket.priority}.`);
    }
    if (ticket.type !== testCase.type) {
      flags.push("type_mismatch");
      notes.push(`Expected type ${testCase.type}, got ${ticket.type}.`);
    }
    if (testCase.department && !ticket.department?.name) {
      flags.push("department_not_matched");
      notes.push(`Department "${testCase.department}" was not matched. Ticket still created.`);
    }
  }

  return {
    id: testCase.id,
    title: testCase.title,
    status: flags.length > 0 ? "fail" : "pass",
    flags,
    notes,
    ticketId,
    conversationId: conversation.id,
    ticket: ticket
      ? {
          title: ticket.title,
          priority: ticket.priority,
          type: ticket.type,
          status: ticket.status,
          departmentName: ticket.department?.name,
        }
      : undefined,
  };
}

function parseToolResult(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return { success: false, raw };
  }
}

function buildReport(startedAt: string, finishedAt: string, results: TicketResult[]): Report {
  return {
    runInfo: {
      startedAt,
      finishedAt,
      total: results.length,
      passed: results.filter((result) => result.status === "pass").length,
      failed: results.filter((result) => result.status === "fail").length,
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
    "# LED1000 Ticket Creation Test Report",
    "",
    "## Run info",
    "",
    `- Date/time: ${report.runInfo.startedAt} to ${report.runInfo.finishedAt}`,
    `- Total cases: ${report.runInfo.total}`,
    `- Passed: ${report.runInfo.passed}`,
    `- Failed: ${report.runInfo.failed}`,
    "",
    "## Results",
    "",
    "| Case | Status | Ticket ID | Priority | Type | Department | Flags |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...report.results.map(
      (result) =>
        `| ${result.id} ${escapeTable(result.title)} | ${result.status} | ${result.ticketId || "-"} | ${
          result.ticket?.priority || "-"
        } | ${result.ticket?.type || "-"} | ${escapeTable(result.ticket?.departmentName || "-")} | ${escapeTable(
          result.flags.join(", ") || "-"
        )} |`
    ),
    "",
    "## Notes",
    "",
    "- This script creates real test tickets in the local database with title prefix `[LED1000 TEST]`.",
    "- By default it deletes previous `[LED1000 TEST]` tickets before creating a fresh set.",
  ].join("\n");
}

function escapeTable(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
