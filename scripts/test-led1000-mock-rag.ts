import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { searchKnowledgeBase } from "../src/lib/ai/semantic-search";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/linhkienled1000?schema=public";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const TEST_QUERIES = [
  "LED1000 bán những nhóm sản phẩm nào?",
  "Shop ở đâu?",
  "Adapter 12V 5A giá lẻ bao nhiêu?",
  "Khách công trình mua nguồn 12V 20A giá thế nào?",
  "Còn hàng LED dây COB 12V 5m không?",
  "Nếu hết LED dây COB 24V có sản phẩm thay thế không?",
  "Tôi cần LED dây ngoài trời cho bảng hiệu 8m cần hỏi gì?",
  "Chính sách bảo hành nguồn LED thế nào?",
  "Xuất VAT cần cung cấp thông tin gì?",
  "Tôi là cửa hàng muốn lấy giá đại lý thì cần điều kiện gì?",
  "Có tài khoản Zalo hoặc Shopee demo không?",
];

async function main() {
  console.log("LED1000 mock RAG smoke test");

  const [categories, entries, mockEntries, metadataRows] = await Promise.all([
    prisma.category.count(),
    prisma.knowledgeEntry.count(),
    prisma.knowledgeEntry.count({ where: { metadata: { path: ["mockDataset"], equals: true } } }),
    prisma.knowledgeEntry.findMany({ select: { metadata: true } }),
  ]);
  const embeddedEntries = metadataRows.filter((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return Array.isArray(metadata?.embedding);
  }).length;

  console.log(`categories=${categories}`);
  console.log(`entries=${entries}`);
  console.log(`mockEntries=${mockEntries}`);
  console.log(`embeddedEntries=${embeddedEntries}`);

  let passed = 0;

  for (const query of TEST_QUERIES) {
    const results = await searchKnowledgeBase(query, 3);
    const top = results[0];
    const ok = Boolean(top);
    if (ok) passed += 1;

    console.log("");
    console.log(`${ok ? "PASS" : "FAIL"} ${query}`);
    if (!top) {
      console.log("  No result");
      continue;
    }

    console.log(`  topCategory=${top.category}`);
    console.log(`  topTitle=${top.title}`);
    console.log(`  score=${top.score.toFixed(4)}`);
    console.log(`  preview=${top.content.replace(/\s+/g, " ").slice(0, 180)}`);
  }

  console.log("");
  console.log(`RAG_RESULTS=${passed}/${TEST_QUERIES.length}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
