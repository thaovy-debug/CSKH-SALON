import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  LED1000_KNOWLEDGE_CATEGORIES,
  LED1000_KNOWLEDGE_TEMPLATE_ENTRIES,
} from "../src/lib/knowledge/led1000-taxonomy";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/linhkienled1000?schema=public";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  for (const category of LED1000_KNOWLEDGE_CATEGORIES) {
    await prisma.category.upsert({
      where: { id: category.id },
      update: category,
      create: category,
    });
  }

  for (const entry of LED1000_KNOWLEDGE_TEMPLATE_ENTRIES) {
    await prisma.knowledgeEntry.upsert({
      where: { id: entry.id },
      update: { ...entry, isActive: true },
      create: { ...entry, isActive: true },
    });
  }

  console.log(`Upserted ${LED1000_KNOWLEDGE_CATEGORIES.length} LED1000 knowledge categories.`);
  console.log(`Upserted ${LED1000_KNOWLEDGE_TEMPLATE_ENTRIES.length} LED1000 template entries.`);

  const categoryIds = LED1000_KNOWLEDGE_CATEGORIES.map((category) => category.id);
  const templateEntryIds = LED1000_KNOWLEDGE_TEMPLATE_ENTRIES.map((entry) => entry.id);
  const [categories, activeTemplateEntries] = await Promise.all([
    prisma.category.findMany({
      where: { id: { in: categoryIds } },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        name: true,
        _count: { select: { entries: true } },
      },
    }),
    prisma.knowledgeEntry.count({
      where: { id: { in: templateEntryIds }, isActive: true },
    }),
  ]);

  console.log(
    `Verified ${categories.length}/${LED1000_KNOWLEDGE_CATEGORIES.length} categories in database.`
  );
  console.log(
    `Verified ${activeTemplateEntries}/${LED1000_KNOWLEDGE_TEMPLATE_ENTRIES.length} active template entries in database.`
  );
  for (const category of categories) {
    console.log(`- ${category.name}: ${category._count.entries} entries`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
