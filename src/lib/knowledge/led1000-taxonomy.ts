import type { ImportedKnowledgeDocument, ImportedKnowledgeSection } from "./import";

export const LED1000_KNOWLEDGE_CATEGORIES = [
  {
    id: "cat-led1000-business-profile",
    name: "LED1000 - Hồ sơ doanh nghiệp",
    description: "Thông tin doanh nghiệp, liên hệ, địa chỉ, hotline và hồ sơ thương hiệu",
    icon: "building",
    color: "#007fb2",
    sortOrder: 0,
  },
  {
    id: "cat-led1000-product-catalogue",
    name: "LED1000 - Catalogue sản phẩm",
    description: "Danh mục sản phẩm, thông số kỹ thuật, hình ảnh và mô tả sản phẩm",
    icon: "package",
    color: "#0057ff",
    sortOrder: 1,
  },
  {
    id: "cat-led1000-price-list",
    name: "LED1000 - Bảng giá",
    description: "Bảng giá niêm yết, giá lẻ, giá công trình, giá cửa hàng/đại lý",
    icon: "badge-dollar-sign",
    color: "#e60000",
    sortOrder: 2,
  },
  {
    id: "cat-led1000-inventory",
    name: "LED1000 - Tồn kho",
    description: "Tồn kho, tình trạng hàng, mã hàng và sản phẩm thay thế",
    icon: "boxes",
    color: "#0f766e",
    sortOrder: 3,
  },
  {
    id: "cat-led1000-warranty",
    name: "LED1000 - Chính sách bảo hành",
    description: "Điều kiện bảo hành, thời hạn bảo hành và các trường hợp không áp dụng",
    icon: "shield-check",
    color: "#f59e0b",
    sortOrder: 4,
  },
  {
    id: "cat-led1000-return-policy",
    name: "LED1000 - Chính sách đổi trả",
    description: "Đổi trả, lỗi sản phẩm, kiểm hàng, giao nhận và xác nhận đơn",
    icon: "rotate-ccw",
    color: "#ef4444",
    sortOrder: 5,
  },
  {
    id: "cat-led1000-vat",
    name: "LED1000 - Hướng dẫn xuất VAT",
    description: "Quy trình xuất hóa đơn VAT, thông tin công ty, MST và điều kiện xuất hóa đơn",
    icon: "receipt",
    color: "#7c3aed",
    sortOrder: 6,
  },
  {
    id: "cat-led1000-technical-guide",
    name: "LED1000 - Tư vấn kỹ thuật",
    description: "Cách chọn nguồn, điện áp, công suất, lắp đặt, chống nước và an toàn điện",
    icon: "zap",
    color: "#0284c7",
    sortOrder: 7,
  },
  {
    id: "cat-led1000-customer-segments",
    name: "LED1000 - Phân loại khách hàng",
    description: "Khách lẻ, khách công trình, cửa hàng/đại lý và quy tắc tư vấn theo nhóm",
    icon: "users",
    color: "#16a34a",
    sortOrder: 8,
  },
  {
    id: "cat-led1000-sales-scripts",
    name: "LED1000 - Kịch bản tư vấn",
    description: "Kịch bản hỏi thông tin công trình, báo giá sơ bộ và chuyển nhân viên",
    icon: "messages-square",
    color: "#db2777",
    sortOrder: 9,
  },
  {
    id: "cat-led1000-channel-accounts",
    name: "LED1000 - Tài khoản kênh bán hàng",
    description: "Facebook, Zalo, Shopee và các tài khoản/kênh cần kết nối hoặc ghi nhận",
    icon: "share-2",
    color: "#2563eb",
    sortOrder: 10,
  },
] as const;

export type Led1000KnowledgeCategoryId = (typeof LED1000_KNOWLEDGE_CATEGORIES)[number]["id"];

