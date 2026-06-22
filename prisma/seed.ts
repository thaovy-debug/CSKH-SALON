import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import {
  LED1000_KNOWLEDGE_CATEGORIES,
  LED1000_KNOWLEDGE_TEMPLATE_ENTRIES,
} from "../src/lib/knowledge/led1000-taxonomy";

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/linhkienled1000?schema=public";
const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create default admin (password: admin123)
  const hashedPassword = await bcrypt.hash("admin123", 12);
  await prisma.admin.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      username: "admin",
      password: hashedPassword,
      name: "Administrator",
      role: "admin",
    },
  });

  // Create default settings
  await prisma.settings.upsert({
    where: { id: "default" },
    update: {
      businessName: "LED1000 / Linh Kiện LED1000",
      businessDesc: "Chuyên đèn LED, nguồn điện, linh kiện LED, phụ kiện chiếu sáng, đèn trang trí và thiết bị điện liên quan.",
      welcomeMessage: "Xin chào! LED1000 có thể hỗ trợ bạn tìm đèn LED, nguồn điện, linh kiện hoặc phụ kiện phù hợp. Bạn cần dùng cho mục đích nào và có thông số điện áp/công suất chưa?",
      tone: "friendly",
      language: "auto",
    },
    create: {
      id: "default",
      businessName: "LED1000 / Linh Kiện LED1000",
      businessDesc: "Chuyên đèn LED, nguồn điện, linh kiện LED, phụ kiện chiếu sáng, đèn trang trí và thiết bị điện liên quan.",
      welcomeMessage: "Xin chào! LED1000 có thể hỗ trợ bạn tìm đèn LED, nguồn điện, linh kiện hoặc phụ kiện phù hợp. Bạn cần dùng cho mục đích nào và có thông số điện áp/công suất chưa?",
      tone: "friendly",
      language: "auto",
    },
  });

  // Create default channels
  for (const type of ["whatsapp", "email", "phone"]) {
    await prisma.channel.upsert({
      where: { type },
      update: {},
      create: { type, isActive: false, status: "disconnected" },
    });
  }

  // Create default business hours
  await prisma.businessHours.upsert({
    where: { id: "default" },
    update: {
      offlineMessage: "LED1000 hiện đang ngoài giờ hỗ trợ. Chúng tôi sẽ phản hồi bạn trong khung giờ hoạt động sớm nhất.",
    },
    create: {
      id: "default",
      offlineMessage: "LED1000 hiện đang ngoài giờ hỗ trợ. Chúng tôi sẽ phản hồi bạn trong khung giờ hoạt động sớm nhất.",
    },
  });

  // Create LED1000 demo departments
  const tvDept = await prisma.department.upsert({
    where: { id: "dept-tv" },
    update: {
      name: "Tư vấn sản phẩm",
      description: "Tư vấn chọn đèn LED, nguồn điện, linh kiện và báo giá theo dữ liệu có sẵn",
      email: "tuvan@led1000.vn",
    },
    create: {
      id: "dept-tv",
      name: "Tư vấn sản phẩm",
      description: "Tư vấn chọn đèn LED, nguồn điện, linh kiện và báo giá theo dữ liệu có sẵn",
      email: "tuvan@led1000.vn",
    },
  });

  const cskdDept = await prisma.department.upsert({
    where: { id: "dept-cskh" },
    update: {
      name: "Chăm sóc khách hàng",
      description: "Xử lý phản hồi, bảo hành, đổi trả và hỗ trợ đơn hàng",
      email: "cskh@led1000.vn",
    },
    create: {
      id: "dept-cskh",
      name: "Chăm sóc khách hàng",
      description: "Xử lý phản hồi, bảo hành, đổi trả và hỗ trợ đơn hàng",
      email: "cskh@led1000.vn",
    },
  });

  const stylDept = await prisma.department.upsert({
    where: { id: "dept-technical" },
    update: {
      name: "Kỹ thuật",
      description: "Hỗ trợ thông số nguồn điện, công suất, lắp đặt và an toàn điện",
      email: "kythuat@led1000.vn",
    },
    create: {
      id: "dept-technical",
      name: "Kỹ thuật",
      description: "Hỗ trợ thông số nguồn điện, công suất, lắp đặt và an toàn điện",
      email: "kythuat@led1000.vn",
    },
  });

  // Create LED1000 demo team members
  const members = [
    { id: "member-1", name: "Linh Tư Vấn", email: "linh@led1000.vn", role: "Lead", expertise: "tư vấn sản phẩm LED, báo giá, nguồn điện, phụ kiện chiếu sáng", departmentId: tvDept.id },
    { id: "member-2", name: "Hoa CSKH", email: "hoa@led1000.vn", role: "Lead", expertise: "chăm sóc khách hàng, khiếu nại, bảo hành, đổi trả", departmentId: cskdDept.id },
    { id: "member-3", name: "Minh Kỹ Thuật", email: "minh@led1000.vn", role: "Lead", expertise: "điện áp, công suất, tải nguồn, LED dây, thi công chiếu sáng", departmentId: stylDept.id },
    { id: "member-4", name: "An Kho Hàng", email: "an@led1000.vn", role: "Member", expertise: "kiểm tra mã sản phẩm, quy cách, số lượng, tình trạng hàng", departmentId: tvDept.id },
  ];

  for (const m of members) {
    await prisma.teamMember.upsert({
      where: { id: m.id },
      update: m,
      create: m,
    });
  }

  // Create knowledge base categories for LED1000
  const categories = LED1000_KNOWLEDGE_CATEGORIES;

  for (const c of categories) {
    await prisma.category.upsert({ where: { id: c.id }, update: c, create: c });
  }

  const entries = [
    ...LED1000_KNOWLEDGE_TEMPLATE_ENTRIES,
    // FAQ
    { id: "entry-1", categoryId: "cat-led1000-business-profile", title: "Thông tin LED1000", content: "LED1000 / Linh Kiện LED1000 chuyên đèn LED, nguồn điện, linh kiện LED, phụ kiện chiếu sáng, đèn trang trí và thiết bị điện liên quan.", priority: 10 },
    { id: "entry-2", categoryId: "cat-led1000-business-profile", title: "Thông tin liên hệ", content: "Khách có thể liên hệ LED1000 qua hotline/Zalo 0909003082 hoặc 0972 90 25 25. Địa chỉ cần khách xác nhận trước production: 207 Vườn Lài, Phú Thọ Hòa, Q. Tân Phú, TP.HCM.", priority: 9 },
    { id: "entry-6", categoryId: "cat-led1000-sales-scripts", title: "Thông tin cần hỏi khi tư vấn", content: "Khi khách hỏi sản phẩm chưa đủ rõ, cần hỏi thêm mục đích sử dụng, trong nhà/ngoài trời, điện áp, công suất/tải, chiều dài, màu ánh sáng, mức chống nước IP, số lượng và quy cách.", priority: 9 },
    { id: "entry-7", categoryId: "cat-led1000-price-list", title: "Quy tắc báo giá", content: "Chỉ báo giá khi Knowledge Base có giá cụ thể gắn với đúng sản phẩm hoặc đúng quy cách khách hỏi. Nếu giá không rõ hoặc có nhiều sản phẩm gần giống, hỏi thêm mã sản phẩm, link, hình ảnh, số lượng, điện áp, công suất, kích thước hoặc quy cách.", priority: 10 },
    // Sản phẩm
    { id: "entry-3", categoryId: "cat-led1000-product-catalogue", title: "Nhóm sản phẩm chính", content: "Các nhóm sản phẩm thường gặp: nguồn tổng DC, nguồn adapter, nguồn 5V/12V/24V/48V, LED dây, LED thanh, LED quảng cáo, bóng đèn LED, đèn âm trần, đèn ốp trần, đèn tuýp LED, đèn pha LED, đèn năng lượng mặt trời, đèn trang trí và phụ kiện LED.", priority: 9 },
    { id: "entry-8", categoryId: "cat-led1000-technical-guide", title: "Nguồn điện cho LED", content: "Khi tư vấn nguồn, cần biết điện áp LED, tổng công suất hoặc chiều dài/tải dự kiến, môi trường sử dụng và dự phòng công suất phù hợp. Với câu hỏi có rủi ro điện/thi công, nên khuyến nghị nhân viên kỹ thuật xác nhận.", priority: 10 },
    { id: "entry-9", categoryId: "cat-led1000-product-catalogue", title: "LED dây", content: "Khi tư vấn LED dây, cần hỏi điện áp 12V/24V/220V, chiều dài, màu ánh sáng, dùng trong nhà hay ngoài trời, có cần chống nước hay đổi màu RGB không, và mục đích như hắt trần, tủ kệ, bảng hiệu hoặc trang trí.", priority: 9 },
    { id: "entry-10", categoryId: "cat-led1000-product-catalogue", title: "Đèn trang trí và phụ kiện", content: "Đèn trang trí có thể cần thông tin về không gian sử dụng, chiều dài dây, màu ánh sáng, kiểu điều khiển, nguồn cấp và số lượng. Phụ kiện cần khớp đúng quy cách sản phẩm.", priority: 8 },
    { id: "entry-11", categoryId: "cat-led1000-product-catalogue", title: "Đèn năng lượng mặt trời", content: "Khi tư vấn đèn năng lượng mặt trời, cần hỏi vị trí lắp, công suất mong muốn, thời gian chiếu sáng, mức chống nước, diện tích chiếu sáng và nhu cầu đèn pha, đèn đường, sân vườn hay trang trí.", priority: 7 },
    // Chính sách
    { id: "entry-4", categoryId: "cat-led1000-return-policy", title: "Giao hàng và xác nhận đơn", content: "Nếu Knowledge Base chưa có chính sách giao hàng rõ cho đơn cụ thể, bot cần hỏi thêm địa chỉ, số lượng, sản phẩm và đề nghị nhân viên xác nhận.", priority: 8 },
    { id: "entry-5", categoryId: "cat-led1000-warranty", title: "Bảo hành và đổi trả", content: "Chỉ trả lời chính sách bảo hành/đổi trả theo thông tin có trong Knowledge Base. Nếu chưa có dữ liệu rõ, cần nói chưa có thông tin chính xác và chuyển nhân viên xác nhận.", priority: 7 },
    // Tư vấn kỹ thuật
    { id: "entry-12", categoryId: "cat-led1000-technical-guide", title: "An toàn kỹ thuật điện", content: "Với lắp đặt nguồn, tải lớn, ngoài trời, chống nước hoặc đấu nối điện 220V, bot chỉ tư vấn ở mức thông tin và khuyến nghị nhân viên kỹ thuật/thợ đủ chuyên môn kiểm tra trước khi thi công.", priority: 8 },
  ];

  for (const e of entries) {
    await prisma.knowledgeEntry.upsert({ where: { id: e.id }, update: { ...e, isActive: true }, create: e });
  }

  // Create demo tags
  const tags = [
    { id: "tag-1", name: "Khẩn cấp", color: "#EF4444" },
    { id: "tag-2", name: "Khách VIP", color: "#F59E0B" },
    { id: "tag-3", name: "Cần theo dõi", color: "#3B82F6" },
    { id: "tag-4", name: "Đã xử lý", color: "#22C55E" },
    { id: "tag-5", name: "Khiếu nại", color: "#8B5CF6" },
    { id: "tag-6", name: "Cần báo giá", color: "#EC4899" },
    { id: "tag-7", name: "Tư vấn giá", color: "#06B6D4" },
  ];

  for (const t of tags) {
    await prisma.tag.upsert({ where: { id: t.id }, update: { name: t.name, color: t.color }, create: t });
  }

  // Create canned responses for LED1000
  const cannedResponses = [
    { id: "cr-1", title: "Chào khách", content: "Dạ chào bạn! LED1000 có thể hỗ trợ bạn tìm đèn LED, nguồn điện, linh kiện hoặc phụ kiện phù hợp. Bạn cần dùng cho mục đích nào ạ?", category: "Chung", shortcut: "/chao" },
    { id: "cr-2", title: "Tạm biệt", content: "Dạ cảm ơn bạn đã liên hệ LED1000. Nếu cần thêm thông tin về sản phẩm, quy cách hoặc báo giá, bạn cứ nhắn lại nhé.", category: "Chung", shortcut: "/tambit" },
    { id: "cr-3", title: "Xin thông số", content: "Dạ để tư vấn chính xác hơn, bạn cho LED1000 xin điện áp, công suất/tải, môi trường dùng trong nhà hay ngoài trời, số lượng và hình ảnh/link sản phẩm nếu có nhé.", category: "Tư vấn", shortcut: "/thongso" },
    { id: "cr-4", title: "Chuyển nhân viên", content: "Dạ trường hợp này cần nhân viên tư vấn chuyên sâu hơn xác nhận giúp bạn. Mình vui lòng chờ LED1000 kết nối nhân viên hỗ trợ nhé.", category: "Hỗ trợ", shortcut: "/chuyennv" },
    { id: "cr-5", title: "Hỏi báo giá", content: "Dạ để báo giá chính xác, bạn cho LED1000 xin mã sản phẩm hoặc link/hình ảnh, số lượng cần mua và quy cách điện áp/công suất nếu có nhé.", category: "Báo giá", shortcut: "/baogia" },
    { id: "cr-6", title: "Hỏi nguồn điện", content: "Dạ bạn cho LED1000 xin điện áp LED, tổng công suất hoặc chiều dài LED dây, dùng trong nhà/ngoài trời và có cần chống nước không để tư vấn nguồn phù hợp nhé.", category: "Tư vấn kỹ thuật", shortcut: "/hoinguon" },
  ];

  for (const cr of cannedResponses) {
    await prisma.cannedResponse.upsert({ where: { id: cr.id }, update: { ...cr, isActive: true }, create: cr });
  }

  // Create sample SLA rules
  const slaRules = [
    { id: "sla-1", name: "Standard Response", description: "Default response time for all channels", firstResponseMins: 30, resolutionMins: 480 },
    { id: "sla-2", name: "Urgent Priority", description: "Fast response for urgent issues", priority: "urgent", firstResponseMins: 5, resolutionMins: 60 },
  ];

  for (const sla of slaRules) {
    await prisma.sLARule.upsert({ where: { id: sla.id }, update: {}, create: sla });
  }

  console.log("✅ Seed data created successfully!");
  console.log("📋 Business: LED1000 / Linh Kiện LED1000");
  console.log("🔐 Default admin: username=admin, password=admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
