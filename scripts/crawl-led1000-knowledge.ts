import { createHash } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

type PageType =
  | "home"
  | "contact"
  | "policy"
  | "catalogue"
  | "product_category"
  | "product_listing"
  | "product"
  | "unknown";

interface CrawlOptions {
  maxPages: number;
  delayMs: number;
  timeoutMs: number;
  startUrl: string;
  markdownOutput: string;
  jsonOutput: string;
  reportOutput: string;
}

interface CrawlPage {
  title: string;
  url: string;
  type: PageType;
  category: string;
  content: string;
  crawledAt: string;
}

interface QueueItem {
  url: string;
  priority: number;
}

interface CrawlStats {
  pagesFetched: number;
  skippedUrlsCount: number;
  duplicatesRemoved: number;
}

interface CrawlResult {
  pages: CrawlPage[];
  stats: CrawlStats;
}

interface QualityReport {
  generatedAt: string;
  pagesCrawled: number;
  recordsExported: number;
  recordsByType: Record<PageType, number>;
  skippedUrlsCount: number;
  duplicatesRemoved: number;
  averageContentLength: number;
  recordsWithHtmlEntitiesRemaining: number;
  recordsWithVeryShortContent: number;
  outputs: {
    markdown: string;
    json: string;
    report: string;
  };
}

const CANONICAL_HOST = "linhkienled1000.com";
const DEFAULT_START_URL = "https://linhkienled1000.com/";
const DEFAULT_MARKDOWN_OUTPUT = "data/knowledge/led1000-website.md";
const DEFAULT_JSON_OUTPUT = "data/knowledge/led1000-website.json";
const DEFAULT_REPORT_OUTPUT = "data/knowledge/led1000-crawl-report.json";
const VERY_SHORT_CONTENT_LENGTH = 200;

const SKIP_PATH_PATTERN =
  /(?:\/|^)(cart|gio-hang|checkout|thanh-toan|account|tai-khoan|login|dang-nhap|register|search|tim-kiem|wishlist|compare|wp-admin|wp-login|add-to-cart)(?:\/|$|[?&=])/i;
const SKIP_FILE_PATTERN = /\.(?:jpg|jpeg|png|gif|webp|svg|ico|pdf|zip|rar|7z|css|js|mp4|mp3|avi|mov|woff2?|ttf|eot)(?:$|\?)/i;
const TRACKING_PARAM_PATTERN = /^(utm_|fbclid$|gclid$|yclid$|mc_|ref$|source$)/i;
const PRICE_PATTERN = /\d{1,3}(?:[.,]\d{3})+\s*(?:đ|Đ|vnd|VND)|\d+\s*(?:đ|Đ|vnd|VND)/;
const HTML_ENTITY_PATTERN = /&(?:[a-zA-Z][a-zA-Z0-9]+|#\d+|#x[0-9a-fA-F]+);/;
const MAIN_CATEGORY_LINES = [
  "NGUỒN TỔNG DC",
  "ĐÈN LED DÂY",
  "ĐÈN LED THANH",
  "LED QUẢNG CÁO",
  "BÓNG ĐÈN LED",
  "ĐÈN ÂM TRẦN",
  "ĐÈN ỐP TRẦN",
  "ĐÈN LED PANEL",
  "ĐÈN TUÝP LED",
  "ĐÈN RỌI RAY",
  "ĐÈN PHA LED",
  "ĐÈN ĐƯỜNG LED",
  "ĐÈN NHÀ XƯỞNG",
  "ĐÈN NĂNG LƯỢNG MẶT TRỜI",
  "ĐÈN LED DÙNG PIN",
  "ĐÈN CẢM ỨNG",
  "ĐÈN BÁO SỰ CỐ LTP",
  "ĐÈN ÂM NƯỚC LTP",
  "NGÔI SAO NOEL LTP",
  "CÂY HOA ĐÈN LED",
  "CÂY THÔNG NOEL",
  "ĐÈN TRANG TRÍ NOEL",
  "ĐÈN LED NEON HÌNH LTP",
  "ĐÈN TRANG TRÍ",
  "LINH KIỆN ĐÈN LED LTP",
  "PHỤ KIỆN ĐÈN LED LTP",
  "DỤNG CỤ & THIẾT BỊ ĐIỆN TỬ LTP",
  "VẬT PHẨM TRANG TRÍ",
  "LỒNG ĐÈN TRANG TRÍ",
];

const BUSINESS_PROFILE_LINES = [
  "Tên doanh nghiệp: LED1000 / Linh Kiện LED1000",
  "Công ty: Chi nhánh CTY TNHH TM DV QC Long Thịnh Phát",
  "Website: https://linhkienled1000.com/",
  "Ngành hàng: Đèn LED, nguồn điện, linh kiện LED, phụ kiện chiếu sáng, đèn trang trí",
  "Hotline/Zalo: 0909003082, 0972 90 25 25",
  "Địa chỉ: 207 Vườn Lài, Phú Thọ Hòa, Q. Tân Phú, TP.HCM",
  "Email: [email protected]",
  "Ghi chú: Một số thông tin liên hệ được trích từ nội dung website crawl; cần khách xác nhận trước khi dùng production.",
];

const CONTACT_FALLBACK_LINES = [
  "Tên doanh nghiệp: LED1000 / Linh Kiện LED1000",
  "Công ty: Chi nhánh CTY TNHH TM DV QC Long Thịnh Phát",
  "Hotline/Zalo: 0909003082, 0972 90 25 25",
  "Địa chỉ: 207 Vườn Lài, Phú Thọ Hòa, Q. Tân Phú, TP.HCM",
  "Email: [email protected]",
  "Ghi chú: Thông tin liên hệ cần khách xác nhận trước khi dùng production.",
];

const NAMED_HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  copy: "©",
  reg: "®",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  times: "×",
  agrave: "à",
  aacute: "á",
  acirc: "â",
  atilde: "ã",
  egrave: "è",
  eacute: "é",
  ecirc: "ê",
  igrave: "ì",
  iacute: "í",
  ograve: "ò",
  oacute: "ó",
  ocirc: "ô",
  otilde: "õ",
  ugrave: "ù",
  uacute: "ú",
  yacute: "ý",
  ccedil: "ç",
  Agrave: "À",
  Aacute: "Á",
  Acirc: "Â",
  Atilde: "Ã",
  Egrave: "È",
  Eacute: "É",
  Ecirc: "Ê",
  Igrave: "Ì",
  Iacute: "Í",
  Ograve: "Ò",
  Oacute: "Ó",
  Ocirc: "Ô",
  Otilde: "Õ",
  Ugrave: "Ù",
  Uacute: "Ú",
  Yacute: "Ý",
  Ccedil: "Ç",
};

