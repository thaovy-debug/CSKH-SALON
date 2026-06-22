/**
 * Semantic Search for Knowledge Base
 *
 * Uses Gemini embeddings for vector similarity search.
 * Falls back to keyword matching when embeddings are unavailable.
 *
 * Embeddings are stored in the KnowledgeEntry metadata field as JSON.
 * For production with pgvector, store in a dedicated vector column.
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { cacheGet, cacheSet } from "@/lib/cache";
import { generateGeminiEmbedding } from "./provider";

interface SearchResult {
  id: string;
  title: string;
  content: string;
  category: string;
  score: number;
}

/**
 * Generate embedding for a text using Gemini.
 */
async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  try {
    return await generateGeminiEmbedding(text, apiKey);
  } catch (error) {
    logger.error("Failed to generate embedding:", error);
    return null;
  }
}

/**
 * Calculate cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Keyword-based search fallback.
 */
function keywordScore(query: string, text: string): number {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const textLower = text.toLowerCase();
  let matches = 0;

  for (const word of queryWords) {
    if (textLower.includes(word)) matches++;
  }

  return queryWords.length > 0 ? matches / queryWords.length : 0;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function categoryIntentBoost(query: string, category: string, title: string, content: string): number {
  const queryText = normalizeSearchText(query);
  const categoryText = normalizeSearchText(category);
  const haystack = normalizeSearchText(`${category}\n${title}\n${content}`);
  let boost = 0;

  if (/(gia|bao gia|bao nhieu|gia le|gia cong trinh|gia dai ly|chiet khau)/.test(queryText)) {
    if (/bang gia|price/.test(categoryText)) boost += 0.35;
    if (/(gia le|gia cong trinh|gia cua hang|gia dai ly|vnd|vnđ)/.test(haystack)) boost += 0.12;
  }

  if (/(ton kho|con hang|het hang|san pham thay the|thay the)/.test(queryText)) {
    if (/ton kho|inventory/.test(categoryText)) boost += 0.35;
    if (/(ton kho|con hang|het hang|san pham thay the|kha dung)/.test(haystack)) boost += 0.12;
  }

  if (/(vat|hoa don|xuat hoa don|ma so thue|mst)/.test(queryText)) {
    if (/vat|hoa don/.test(categoryText)) boost += 0.35;
  }

  if (/(bao hanh|warranty|loi|hong)/.test(queryText)) {
    if (/bao hanh/.test(categoryText)) boost += 0.3;
  }

  if (/(doi tra|giao hang|van chuyen|kiem hang)/.test(queryText)) {
    if (/doi tra|giao nhan|chinh sach/.test(categoryText)) boost += 0.25;
  }

  if (/(khach le|cong trinh|cua hang|dai ly|lay si|gia si)/.test(queryText)) {
    if (/phan loai khach hang|bang gia/.test(categoryText)) boost += 0.18;
  }

  if (/(zalo|facebook|shopee|fanpage|kenh ban)/.test(queryText)) {
    if (/tai khoan|kenh ban/.test(categoryText)) boost += 0.3;
  }

  if (/(shop|dia chi|o dau|lien he|hotline|so dien thoai|cua hang|website|email)/.test(queryText)) {
    if (/ho so doanh nghiep|business|lien he/.test(categoryText)) boost += 0.35;
    if (/(dia chi|hotline|zalo|email|website|vuon lai|tan phu|tp\.?hcm|ho chi minh)/.test(haystack)) boost += 0.12;
  }

  if (/(ngoai troi|hat tran|bang hieu|chon nguon|cong suat|dien ap|ky thuat|lap dat)/.test(queryText)) {
    if (/tu van ky thuat/.test(categoryText)) boost += 0.18;
  }

  return Math.min(boost, 0.45);
}

/**
 * Search the knowledge base semantically.
 * Uses embeddings when available, falls back to keyword matching.
 */
export async function searchKnowledgeBase(query: string, limit = 5): Promise<SearchResult[]> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: { isActive: true },
    include: { category: { select: { name: true } } },
  });

  if (entries.length === 0) return [];

  // Try to get API key for embeddings
  const settings = await prisma.settings.findFirst({
    select: { aiApiKey: true },
  });

  let results: SearchResult[];

  if (settings?.aiApiKey) {
    // Try semantic search with embeddings
    const cacheKey = `embedding:${Buffer.from(query).toString("base64").substring(0, 50)}`;
    let queryEmbedding: number[] | null = null;

    const cached = await cacheGet(cacheKey);
    if (cached) {
      queryEmbedding = JSON.parse(cached);
    } else {
      queryEmbedding = await generateEmbedding(query, settings.aiApiKey);
      if (queryEmbedding) {
        await cacheSet(cacheKey, JSON.stringify(queryEmbedding), 3600);
      }
    }

    if (queryEmbedding) {
      // Score entries using embeddings (stored in metadata) + keyword fallback
      results = entries.map((entry) => {
        const metadata = entry.metadata as Record<string, unknown> | null;
        const entryEmbedding = metadata?.embedding as number[] | null;

        let score: number;
        const keyword = keywordScore(query, `${entry.title} ${entry.content}`);
        if (entryEmbedding) {
          score = cosineSimilarity(queryEmbedding!, entryEmbedding);
          score = score * 0.72 + keyword * 0.28;
        } else {
          // Fallback to keyword matching for entries without embeddings
          score = keyword;
        }
        score += categoryIntentBoost(query, entry.category.name, entry.title, entry.content);

        return {
          id: entry.id,
          title: entry.title,
          content: entry.content,
          category: entry.category.name,
          score,
        };
      });
    } else {
      // Embedding generation failed, use keyword search
      results = keywordSearch(entries, query);
    }
  } else {
    // No API key, use keyword search
    results = keywordSearch(entries, query);
  }

  return results
    .filter((r) => r.score > 0.1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function keywordSearch(
  entries: Array<{
    id: string;
    title: string;
    content: string;
    category: { name: string };
  }>,
  query: string
): SearchResult[] {
  return entries.map((entry) => {
    const keyword = keywordScore(query, `${entry.title} ${entry.content}`);
    const boost = categoryIntentBoost(query, entry.category.name, entry.title, entry.content);

    return {
      id: entry.id,
      title: entry.title,
      content: entry.content,
      category: entry.category.name,
      score: keyword + boost,
    };
  });
}

/**
 * Generate and store embedding for a knowledge entry.
 */
export async function indexKnowledgeEntry(entryId: string, apiKey: string): Promise<boolean> {
  const entry = await prisma.knowledgeEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry) return false;

  const text = `${entry.title}\n${entry.content}`;
  const embedding = await generateEmbedding(text, apiKey);

  if (!embedding) return false;

  const currentMetadata = (entry.metadata as Record<string, unknown>) || {};

  await prisma.knowledgeEntry.update({
    where: { id: entryId },
    data: {
      metadata: { ...currentMetadata, embedding },
    },
  });

  return true;
}
