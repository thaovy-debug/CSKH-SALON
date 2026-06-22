import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/linhkienled1000?schema=public";

const apiKey = process.env.GEMINI_API_KEY_OVERRIDE || process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY_OVERRIDE or GEMINI_API_KEY.");
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

async function main() {
  await prisma.settings.upsert({
    where: { id: "default" },
    update: { aiApiKey: apiKey },
    create: {
      id: "default",
      aiApiKey: apiKey,
    },
  });

  console.log("Gemini API key updated in local settings.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