function parseArgs(argv: string[]): CrawlOptions {
  const options: CrawlOptions = {
    maxPages: 80,
    delayMs: 600,
    timeoutMs: 15000,
    startUrl: DEFAULT_START_URL,
    markdownOutput: DEFAULT_MARKDOWN_OUTPUT,
    jsonOutput: DEFAULT_JSON_OUTPUT,
    reportOutput: DEFAULT_REPORT_OUTPUT,
  };

  for (const arg of argv) {
    const [key, rawValue] = arg.replace(/^--/, "").split("=");
    const value = rawValue?.trim();
    if (!key || value === undefined) continue;

    if (key === "max-pages") options.maxPages = clampPositiveInteger(value, 80);
    if (key === "delay-ms") options.delayMs = clampPositiveInteger(value, 600);
    if (key === "timeout-ms") options.timeoutMs = clampPositiveInteger(value, 15000);
    if (key === "start-url") options.startUrl = value;
    if (key === "out-md") options.markdownOutput = value;
    if (key === "out-json") options.jsonOutput = value;
    if (key === "out-report") options.reportOutput = value;
  }

  return options;
}

function clampPositiveInteger(value: string, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

function isAllowedHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^www\./, "");
  return normalized === CANONICAL_HOST;
}

function normalizeUrl(rawUrl: string, baseUrl = DEFAULT_START_URL): string | null {
  try {
    const url = new URL(rawUrl, baseUrl);
    url.hash = "";

    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (!isAllowedHost(url.hostname)) return null;

    url.protocol = "https:";
    url.hostname = CANONICAL_HOST;

    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAM_PATTERN.test(key) || key.toLowerCase().includes("add-to-cart")) {
        url.searchParams.delete(key);
      }
    }

    if (url.searchParams.toString()) return null;
    if (shouldSkipUrl(url.toString())) return null;

    let normalized = url.toString();
    if (normalized.endsWith("/") && url.pathname !== "/") {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return null;
  }
}

function shouldSkipUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return SKIP_PATH_PATTERN.test(lower) || SKIP_FILE_PATTERN.test(lower);
}