export const LED1000_KNOWLEDGE_TEMPLATE_ENTRIES = [
  {
    id: "entry-led1000-business-profile-template",
    categoryId: "cat-led1000-business-profile",
    title: "Khung hồ sơ doanh nghiệp LED1000",
    content:
      "Danh mục này dùng để lưu thông tin chính thức về LED1000/Linh Kiện LED1000: tên doanh nghiệp, địa chỉ, hotline/Zalo, email, website, giờ làm việc và ghi chú xác nhận. Nếu chưa có dữ liệu chính thức, bot chỉ được trả lời theo thông tin đã có trong Knowledge Base và nên đề nghị nhân viên xác nhận.",
    priority: 8,
  },
  {
    id: "entry-led1000-product-catalogue-template",
    categoryId: "cat-led1000-product-catalogue",
    title: "Khung catalogue sản phẩm",
    content:
      "Danh mục này dùng để import catalogue, danh sách sản phẩm, hình ảnh, mã sản phẩm, thông số kỹ thuật, điện áp, công suất, kích thước, cấp chống nước, phụ kiện tương thích và mô tả ứng dụng. Khi khách hỏi sản phẩm nhưng thiếu thông số, bot cần hỏi thêm mục đích dùng, điện áp, công suất/tải, số lượng, môi trường trong nhà/ngoài trời và mã/link/hình ảnh nếu có.",
    priority: 9,
  },
  {
    id: "entry-led1000-price-list-template",
    categoryId: "cat-led1000-price-list",
    title: "Khung bảng giá theo nhóm khách",
    content:
      "Danh mục này dùng để import bảng giá chính thức. Cấu trúc khuyến nghị: mã sản phẩm, tên sản phẩm, quy cách, đơn vị tính, giá lẻ, giá khách công trình, giá cửa hàng/đại lý, điều kiện áp dụng, ngày hiệu lực và ghi chú VAT nếu có. Nếu chưa có bảng giá chính thức hoặc giá không khớp đúng sản phẩm/quy cách, bot không được tự báo giá và cần hỏi thêm mã sản phẩm, số lượng, nhóm khách hoặc chuyển nhân viên.",
    priority: 10,
  },
  {
    id: "entry-led1000-inventory-template",
    categoryId: "cat-led1000-inventory",
    title: "Khung tồn kho và sản phẩm thay thế",
    content:
      "Danh mục này dùng để import tồn kho, trạng thái còn hàng/hết hàng, số lượng khả dụng, mã sản phẩm thay thế và ghi chú đặt hàng. Nếu chưa có dữ liệu tồn kho chính thức, bot không được tự nói còn hàng hoặc hết hàng; cần hỏi mã sản phẩm/số lượng và chuyển nhân viên kiểm tra.",
    priority: 10,
  },
  {
    id: "entry-led1000-warranty-template",
    categoryId: "cat-led1000-warranty",
    title: "Khung chính sách bảo hành",
    content:
      "Danh mục này dùng để import chính sách bảo hành chính thức: thời hạn, điều kiện áp dụng, sản phẩm được bảo hành, trường hợp từ chối bảo hành, giấy tờ/hóa đơn cần có và quy trình tiếp nhận. Nếu chưa có chính sách chính thức theo sản phẩm, bot cần nói chưa có dữ liệu xác nhận và chuyển nhân viên.",
    priority: 9,
  },
  {
    id: "entry-led1000-return-policy-template",
    categoryId: "cat-led1000-return-policy",
    title: "Khung chính sách đổi trả và giao nhận",
    content:
      "Danh mục này dùng để import chính sách đổi trả, kiểm hàng, lỗi sản phẩm, giao nhận, phí vận chuyển và xác nhận đơn. Nếu thiếu dữ liệu chính thức cho đơn cụ thể, bot cần hỏi địa chỉ, sản phẩm, số lượng, tình trạng lỗi nếu có và chuyển nhân viên xác nhận.",
    priority: 8,
  },
  {
    id: "entry-led1000-vat-template",
    categoryId: "cat-led1000-vat",
    title: "Khung hướng dẫn xuất VAT",
    content:
      "Danh mục này dùng để import hướng dẫn xuất hóa đơn VAT: thông tin công ty cần cung cấp, mã số thuế, email nhận hóa đơn, thời điểm xuất, điều kiện giá đã/chưa gồm VAT và quy trình điều chỉnh. Nếu chưa có chính sách VAT chính thức, bot không được tự cam kết xuất VAT; cần xin thông tin đơn hàng và chuyển nhân viên xác nhận.",
    priority: 9,
  },
  {
    id: "entry-led1000-technical-guide-template",
    categoryId: "cat-led1000-technical-guide",
    title: "Khung tư vấn kỹ thuật công trình",
    content:
      "Danh mục này dùng để import hướng dẫn chọn nguồn, LED dây, đèn pha, chống nước, công suất dự phòng, điện áp và an toàn lắp đặt. Bot nên hỏi thông tin công trình: vị trí lắp, trong nhà/ngoài trời, chiều dài, điện áp, tổng công suất/tải, màu ánh sáng, chống nước, số lượng, ngân sách và có thợ/kỹ thuật thi công hay chưa.",
    priority: 9,
  },
  {
    id: "entry-led1000-customer-segments-template",
    categoryId: "cat-led1000-customer-segments",
    title: "Khung phân loại khách hàng",
    content:
      "Danh mục này dùng để import quy tắc phân loại khách lẻ, khách công trình, cửa hàng/đại lý. Khi khách hỏi báo giá hoặc mua số lượng, bot cần hỏi khách mua lẻ, mua cho công trình hay mua cho cửa hàng/đại lý; chỉ tính giá theo nhóm nếu bảng giá chính thức có cột tương ứng.",
    priority: 9,
  },
  {
    id: "entry-led1000-sales-scripts-template",
    categoryId: "cat-led1000-sales-scripts",
    title: "Khung kịch bản tư vấn và chuyển nhân viên",
    content:
      "Danh mục này dùng để import kịch bản tư vấn, câu hỏi gợi mở, điều kiện chuyển nhân viên và mẫu phản hồi. Bot nên chuyển nhân viên khi khách cần chốt đơn, cần giá/tồn kho chưa có dữ liệu, cần tư vấn kỹ thuật rủi ro, cần xuất VAT hoặc có khiếu nại/bảo hành.",
    priority: 8,
  },
  {
    id: "entry-led1000-channel-accounts-template",
    categoryId: "cat-led1000-channel-accounts",
    title: "Khung tài khoản kênh bán hàng",
    content:
      "Danh mục này dùng để ghi nhận danh sách tài khoản/kênh bán hàng như Facebook, Zalo, Shopee hoặc kênh khác: tên tài khoản, link/ID, số điện thoại, trạng thái xác minh và người phụ trách. Đây là dữ liệu tham chiếu nghiệp vụ; việc kết nối nhiều tài khoản kênh có thể cần cấu hình kỹ thuật riêng.",
    priority: 6,
  },
] as const;

