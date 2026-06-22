import { readFileSync, readdirSync } from "fs";
import path from "path";
import { importKnowledgeDocument } from "../src/lib/knowledge/import";

const MOCK_DATA_DIR = path.join("data", "knowledge", "mock-led1000");

async function main() {
  const files = readdirSync(MOCK_DATA_DIR)
    .filter((file) => /\.(md|csv)$/i.test(file) && file !== "README.md")
    .sort();

  let totalSections = 0;

  for (const file of files) {
    const fullPath = path.join(MOCK_DATA_DIR, file);
    const buffer = readFileSync(fullPath);
    const mimeType = file.endsWith(".csv") ? "text/csv" : "text/markdown";
    const imported = await importKnowledgeDocument(file, mimeType, buffer);
    totalSections += imported.sections.length;
    console.log(`${file}: ${imported.detectedType}, ${imported.sections.length} sections`);
  }

  console.log(`TOTAL_FILES=${files.length}`);
  console.log(`TOTAL_SECTIONS=${totalSections}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