function classifyPage(url: string, title: string, h1: string, content: string): PageType {
  const pathname = new URL(url).pathname.toLowerCase();
  const haystack = `${pathname} ${title} ${h1} ${content.slice(0, 800)}`.toLowerCase();

  if (pathname === "/" || pathname === "") return "home";
  if (/^\/san-pham(?:\/\d+)?\/?$/.test(pathname)) return "product_listing";
  if (/lien-he|contact|he-thong-cua-hang|gioi-thieu/.test(haystack)) return "contact";
  if (/chinh-sach|bao-hanh|doi-tra|van-chuyen|giao-hang|thanh-toan|terms|privacy|policy/.test(haystack)) {
    return "policy";
  }
  if (/catalogue|catalog|bang-gia|bao-gia|tai-lieu|download/.test(haystack)) return "catalogue";
  if (contentHasProductSignals(content) || /san-pham|product|products/.test(pathname)) return "product";
  if (/danh-muc|category|product-category|collections|collection|nhom-san-pham/.test(haystack)) {
    return "product_category";
  }
  if (MAIN_CATEGORY_LINES.some((category) => normalizeTextKey(category) === normalizeTextKey(title))) return "product_category";
  if (/Lượt mua:|Chi tiết/i.test(content) && PRICE_PATTERN.test(content)) return "product_category";
  if (/nguồn|đèn|led|adapter|silicon|thanh nhôm|bóng đèn|phụ kiện|cây thông|noel/i.test(title)) return "product_category";

  return "unknown";
}

function contentHasProductSignals(content: string): boolean {
  return /Mã sản phẩm|Giá:|Chính Sách Giao Hàng|Hotline:/i.test(content) && PRICE_PATTERN.test(content);
}

function linkPriority(url: string, anchorText: string): number {
  const pathname = new URL(url).pathname.toLowerCase();
  const haystack = `${pathname} ${anchorText}`.toLowerCase();

  if (pathname === "/") return 100;
  if (/lien-he|contact|gioi-thieu/.test(haystack)) return 95;
  if (/^\/san-pham\/?$/.test(pathname)) return 92;
  if (/^\/san-pham\/\d+\/?$/.test(pathname)) return 55;
  if (/danh-muc|category|product-category|collections|collection|san-pham|product/.test(haystack)) return 90;
  if (/chinh-sach|bao-hanh|doi-tra|van-chuyen|giao-hang|thanh-toan/.test(haystack)) return 85;
  if (/catalogue|catalog|bang-gia|bao-gia/.test(haystack)) return 80;
  if (/led|nguon|nguồn|module|day|dây|den|đèn|adapter|silicon|thanh nhôm|phu kien|phụ kiện|noel|năng lượng|trang trí/.test(haystack)) {
    return 88;
  }
  return 30;
}

async function fetchHtml(url: string, timeoutMs: number): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "LinhKienLed1000 LED1000 one-time knowledge crawler/1.1",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    if (!response.ok) {
      console.warn(`Skip ${url}: HTTP ${response.status}`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html")) {
      console.warn(`Skip ${url}: content-type=${contentType || "unknown"}`);
      return null;
    }

    const normalizedFinalUrl = normalizeUrl(response.url, url);
    if (!normalizedFinalUrl) {
      console.warn(`Skip ${url}: redirected outside allowed domain`);
      return null;
    }

    return {
      html: await response.text(),
      finalUrl: normalizedFinalUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Skip ${url}: ${message}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractTitle(html: string): string {
  const h1 = extractFirstTagText(html, "h1");
  if (h1) return h1;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return cleanInlineText(decodeHtml(titleMatch?.[1] || "LED1000 Website Page"));
}

function extractFirstTagText(html: string, tagName: string): string {
  const match = html.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return cleanInlineText(decodeHtml(stripTags(match?.[1] || "")));
}

function extractBreadcrumbs(html: string): string[] {
  const blocks = html.match(
    /<(?:nav|div|ul|ol)[^>]*(?:breadcrumb|breadcrumbs|woocommerce-breadcrumb|rank-math-breadcrumb)[^>]*>[\s\S]*?<\/(?:nav|div|ul|ol)>/gi
  ) || [];

  for (const block of blocks) {
    const text = htmlBlockToText(block);
    const parts = text
      .split(/\n|›|»|>|\/|\\/g)
      .map(cleanInlineText)
      .filter((part) => part && !/^home|trang chủ$/i.test(part));
    if (parts.length > 0) return [...new Set(parts)];
  }

  return [];
}

function extractLinks(html: string, baseUrl: string): QueueItem[] {
  const links: QueueItem[] = [];
  const anchorPattern = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'<>`]+))[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(anchorPattern)) {
    const href = match[1] || match[2] || match[3] || "";
    const anchorText = cleanInlineText(decodeHtml(stripTags(match[4] || "")));
    const normalized = normalizeUrl(href, baseUrl);
    if (!normalized) continue;
    links.push({ url: normalized, priority: linkPriority(normalized, anchorText) });
  }

  return links;
}

function htmlBlockToText(html: string): string {
  const withBreaks = html
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|div|li|tr|h[1-6]|section|article|td|th)>/gi, "\n");
  return decodeHtml(stripTags(withBreaks));
}