export const LED1000_KNOWLEDGE_KIND_TO_CATEGORY_ID = {
  business_profile: "cat-led1000-business-profile",
  contact: "cat-led1000-business-profile",
  product_catalogue: "cat-led1000-product-catalogue",
  product: "cat-led1000-product-catalogue",
  product_category: "cat-led1000-product-catalogue",
  price_list: "cat-led1000-price-list",
  price: "cat-led1000-price-list",
  inventory: "cat-led1000-inventory",
  warranty_policy: "cat-led1000-warranty",
  warranty: "cat-led1000-warranty",
  return_policy: "cat-led1000-return-policy",
  delivery_policy: "cat-led1000-return-policy",
  vat_invoice: "cat-led1000-vat",
  technical_guide: "cat-led1000-technical-guide",
  technical: "cat-led1000-technical-guide",
  customer_segments: "cat-led1000-customer-segments",
  sales_script: "cat-led1000-sales-scripts",
  faq: "cat-led1000-sales-scripts",
  channel_accounts: "cat-led1000-channel-accounts",
} as const;

export type Led1000KnowledgeKind = keyof typeof LED1000_KNOWLEDGE_KIND_TO_CATEGORY_ID | "mixed" | "unknown";

export interface Led1000CategorySuggestion {
  knowledgeKind: Led1000KnowledgeKind;
  categoryId: string | null;
  categoryName: string | null;
  confidence: number;
  reason: string;
}

