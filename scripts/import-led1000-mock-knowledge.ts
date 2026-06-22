import "dotenv/config";
import { createHash, randomUUID } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { indexKnowledgeEntry } from "../src/lib/ai/semantic-search";
import { importKnowledgeDocument } from "../src/lib/knowledge/import";
import { LED1000_KNOWLEDGE_CATEGORIES } from "../src/lib/knowledge/led1000-taxonomy";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/linhkienled1000?schema=public";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const MOCK_DATA_DIR = path.join("data", "knowledge", "mock-led1000");

const MOCK_IMPORT_FILES = [
  {
    fileName: "01-business-profile-demo.md",
    categoryId: "cat-led1000-business-profile",
    priority: 9,
  },
  {
    fileName: "02-product-catalogue-demo.md",
    categoryId: "cat-led1000-product-catalogue",
    priority: 9,
  },
  {
    fileName: "03-price-list-demo.csv",
    categoryId: "cat-led1000-price-list",
    priority: 10,
  },
  {
    fileName: "04-inventory-demo.csv",
    categoryId: "cat-led1000-inventory",
    priority: 10,
  },
  {
    fileName: "05-warranty-policy-demo.md",
    categoryId: "cat-led1000-warranty",
    priority: 9,
  },
  {
    fileName: "06-return-delivery-policy-demo.md",
    categoryId: "cat-led1000-return-policy",
    priority: 8,
  },
  {
    fileName: "07-vat-invoice-guide-demo.md",
    categoryId: "cat-led1000-vat",
    priority: 9,
  },
  {
    fileName: "08-technical-consulting-guide-demo.md",
    categoryId: "cat-led1000-technical-guide",
    priority: 9,
  },
  {
    fileName: "09-customer-segments-demo.md",
    categoryId: "cat-led1000-customer-segments",
    priority: 9,
  },
  {
    fileName: "10-sales-scripts-demo.md",
    categoryId: "cat-led1000-sales-scripts",
    priority: 8,
  },
  {
    fileName: "11-channel-accounts-demo.md",
    categoryId: "cat-led1000-channel-accounts",
    priority: 6,
  },
] as const;

function contentHash(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function mimeTypeForFile(fileName: string): string {
  return fileName.endsWith(".csv") ? "text/csv" : "text/markdown";
}

async function resetKnowledgeBase() {
  const [entryCount, categoryCount] = await Promise.all([
    prisma.knowledgeEntry.count(),
    prisma.category.count(),
  ]);

  await prisma.category.deleteMany({});

  console.log(`Deleted ${categoryCount} knowledge categories.`);
  console.log(`Deleted ${entryCount} knowledge entries via category cascade.`);
}

async function createLed1000Categories() {
  for (const category of LED1000_KNOWLEDGE_CATEGORIES) {
    await prisma.category.create({ data: category });
  }

  console.log(`Created ${LED1000_KNOWLEDGE_CATEGORIES.length} LED1000 categories.`);
}

async function importMockDataset() {
  const importBatchId = randomUUID();
  const createdEntryIds: string[] = [];
  const warnings: string[] = [];
  const fileReports: Array<{ fileName: string; sections: number; categoryId: string }> = [];

  for (const item of MOCK_IMPORT_FILES) {
    const fullPath = path.join(MOCK_DATA_DIR, item.fileName);
    const buffer = readFileSync(fullPath);
    const imported = await importKnowledgeDocument(item.fileName, mimeTypeForFile(item.fileName), buffer);

    warnings.push(...imported.warnings.map((warning) => `${item.fileName}: ${warning}`));
    fileReports.push({
      fileName: item.fileName,
      sections: imported.sections.length,
      categoryId: item.categoryId,
    });

    for (let index = 0; index < imported.sections.length; index += 1) {
      const section = imported.sections[index];
      const entry = await prisma.knowledgeEntry.create({
        data: {
          categoryId: item.categoryId,
          title: section.title.slice(0, 500),
          content: section.content,
          priority: item.priority,
          isActive: true,
          metadata: {
            ...(section.metadata || {}),
            source: "led1000-mock-dataset",
            mockDataset: true,
            sourceFileName: item.fileName,
            sourceType: imported.detectedType,
            importBatchId,
            chunkIndex: index,
            chunkCount: imported.sections.length,
            contentHash: contentHash(section.content),
          },
        },
      });
      createdEntryIds.push(entry.id);
    }
  }

  console.log(`Imported ${createdEntryIds.length} mock knowledge entries.`);
  for (const report of fileReports) {
    console.log(`- ${report.fileName}: ${report.sections} entries -> ${report.categoryId}`);
  }
  for (const warning of warnings) {
    console.log(`WARNING: ${warning}`);
  }

  return createdEntryIds;
}

async function indexImportedEntries(entryIds: string[]) {
  const settings = await prisma.settings.findFirst({ select: { aiApiKey: true } });
  if (!settings?.aiApiKey) {
    console.log("Skipped embedding index: AI API key is not configured.");
    return { indexed: 0, failed: 0, skipped: entryIds.length };
  }

  let indexed = 0;
  let failed = 0;

  for (const entryId of entryIds) {
    try {
      const ok = await indexKnowledgeEntry(entryId, settings.aiApiKey);
      if (ok) {
        indexed += 1;
      } else {
        failed += 1;
      }
    } catch (error) {
      failed += 1;
      console.error(`Failed to index ${entryId}:`, error instanceof Error ? error.message : error);
    }
  }

  console.log(`Embedding index complete: indexed=${indexed}, failed=${failed}.`);
  return { indexed, failed, skipped: entryIds.length - indexed - failed };
}

async function printSummary() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      _count: { select: { entries: true } },
    },
  });
  const mockEntries = await prisma.knowledgeEntry.count({
    where: { metadata: { path: ["mockDataset"], equals: true } },
  });

  console.log("Knowledge Base summary:");
  console.log(`- categories=${categories.length}`);
  console.log(`- mockEntries=${mockEntries}`);
  for (const category of categories) {
    console.log(`- ${category.name}: ${category._count.entries} entries`);
  }
}

async function main() {
  console.log("Resetting Knowledge Base and importing LED1000 mock dataset...");
  await resetKnowledgeBase();
  await createLed1000Categories();
  const entryIds = await importMockDataset();
  await indexImportedEntries(entryIds);
  await printSummary();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