function cleanMainContent(html: string): string {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch?.[1] || html;

  body = body
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
    .replace(/<(header|footer|nav|aside|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*(?:class|id)=["'][^"']*(?:menu|navbar|nav-|header|footer|sidebar|breadcrumb|breadcrumbs|search|cart|account|social|pagination|popup|modal|cookie)[^"']*["'][\s\S]*?<\/[^>]+>/gi, " ");

  const text = htmlBlockToText(body);
  const seenLines = new Set<string>();

  return text
    .split(/\n+/)
    .map((line) => cleanInlineText(decodeHtml(line)))
    .filter((line) => line.length >= 3)
    .filter((line) => !isBoilerplateLine(line))
    .filter((line) => {
      const key = line.toLowerCase();
      if (seenLines.has(key)) return false;
      seenLines.add(key);
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function preparePageContent(content: string, title: string, type: PageType, url: string, breadcrumbs: string[]): string {
  const decoded = decodeHtml(content);
  const focused = focusPageContent(decoded, title, type);

  if (type === "contact") return compactContactContent(focused);
  if (type === "product_listing") return compactProductListingContent(focused, url);
  if (type === "product") return compactProductDetailContent(focused, title, url, breadcrumbs);
  if (type === "home") return compactHomeContent(focused);
  if (type === "product_category") return compactProductCategoryContent(focused, title, url);
  return compactGenericContent(focused, 9000);
}

function focusPageContent(content: string, title: string, type: PageType): string {
  const lines = content
    .split(/\n+/)
    .map((line) => cleanInlineText(decodeHtml(line)))
    .filter(Boolean);
  const normalizedTitle = normalizeTextKey(title);

  let focusedLines = lines;
  if (type !== "home") {
    focusedLines = stripRepeatedProductMenu(lines, normalizedTitle);
  }

  const footerIndex = focusedLines.findIndex((line, index) => {
    if (index < 3) return false;
    return /^Sản phẩm LED1000\b/i.test(line) || /^Catalogue LTP$/i.test(line) || /^Chính Sách LED1000$/i.test(line);
  });

  if (footerIndex > 0 && type !== "contact") {
    focusedLines = focusedLines.slice(0, footerIndex);
  }

  return focusedLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function stripRepeatedProductMenu(lines: string[], normalizedTitle: string): string[] {
  if (normalizeTextKey(lines[0] || "") !== "danh muc san pham") return lines;

  const firstContentIndex = lines.findIndex((line, index) => {
    if (index <= 5) return false;
    const key = normalizeTextKey(line);
    return (
      key === normalizedTitle ||
      key === "san pham" ||
      key === "lien he" ||
      key.startsWith("chinh sach") ||
      key.includes("ma san pham") ||
      PRICE_PATTERN.test(line)
    );
  });

  return firstContentIndex > 0 ? lines.slice(firstContentIndex) : lines;
}

function compactHomeContent(content: string): string {
  const lines = content.split(/\n+/).filter(Boolean);
  const startIndexes = [
    lines.findIndex((line) => /^Sản phẩm mới$/i.test(line)),
    lines.findIndex((line) => /^Sản phẩm nổi bật$/i.test(line)),
  ].filter((index) => index > 0);
  const firstProductIndex = startIndexes.length > 0 ? Math.min(...startIndexes) : -1;
  const keptLines = firstProductIndex > 0 ? lines.slice(firstProductIndex, firstProductIndex + 90) : lines.slice(0, 120);
  return compactGenericContent(keptLines.join("\n"), 5500);
}

function compactContactContent(content: string): string {
  const detectedLines = content
    .split(/\n+/)
    .map(cleanInlineText)
    .filter((line) => /liên hệ|bản đồ|hotline|zalo|địa chỉ|email|0909|0972|028|207 Vườn Lài/i.test(line));

  const merged = [...CONTACT_FALLBACK_LINES, ...detectedLines];
  return uniqueLines(merged).join("\n");
}

function compactProductListingContent(content: string, url: string): string {
  const pageNumber = productListingPageNumber(url);
  const lines = content.split(/\n+/).map(cleanInlineText).filter(Boolean);
  const categoryLines = uniqueLines(lines.filter((line) => MAIN_CATEGORY_LINES.includes(line))).slice(0, 10);
  const lastCategoryIndex = lines.reduce((lastIndex, line, index) => (MAIN_CATEGORY_LINES.includes(line) ? index : lastIndex), -1);
  const firstUsefulIndex = lines.findIndex((line, index) => {
    if (index <= lastCategoryIndex) return false;
    return isUsefulListingLine(line);
  });
  const productLines = lines
    .slice(firstUsefulIndex > 0 ? firstUsefulIndex : Math.max(lastCategoryIndex + 1, 1))
    .filter((line) => isUsefulListingLine(line))
    .slice(0, 95);

  const output = [
    pageNumber ? `Danh sách sản phẩm - trang ${pageNumber}` : "Danh sách sản phẩm",
    `Source URL: ${url}`,
    "Nguồn dữ liệu: trang listing sản phẩm trên website LED1000.",
    "",
    "Nhóm sản phẩm xuất hiện trên trang:",
    ...categoryLines.map((line) => `- ${line}`),
    "",
    "Sản phẩm và giá hiển thị:",
    ...productLines.map((line) => `- ${line}`),
  ];

  return compactGenericContent(output.join("\n"), 6500);
}

function compactProductCategoryContent(content: string, title: string, url: string): string {
  const lines = content.split(/\n+/).map(cleanInlineText).filter(Boolean);
  const productSectionIndex = lines.findIndex((line, index) => index > 0 && /^Sản phẩm$/i.test(line));
  const sourceLines = productSectionIndex > 0 ? lines.slice(productSectionIndex + 1) : lines.slice(1);
  const usefulLines = sourceLines
    .filter((line) => isUsefulListingLine(line))
    .slice(0, 120);
  const productLines =
    usefulLines.length > 0
      ? usefulLines.map((line) => `- ${line}`)
      : [
          "- Chưa crawl được sản phẩm/giá cụ thể trong trang nhóm này.",
          "- Giữ record để Knowledge Base biết URL nhóm sản phẩm tồn tại trên website.",
          "- Cần khách xác nhận hoặc upload bảng giá/catalogue chính thức nếu muốn bot báo giá nhóm này.",
        ];

  return compactGenericContent(
    [
      `Nhóm sản phẩm: ${title}`,
      `Source URL: ${url}`,
      "",
      "Sản phẩm/giá hiển thị trên trang nhóm:",
      ...productLines,
    ].join("\n"),
    8000
  );
}

function compactProductDetailContent(content: string, title: string, url: string, breadcrumbs: string[]): string {
  const lines = removeTrailingRelatedProducts(content.split(/\n+/).map(cleanInlineText).filter(Boolean));
  const selected = new Set<string>();
  const output: string[] = [`Tên sản phẩm: ${title}`, `Source URL: ${url}`];
  const category = breadcrumbs.length > 0 ? breadcrumbs.join(" > ") : "";

  if (category) output.push(`Danh mục: ${category}`);

  const skuIndex = lines.findIndex((line) => /^Mã sản phẩm:?$/i.test(line) || /^Mã sản phẩm:/i.test(line));
  if (skuIndex >= 0) {
    const skuValue = lines[skuIndex].includes(":") ? lines[skuIndex].replace(/^Mã sản phẩm:\s*/i, "") : lines[skuIndex + 1];
    if (skuValue) output.push(`Mã sản phẩm: ${skuValue}`);
  }

  const priceIndex = lines.findIndex((line) => /^Giá:?$/i.test(line) || /^Giá:/i.test(line));
  const priceLines = uniqueLines(lines.filter((line) => PRICE_PATTERN.test(line))).slice(0, 4);
  if (priceIndex >= 0 && lines[priceIndex + 1]) output.push(`Giá: ${lines[priceIndex + 1]}`);
  for (const line of priceLines) {
    if (!output.some((item) => item.includes(line))) output.push(`Giá hiển thị: ${line}`);
  }

  const hotline = lines.find((line) => /hotline|0909|0972/i.test(line));
  if (hotline) output.push(`Hotline/Zalo trên trang: ${hotline}`);

  const shippingIndex = lines.findIndex((line) => /Chính Sách Giao Hàng|PHƯƠNG THỨC GIAO HÀNG|giao hàng|ship/i.test(line));
  if (shippingIndex >= 0) {
    output.push("", "Thông tin giao hàng/chính sách trên trang:");
    for (const line of lines.slice(shippingIndex, shippingIndex + 16)) {
      if (line && !selected.has(line)) {
        output.push(line);
        selected.add(line);
      }
    }
  }

  output.push("", "Mô tả sản phẩm:");
  for (const line of lines) {
    if (!isUsefulProductDescriptionLine(line, title)) continue;
    if (selected.has(line)) continue;
    output.push(line);
    selected.add(line);
    if (output.join("\n").length > 9000) break;
  }

  return compactGenericContent(output.join("\n"), 10000);
}

function compactGenericContent(content: string, maxLength: number): string {
  const lines = uniqueLines(
    decodeHtml(content)
      .split(/\n+/)
      .map(cleanInlineText)
      .filter((line) => line.length >= 2)
      .filter((line) => !isBoilerplateLine(line))
  );

  let output = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  if (output.length > maxLength) {
    output = `${output.slice(0, maxLength).replace(/\s+\S*$/, "")}\n[Đã rút gọn nội dung dài cho Knowledge Base]`;
  }
  return output;
}

function removeTrailingRelatedProducts(lines: string[]): string[] {
  const trailingIndex = lines.findIndex((line, index) => {
    if (index < 15) return false;
    return /^Sản phẩm mới$/i.test(line) || /^Sản phẩm nổi bật$/i.test(line) || /^Sản phẩm khác$/i.test(line);
  });
  return trailingIndex > 0 ? lines.slice(0, trailingIndex) : lines;
}

function isLikelyProductLine(line: string): boolean {
  if (PRICE_PATTERN.test(line)) return true;
  if (/^-\d+%$/.test(line)) return false;
  return /led|đèn|nguồn|adapter|silicon|thanh nhôm|công tắc|ổ cắm|phụ kiện|cây thông|lồng đèn|combo/i.test(line);
}

function isUsefulListingLine(line: string): boolean {
  if (/^Sản phẩm$/i.test(line)) return false;
  if (/^Chi tiết$/i.test(line)) return false;
  if (/^Lượt mua:/i.test(line)) return true;
  if (/^-\d+%$/.test(line)) return true;
  if (PRICE_PATTERN.test(line)) return true;
  if (MAIN_CATEGORY_LINES.includes(line)) return false;
  return line.length >= 4;
}

function isUsefulProductDescriptionLine(line: string, title: string): boolean {
  if (/^Chi tiết$|^Lượt mua:|^Sản phẩm$|^Danh mục sản phẩm$/i.test(line)) return false;
  if (MAIN_CATEGORY_LINES.includes(line)) return false;
  if (normalizeTextKey(line) === normalizeTextKey(title)) return false;
  if (/^Mã sản phẩm:?$|^Giá:?$/i.test(line)) return false;
  return line.length >= 4;
}

function productListingPageNumber(url: string): string {
  const match = new URL(url).pathname.match(/^\/san-pham\/(\d+)\/?$/);
  return match?.[1] || "";
}

function titleForExport(title: string, type: PageType, url: string): string {
  if (type === "product_listing") {
    const pageNumber = productListingPageNumber(url);
    return pageNumber ? `Sản phẩm - Trang ${pageNumber}` : "Sản phẩm - Trang 1";
  }
  return title;
}

function normalizeTextKey(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueLines(lines: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const line of lines) {
    const key = normalizeTextKey(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(line);
  }

  return output;
}

function isBoilerplateLine(line: string): boolean {
  return /^(menu|home|trang chủ|login|đăng nhập|cart|giỏ hàng|checkout|copyright|all rights reserved|facebook|youtube|zalo|sms|xem thêm)$/i.test(
    line
  );
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function cleanInlineText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\u0000/g, "").trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => safeCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code: string) => safeCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (match, entity: string) => NAMED_HTML_ENTITIES[entity] ?? match);
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  return String.fromCodePoint(code);
}

function contentHash(content: string): string {
  return createHash("sha256").update(content.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
}

function categoryFrom(type: PageType, breadcrumbs: string[], title: string): string {
  if (type === "product_listing") return "Product Listings";
  if (breadcrumbs.length >= 2) return breadcrumbs[breadcrumbs.length - 2];
  if (breadcrumbs.length === 1) return breadcrumbs[0];

  const labels: Record<PageType, string> = {
    home: "Business Profile",
    contact: "Contact",
    policy: "Policies",
    catalogue: "Catalogue",
    product_category: "Product Categories",
    product_listing: "Product Listings",
    product: "Products",
    unknown: "Website",
  };

  if (type === "product_category" && title) return title;
  return labels[type];
}

function sortPagesForExport(pages: CrawlPage[]): CrawlPage[] {
  const order: Record<PageType, number> = {
    home: 0,
    contact: 1,
    product_category: 2,
    product_listing: 3,
    catalogue: 4,
    product: 5,
    policy: 6,
    unknown: 7,
  };

  return [...pages].sort((a, b) => order[a.type] - order[b.type] || a.title.localeCompare(b.title, "vi"));
}

function buildMarkdown(pages: CrawlPage[], startedAt: string): string {
  const sortedPages = sortPagesForExport(pages);
  const categoryLines = extractProductCategoryLines(sortedPages);

  const lines = ["# LED1000 Website Knowledge Base", "", "## Business Profile", "", ...BUSINESS_PROFILE_LINES, "", `Crawled at: ${startedAt}`, ""];

  lines.push("## Product Categories", "");
  if (categoryLines.length > 0) {
    for (const category of categoryLines) lines.push(`- ${category}`);
  } else {
    for (const category of MAIN_CATEGORY_LINES) lines.push(`- ${category}`);
  }
  lines.push("");

  for (const page of sortedPages) {
    lines.push(
      `## Page: ${page.title}`,
      `Source: ${page.url}`,
      `Type: ${page.type}`,
      `Category: ${page.category}`,
      "",
      page.content,
      ""
    );
  }

  return `${lines.join("\n").replace(/\n{4,}/g, "\n\n\n").trim()}\n`;
}

function extractProductCategoryLines(pages: CrawlPage[]): string[] {
  const collected = new Set<string>();
  const home = pages.find((page) => page.type === "home");
  const sourceLines = home?.content.split(/\n+/) || [];

  for (const line of [...MAIN_CATEGORY_LINES, ...sourceLines]) {
    if (MAIN_CATEGORY_LINES.includes(line)) collected.add(line);
  }

  return [...collected];
}

function buildQualityReport(pages: CrawlPage[], stats: CrawlStats, options: CrawlOptions, generatedAt: string): QualityReport {
  const recordsByType = emptyTypeCounts();
  for (const page of pages) recordsByType[page.type] += 1;

  const totalContentLength = pages.reduce((sum, page) => sum + page.content.length, 0);

  return {
    generatedAt,
    pagesCrawled: stats.pagesFetched,
    recordsExported: pages.length,
    recordsByType,
    skippedUrlsCount: stats.skippedUrlsCount,
    duplicatesRemoved: stats.duplicatesRemoved,
    averageContentLength: pages.length > 0 ? Math.round(totalContentLength / pages.length) : 0,
    recordsWithHtmlEntitiesRemaining: pages.filter((page) => HTML_ENTITY_PATTERN.test(page.content)).length,
    recordsWithVeryShortContent: pages.filter((page) => page.content.length < VERY_SHORT_CONTENT_LENGTH).length,
    outputs: {
      markdown: options.markdownOutput,
      json: options.jsonOutput,
      report: options.reportOutput,
    },
  };
}

function emptyTypeCounts(): Record<PageType, number> {
  return {
    home: 0,
    contact: 0,
    policy: 0,
    catalogue: 0,
    product_category: 0,
    product_listing: 0,
    product: 0,
    unknown: 0,
  };
}

async function writeOutputs(pages: CrawlPage[], options: CrawlOptions, startedAt: string, stats: CrawlStats): Promise<QualityReport> {
  const report = buildQualityReport(pages, stats, options, startedAt);
  await Promise.all([
    mkdir(path.dirname(options.markdownOutput), { recursive: true }),
    mkdir(path.dirname(options.jsonOutput), { recursive: true }),
    mkdir(path.dirname(options.reportOutput), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(options.markdownOutput, buildMarkdown(pages, startedAt), "utf8"),
    writeFile(options.jsonOutput, `${JSON.stringify(sortPagesForExport(pages), null, 2)}\n`, "utf8"),
    writeFile(options.reportOutput, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
  ]);

  return report;
}

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueue(queue: QueueItem[], queued: Set<string>, item: QueueItem) {
  if (queued.has(item.url)) return;
  queued.add(item.url);
  queue.push(item);
}

async function crawl(options: CrawlOptions): Promise<CrawlResult> {
  const startUrl = normalizeUrl(options.startUrl);
  if (!startUrl) {
    throw new Error(`Invalid start URL: ${options.startUrl}`);
  }

  const queue: QueueItem[] = [{ url: startUrl, priority: 100 }];
  const queued = new Set<string>([startUrl]);
  const visited = new Set<string>();
  const hashes = new Set<string>();
  const pages: CrawlPage[] = [];
  const stats: CrawlStats = {
    pagesFetched: 0,
    skippedUrlsCount: 0,
    duplicatesRemoved: 0,
  };

  while (queue.length > 0 && pages.length < options.maxPages) {
    queue.sort((a, b) => b.priority - a.priority);
    const current = queue.shift();
    if (!current || visited.has(current.url)) continue;

    visited.add(current.url);
    console.log(`[${pages.length + 1}/${options.maxPages}] Fetch ${current.url}`);

    const fetched = await fetchHtml(current.url, options.timeoutMs);
    if (!fetched) {
      stats.skippedUrlsCount += 1;
      await sleep(options.delayMs);
      continue;
    }
    stats.pagesFetched += 1;

    const normalizedFinalUrl = fetched.finalUrl;
    if (visited.has(normalizedFinalUrl) && normalizedFinalUrl !== current.url) {
      stats.skippedUrlsCount += 1;
      await sleep(options.delayMs);
      continue;
    }
    visited.add(normalizedFinalUrl);

    const extractedTitle = extractTitle(fetched.html).replace(/\s+[-|–]\s+.*$/, "").trim() || normalizedFinalUrl;
    const h1 = extractFirstTagText(fetched.html, "h1");
    const breadcrumbs = extractBreadcrumbs(fetched.html);
    const rawContent = cleanMainContent(fetched.html);
    const type = classifyPage(normalizedFinalUrl, extractedTitle, h1, rawContent);
    const title = titleForExport(extractedTitle, type, normalizedFinalUrl);
    const content = preparePageContent(rawContent, extractedTitle, type, normalizedFinalUrl, breadcrumbs);
    const hash = contentHash(content);

    if (content.length >= 80 && !hashes.has(hash)) {
      pages.push({
        title,
        url: normalizedFinalUrl,
        type,
        category: categoryFrom(type, breadcrumbs, title),
        content,
        crawledAt: new Date().toISOString(),
      });
      hashes.add(hash);
    } else {
      if (hashes.has(hash)) stats.duplicatesRemoved += 1;
      stats.skippedUrlsCount += 1;
      console.warn(`Skip ${normalizedFinalUrl}: duplicate or too little content`);
    }

    for (const link of extractLinks(fetched.html, normalizedFinalUrl)) {
      if (!visited.has(link.url)) enqueue(queue, queued, link);
    }

    await sleep(options.delayMs);
  }

  return { pages, stats };
}

function printQualityReport(report: QualityReport): void {
  console.log("");
  console.log("Quality report");
  console.log(`Pages crawled: ${report.pagesCrawled}`);
  console.log(`Records exported: ${report.recordsExported}`);
  console.log(`Records by type: ${JSON.stringify(report.recordsByType)}`);
  console.log(`Skipped urls count: ${report.skippedUrlsCount}`);
  console.log(`Duplicates removed: ${report.duplicatesRemoved}`);
  console.log(`Average content length: ${report.averageContentLength}`);
  console.log(`Records with HTML entities remaining: ${report.recordsWithHtmlEntitiesRemaining}`);
  console.log(`Records with very short content: ${report.recordsWithVeryShortContent}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();

  console.log("LED1000 one-time crawler");
  console.log(`Start URL: ${options.startUrl}`);
  console.log(`Max pages: ${options.maxPages}`);
  console.log(`Delay: ${options.delayMs}ms`);
  console.log(`Timeout: ${options.timeoutMs}ms`);

  const result = await crawl(options);
  const report = await writeOutputs(result.pages, options, startedAt, result.stats);

  console.log("");
  console.log(`Crawled pages exported: ${result.pages.length}`);
  console.log(`Markdown: ${options.markdownOutput}`);
  console.log(`JSON: ${options.jsonOutput}`);
  console.log(`Report: ${options.reportOutput}`);
  printQualityReport(report);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