export function suggestLed1000CategoryForImport(
  document: ImportedKnowledgeDocument,
  fileName: string,
  availableCategories: Array<{ id: string; name: string }>
): Led1000CategorySuggestion {
  const knowledgeKind = detectLed1000KnowledgeKind(document, fileName);
  const expectedCategoryId = LED1000_KNOWLEDGE_KIND_TO_CATEGORY_ID[
    knowledgeKind as keyof typeof LED1000_KNOWLEDGE_KIND_TO_CATEGORY_ID
  ] as Led1000KnowledgeCategoryId | undefined;
  const category =
    (expectedCategoryId && availableCategories.find((item) => item.id === expectedCategoryId)) ||
    findCategoryByName(knowledgeKind, availableCategories);

  return {
    knowledgeKind,
    categoryId: category?.id || expectedCategoryId || null,
    categoryName:
      category?.name ||
      LED1000_KNOWLEDGE_CATEGORIES.find((item) => item.id === expectedCategoryId)?.name ||
      null,
    confidence: knowledgeKind === "mixed" || knowledgeKind === "unknown" ? 0.45 : 0.82,
    reason: buildSuggestionReason(knowledgeKind),
  };
}

function detectLed1000KnowledgeKind(
  document: ImportedKnowledgeDocument,
  fileName: string
): Led1000KnowledgeKind {
  const explicitKind = mostCommonKind(
    document.sections
      .map((section) => normalizeKind(section.metadata?.documentKind))
      .filter((kind): kind is Led1000KnowledgeKind => Boolean(kind))
  );
  if (explicitKind) return explicitKind;

  const geminiKind = mostCommonKind(
    document.sections
      .map((section) => normalizeKind(section.metadata?.geminiType))
      .filter((kind): kind is Led1000KnowledgeKind => Boolean(kind))
  );
  if (geminiKind) return geminiKind;

  return classifyText(`${fileName}\n${document.sections.map(sectionToSearchText).join("\n")}`);
}

function normalizeKind(value: unknown): Led1000KnowledgeKind | null {
  const normalized = normalizeText(String(value || "")).replace(/\s+/g, "_");
  if (!normalized) return null;

  const aliases: Record<string, Led1000KnowledgeKind> = {
    intro: "business_profile",
    hours: "business_profile",
    policy: "delivery_policy",
    process: "sales_script",
    service: "sales_script",
    note: "unknown",
    promotion: "price_list",
    membership: "customer_segments",
  };

  if (aliases[normalized]) return aliases[normalized];
  if (normalized in LED1000_KNOWLEDGE_KIND_TO_CATEGORY_ID) {
    return normalized as Led1000KnowledgeKind;
  }

  return null;
}

