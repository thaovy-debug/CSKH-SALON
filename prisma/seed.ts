import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/owly?schema=public";
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
      businessName: "Minh Hy Hair",
      businessDesc: "Salon tóc nữ chuyên nghiệp - Cắt, Nhuộm, Uốn, Duỗi, Highlight, Balayage và Phục hồi tóc",
      welcomeMessage: "Dạ chào chị! Em là trợ lý tư vấn của Minh Hy Hair 💇‍♀️ Em có thể giúp chị tư vấn dịch vụ, bảng giá và đặt lịch ạ. Chị cần tư vấn gì hôm nay ạ?",
      tone: "friendly",
      language: "auto",
    },
    create: {
      id: "default",
      businessName: "Minh Hy Hair",
      businessDesc: "Salon tóc nữ chuyên nghiệp - Cắt, Nhuộm, Uốn, Duỗi, Highlight, Balayage và Phục hồi tóc",
      welcomeMessage: "Dạ chào chị! Em là trợ lý tư vấn của Minh Hy Hair 💇‍♀️ Em có thể giúp chị tư vấn dịch vụ, bảng giá và đặt lịch ạ. Chị cần tư vấn gì hôm nay ạ?",
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
    update: {},
    create: { id: "default" },
  });

  // Create salon departments
  const tvDept = await prisma.department.upsert({
    where: { id: "dept-tv" },
    update: {},
    create: {
      id: "dept-tv",
      name: "Tư vấn dịch vụ",
      description: "Tư vấn dịch vụ, báo giá và đặt lịch cho khách hàng",
      email: "tuvan@minhhyhair.com",
    },
  });

  const cskdDept = await prisma.department.upsert({
    where: { id: "dept-cskh" },
    update: {},
    create: {
      id: "dept-cskh",
      name: "Chăm sóc khách hàng",
      description: "Xử lý khiếu nại, phản hồi và bảo hành dịch vụ",
      email: "cskh@minhhyhair.com",
    },
  });

  const stylDept = await prisma.department.upsert({
    where: { id: "dept-stylist" },
    update: {},
    create: {
      id: "dept-stylist",
      name: "Stylist",
      description: "Đội ngũ kỹ thuật viên và stylist chuyên nghiệp",
      email: "stylist@minhhyhair.com",
    },
  });

  // Create salon team members
  const members = [
    { id: "member-1", name: "Linh Tư Vấn", email: "linh@minhhyhair.com", role: "Lead", expertise: "tư vấn dịch vụ, báo giá, đặt lịch, nhuộm tóc, uốn duỗi", departmentId: tvDept.id },
    { id: "member-2", name: "Hoa CSKH", email: "hoa@minhhyhair.com", role: "Lead", expertise: "chăm sóc khách hàng, khiếu nại, bảo hành, hoàn tiền", departmentId: cskdDept.id },
    { id: "member-3", name: "Mai Stylist", email: "mai@minhhyhair.com", role: "Lead", expertise: "cắt tóc, balayage, highlight, nhuộm màu, tạo kiểu", departmentId: stylDept.id },
    { id: "member-4", name: "Thu Stylist", email: "thu@minhhyhair.com", role: "Member", expertise: "phục hồi tóc, keratin, uốn duỗi, ép tóc", departmentId: stylDept.id },
  ];

  for (const m of members) {
    await prisma.teamMember.upsert({
      where: { id: m.id },
      update: {},
      create: m,
    });
  }

  // Create knowledge base categories for Minh Hy Hair
  const categories = [
    { id: "cat-faq", name: "FAQ", description: "Câu hỏi khách thường gặp", icon: "help-circle", color: "#4A7C9B", sortOrder: 0 },
    { id: "cat-products", name: "Bảng giá dịch vụ", description: "Giá cắt, nhuộm, uốn, duỗi, highlight, phục hồi", icon: "package", color: "#22C55E", sortOrder: 1 },
    { id: "cat-policies", name: "Chính sách", description: "Đặt lịch, hủy lịch, bảo hành và khiếu nại", icon: "shield", color: "#F59E0B", sortOrder: 2 },
    { id: "cat-haircare", name: "Tư vấn chăm sóc tóc", description: "Phân loại tóc, chăm sóc tại nhà, lưu ý sau dịch vụ", icon: "scissors", color: "#EC4899", sortOrder: 3 },
  ];

  for (const c of categories) {
    await prisma.category.upsert({ where: { id: c.id }, update: {}, create: c });
  }

  const entries = [
    // FAQ
    { id: "entry-1", categoryId: "cat-faq", title: "Giờ làm việc", content: "Minh Hy Hair mở cửa từ Thứ Hai đến Chủ Nhật, 8:30 – 20:00. Trợ lý AI hỗ trợ tư vấn 24/7 và sẽ chuyển nhân viên khi cần.", priority: 10 },
    { id: "entry-2", categoryId: "cat-faq", title: "Thông tin liên hệ & đặt lịch", content: "Khách có thể đặt lịch qua Zalo, fanpage Facebook hoặc gọi trực tiếp. Bot sẽ ghi nhận thông tin và xác nhận lịch hẹn.", priority: 9 },
    { id: "entry-6", categoryId: "cat-faq", title: "Salon phục vụ đối tượng nào?", content: "Minh Hy Hair chuyên phục vụ khách hàng nữ. Salon không nhận khách nam và không phục vụ trẻ em.", priority: 8 },
    { id: "entry-7", categoryId: "cat-faq", title: "Phân loại size tóc", content: "Salon phân loại độ dài tóc theo size để tính giá dịch vụ:\n- Size S: Tóc ngắn / tóc tém (dưới tai)\n- Size M: Tóc ngang vai\n- Size L: Tóc qua vai (chưa tới ngực)\n- Size XL: Tóc qua ngực trở xuống\nMột số dịch vụ có thể phụ thu 100.000 – 200.000đ nếu tóc dày hoặc đặc biệt dài.", priority: 10 },
    // Bảng giá
    { id: "entry-3", categoryId: "cat-products", title: "Bảng giá cắt tóc", content: "Dịch vụ cắt tóc (bao gồm gội + sấy):\n- Size S (tóc ngắn/tóc tém): 80.000đ\n- Size M (ngang vai): 100.000đ\n- Size L (qua vai): 120.000đ\n- Size XL (qua ngực): 150.000đ\nPhụ thu tóc dày: +50.000đ", priority: 9 },
    { id: "entry-8", categoryId: "cat-products", title: "Bảng giá nhuộm tóc", content: "Dịch vụ nhuộm tóc (màu đơn, có pha màu):\n- Size S: từ 250.000đ\n- Size M: từ 350.000đ\n- Size L: từ 500.000đ\n- Size XL: từ 650.000đ\nNhuộm màu cao cấp / ombre / khói: cộng thêm 100.000 – 300.000đ tuỳ màu. Đã tẩy trước có thể điều chỉnh giá. Vui lòng gửi ảnh tham khảo để báo giá chính xác.", priority: 10 },
    { id: "entry-9", categoryId: "cat-products", title: "Bảng giá uốn & duỗi tóc", content: "Dịch vụ uốn tóc:\n- Size S: từ 300.000đ\n- Size M: từ 450.000đ\n- Size L: từ 600.000đ\n- Size XL: từ 800.000đ\n\nDịch vụ duỗi / ép tóc:\n- Size S: từ 250.000đ\n- Size M: từ 400.000đ\n- Size L: từ 550.000đ\n- Size XL: từ 700.000đ\nGiá có thể thay đổi theo tình trạng tóc và loại thuốc.", priority: 9 },
    { id: "entry-10", categoryId: "cat-products", title: "Dịch vụ Highlight & Balayage", content: "Highlight và Balayage là dịch vụ phức tạp, giá phụ thuộc vào số lượng sợi, màu sắc và tình trạng tóc:\n- Highlight cơ bản: từ 500.000đ\n- Balayage / ombre: từ 800.000đ\n- Tẩy tóc toàn bộ: từ 400.000đ\nKhuyến nghị: Gửi ảnh tham khảo hoặc đến salon để stylist tư vấn trực tiếp trước khi quyết định dịch vụ.", priority: 8 },
    { id: "entry-11", categoryId: "cat-products", title: "Dịch vụ phục hồi tóc", content: "Phục hồi tóc hư tổn, khô xơ, chẻ ngọn:\n- Ủ tóc cơ bản: từ 150.000đ\n- Ủ tóc chuyên sâu (protein mask): từ 250.000đ\n- Phục hồi Keratin: từ 500.000đ\nGiá phụ thuộc vào mức độ hư tổn và độ dài tóc. Tư vấn thêm sau khi kiểm tra tình trạng tóc thực tế.", priority: 7 },
    // Chính sách
    { id: "entry-4", categoryId: "cat-policies", title: "Chính sách đặt và hủy lịch", content: "Khách nên đặt lịch trước tối thiểu 30 phút để salon sắp xếp stylist phù hợp. Nếu cần hủy hoặc đổi lịch, vui lòng báo trước ít nhất 2 giờ. Hủy không báo trước có thể ảnh hưởng đến ưu tiên đặt lịch lần sau.", priority: 8 },
    { id: "entry-5", categoryId: "cat-policies", title: "Chính sách bảo hành và khiếu nại", content: "Minh Hy Hair cam kết bảo hành dịch vụ trong vòng 3 – 7 ngày sau khi làm (tùy dịch vụ). Nếu chưa hài lòng về kết quả, khách liên hệ ngay để salon kiểm tra và hỗ trợ xử lý. Không bảo hành trong trường hợp khách tự xử lý tóc tại nhà sau khi làm.", priority: 7 },
    // Chăm sóc tóc
    { id: "entry-12", categoryId: "cat-haircare", title: "Lưu ý sau nhuộm / uốn / duỗi tóc", content: "Sau khi làm dịch vụ hóa chất, khách nên:\n- Không gội tóc trong 48 giờ đầu\n- Sử dụng dầu gội dành cho tóc nhuộm / uốn\n- Không buộc tóc chặt ngay sau khi uốn\n- Tránh tiếp xúc nhiều với nước biển, hồ bơi trong tuần đầu\n- Dưỡng tóc tại nhà bằng serum hoặc dầu dưỡng để giữ màu bền lâu hơn.", priority: 6 },
  ];

  for (const e of entries) {
    await prisma.knowledgeEntry.upsert({ where: { id: e.id }, update: {}, create: e });
  }

  // Create salon tags
  const tags = [
    { id: "tag-1", name: "Khẩn cấp", color: "#EF4444" },
    { id: "tag-2", name: "Khách VIP", color: "#F59E0B" },
    { id: "tag-3", name: "Cần theo dõi", color: "#3B82F6" },
    { id: "tag-4", name: "Đã xử lý", color: "#22C55E" },
    { id: "tag-5", name: "Khiếu nại", color: "#8B5CF6" },
    { id: "tag-6", name: "Đặt lịch", color: "#EC4899" },
    { id: "tag-7", name: "Tư vấn giá", color: "#06B6D4" },
  ];

  for (const t of tags) {
    await prisma.tag.upsert({ where: { id: t.id }, update: { name: t.name, color: t.color }, create: t });
  }

  // Create canned responses for salon
  const cannedResponses = [
    { id: "cr-1", title: "Chào khách", content: "Dạ chào chị! Em là trợ lý tư vấn của Minh Hy Hair 💇‍♀️ Chị cần tư vấn dịch vụ gì hôm nay ạ?", category: "Chung", shortcut: "/chao" },
    { id: "cr-2", title: "Tạm biệt", content: "Dạ cảm ơn chị đã liên hệ với Minh Hy Hair! Nếu cần tư vấn thêm, chị cứ nhắn lại nhé. Salon luôn sẵn sàng hỗ trợ ạ 💕", category: "Chung", shortcut: "/tambit" },
    { id: "cr-3", title: "Xin ảnh tóc", content: "Dạ để em tư vấn chính xác hơn, chị có thể gửi ảnh tóc hiện tại không ạ? Em sẽ tư vấn ngay cho chị nha 🙏", category: "Tư vấn", shortcut: "/xepanh" },
    { id: "cr-4", title: "Chuyển nhân viên", content: "Dạ trường hợp này em cần nhờ nhân viên tư vấn chuyên sâu hơn hỗ trợ chị ạ. Chị đợi em kết nối giúp chị trong giây lát nhé!", category: "Hỗ trợ", shortcut: "/chuyennv" },
    { id: "cr-5", title: "Đặt lịch", content: "Dạ chị muốn đặt lịch cho dịch vụ này thì chị cho em biết: (1) Tên chị, (2) Số điện thoại và (3) Ngày giờ mong muốn nhé ạ 📅", category: "Đặt lịch", shortcut: "/datlich" },
    { id: "cr-6", title: "Hỏi độ dài tóc", content: "Dạ mình cho em xin độ dài tóc hiện tại để em báo giá chính xác hơn ạ? (Tóc tém / ngang vai / qua vai / qua ngực)", category: "Tư vấn", shortcut: "/hoisize" },
  ];

  for (const cr of cannedResponses) {
    await prisma.cannedResponse.upsert({ where: { id: cr.id }, update: {}, create: cr });
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
  console.log("📋 Business: Minh Hy Hair");
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