function classifyText(text: string): Led1000KnowledgeKind {
  const value = normalizeText(text);
  if (/vat|hoa don|hoa don do|xuat hoa don|ma so thue|mst/.test(value)) return "vat_invoice";
  if (/ton kho|con hang|het hang|so luong ton|hang thay the|san pham thay the/.test(value)) {
    return "inventory";
  }
  if (/bao hanh|warranty|thoi han bao hanh|tem bao hanh/.test(value)) return "warranty_policy";
  if (/doi tra|tra hang|doi hang|hoan tien|loi san pham|kiem hang/.test(value)) {
    return "return_policy";
  }
  if (
    /bang gia|gia ban le|gia le|gia thi cong|gia cong trinh|gia cua hang|gia dai ly|gia si|chiet khau|bao gia|vnd|vnđ/.test(
      value
    )
  ) {
    return "price_list";
  }
  if (/khach le|cong trinh|cua hang|dai ly|nha thau|thi cong/.test(value)) {
    return "customer_segments";
  }
  if (/facebook|zalo|shopee|lazada|tiktok|kenh ban|fanpage|oa\b/.test(value)) {
    return "channel_accounts";
  }
  if (/dien ap|cong suat|watt|nguon|12v|24v|220v|ip65|ip67|lap dat|chong nuoc/.test(value)) {
    return "technical_guide";
  }
  if (/catalogue|catalog|san pham|ma san pham|sku|den led|led day|den pha|adapter|module/.test(value)) {
    return "product_catalogue";
  }
  if (/hotline|dia chi|lien he|website|email|led1000|long thinh phat/.test(value)) {
    return "business_profile";
  }
  if (/faq|cau hoi|hoi dap|tu van|kich ban/.test(value)) return "sales_script";

  return "unknown";
}

function mostCommonKind(kinds: Led1000KnowledgeKind[]): Led1000KnowledgeKind | null {
  if (kinds.length === 0) return null;
  const counts = new Map<Led1000KnowledgeKind, number>();
  for (const kind of kinds) {
    if (kind === "unknown") continue;
    counts.set(kind, (counts.get(kind) || 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return null;
  if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return "mixed";
  return sorted[0][0];
}

function findCategoryByName(
  knowledgeKind: Led1000KnowledgeKind,
  availableCategories: Array<{ id: string; name: string }>
) {
  const expectedCategoryId = LED1000_KNOWLEDGE_KIND_TO_CATEGORY_ID[
    knowledgeKind as keyof typeof LED1000_KNOWLEDGE_KIND_TO_CATEGORY_ID
  ];
  const expectedName = LED1000_KNOWLEDGE_CATEGORIES.find(
    (category) => category.id === expectedCategoryId
  )?.name;
  if (!expectedName) return null;

  const normalizedExpectedName = normalizeText(expectedName);
  return (
    availableCategories.find((category) => normalizeText(category.name) === normalizedExpectedName) ||
    null
  );
}

function sectionToSearchText(section: ImportedKnowledgeSection): string {
  return [section.title, section.content, JSON.stringify(section.metadata || {})].join("\n");
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSuggestionReason(kind: Led1000KnowledgeKind): string {
  switch (kind) {
    case "price_list":
      return "Phát hiện dấu hiệu bảng giá/giá bán/chiết khấu.";
    case "inventory":
      return "Phát hiện dấu hiệu tồn kho, còn hàng hoặc sản phẩm thay thế.";
    case "warranty_policy":
      return "Phát hiện nội dung bảo hành.";
    case "return_policy":
    case "delivery_policy":
      return "Phát hiện nội dung đổi trả/giao nhận/chính sách đơn hàng.";
    case "vat_invoice":
      return "Phát hiện nội dung xuất hóa đơn VAT/MST.";
    case "technical_guide":
      return "Phát hiện thông số kỹ thuật hoặc hướng dẫn chọn/lắp sản phẩm.";
    case "customer_segments":
      return "Phát hiện nội dung phân loại khách lẻ/công trình/cửa hàng.";
    case "channel_accounts":
      return "Phát hiện nội dung tài khoản/kênh bán hàng.";
    case "product_catalogue":
    case "product":
    case "product_category":
      return "Phát hiện catalogue, sản phẩm hoặc nhóm sản phẩm.";
    case "business_profile":
    case "contact":
      return "Phát hiện hồ sơ doanh nghiệp hoặc thông tin liên hệ.";
    case "sales_script":
    case "faq":
      return "Phát hiện kịch bản tư vấn hoặc FAQ.";
    default:
      return "Chưa đủ chắc để tự gợi ý danh mục; nên chọn thủ công.";
  }
}
