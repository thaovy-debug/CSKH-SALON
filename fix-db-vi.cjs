/**
 * Script cập nhật dữ liệu database sang tiếng Việt:
 * 1. Cập nhật canned-responses từ tiếng Anh sang tiếng Việt
 * 2. Sửa encoding lỗi trong knowledge categories & entries
 */
const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/owly?schema=public";

const pool = new Pool({ connectionString });

async function run() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── 1. CẬP NHẬT CANNED RESPONSES ────────────────────────────────────────
    console.log("📝 Cập nhật mẫu trả lời...");

    const cannedUpdates = [
      {
        id: "cr-1",
        title: "Lời chào",
        content:
          "Xin chào! Cảm ơn bạn đã liên hệ với chúng tôi. Tôi có thể giúp gì cho bạn hôm nay?",
        category: "Chung",
        shortcut: "/chao",
      },
      {
        id: "cr-2",
        title: "Lời tạm biệt",
        content:
          "Cảm ơn bạn đã liên hệ! Nếu cần hỗ trợ thêm, đừng ngần ngại liên hệ lại nhé!",
        category: "Chung",
        shortcut: "/tambit",
      },
      {
        id: "cr-3",
        title: "Quy trình hoàn tiền",
        content:
          "Tôi hiểu bạn muốn hoàn tiền. Để tôi kiểm tra cho bạn nhé. Bạn có thể cho tôi biết mã đơn hàng không?",
        category: "Thanh toán",
        shortcut: "/hoantien",
      },
      {
        id: "cr-4",
        title: "Chuyển chuyên viên",
        content:
          "Tôi sẽ kết nối bạn với chuyên viên có thể hỗ trợ tốt hơn cho vấn đề này. Vui lòng chờ trong giây lát.",
        category: "Hỗ trợ",
        shortcut: "/chuyenky",
      },
    ];

    for (const cr of cannedUpdates) {
      const result = await client.query(
        `UPDATE "CannedResponse"
         SET title = $1, content = $2, category = $3, shortcut = $4
         WHERE id = $5`,
        [cr.title, cr.content, cr.category, cr.shortcut, cr.id]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ Đã cập nhật: ${cr.title}`);
      } else {
        console.log(`  ℹ Không tìm thấy ID "${cr.id}", bỏ qua.`);
      }
    }

    // ── 2. SỬA ENCODING KNOWLEDGE CATEGORIES ─────────────────────────────────
    console.log("\n📚 Sửa dữ liệu kho kiến thức...");

    const catUpdates = [
      {
        id: "cat-faq",
        name: "FAQ",
        description: "Câu hỏi khách thường gặp",
      },
      {
        id: "cat-products",
        name: "Dịch vụ",
        description: "Thông tin dịch vụ và điểm nổi bật",
      },
      {
        id: "cat-policies",
        name: "Chính sách",
        description: "Đặt lịch, hủy lịch, bảo hành và khiếu nại",
      },
    ];

    for (const cat of catUpdates) {
      const result = await client.query(
        `UPDATE "Category" SET name = $1, description = $2 WHERE id = $3`,
        [cat.name, cat.description, cat.id]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ Đã cập nhật danh mục: ${cat.name}`);
      } else {
        console.log(`  ℹ Không tìm thấy danh mục "${cat.id}", bỏ qua.`);
      }
    }

    // ── 3. SỬA ENCODING KNOWLEDGE ENTRIES ────────────────────────────────────
    const entryUpdates = [
      {
        id: "entry-1",
        title: "Giờ làm việc",
        content:
          "Salon mở cửa từ Thứ hai đến Chủ nhật, 9:00 đến 20:00. Trợ lý AI hỗ trợ 24/7 với các câu hỏi cơ bản và sẽ chuyển nhân viên khi cần.",
      },
      {
        id: "entry-2",
        title: "Thông tin liên hệ",
        content:
          "Khách có thể liên hệ salon qua số điện thoại 0901 234 567, Zalo hoặc fanpage. Nếu cần xử lý gấp, bot sẽ ghi nhận và chuyển cho nhân viên tư vấn.",
      },
      {
        id: "entry-3",
        title: "Tổng quan dịch vụ",
        content:
          "Salon cung cấp các dịch vụ cắt, gội, uốn, nhuộm, phục hồi và chăm sóc da đầu. Bot sẽ hỏi tình trạng tóc, nhu cầu và ngân sách để gợi ý dịch vụ phù hợp trước khi chốt lịch.",
      },
      {
        id: "entry-4",
        title: "Chính sách đặt và hủy lịch",
        content:
          "Khách nên đặt lịch trước để salon sắp xếp kỹ thuật viên phù hợp. Nếu cần hủy hoặc đổi lịch, vui lòng báo sớm ít nhất 2 giờ để salon hỗ trợ tốt nhất.",
      },
      {
        id: "entry-5",
        title: "Chính sách bảo hành và khiếu nại",
        content:
          "Nếu khách chưa hài lòng sau dịch vụ, salon sẽ tiếp nhận phản hồi, kiểm tra tình trạng thực tế và hỗ trợ xử lý theo chính sách bảo hành. Các trường hợp khiếu nại sẽ được ưu tiên chuyển nhân viên phụ trách.",
      },
    ];

    for (const entry of entryUpdates) {
      const result = await client.query(
        `UPDATE "KnowledgeEntry" SET title = $1, content = $2 WHERE id = $3`,
        [entry.title, entry.content, entry.id]
      );
      if (result.rowCount > 0) {
        console.log(`  ✓ Đã cập nhật mục kiến thức: ${entry.title}`);
      } else {
        console.log(`  ℹ Không tìm thấy mục "${entry.id}", bỏ qua.`);
      }
    }

    await client.query("COMMIT");
    console.log("\n✅ Hoàn tất! Tất cả dữ liệu đã được cập nhật.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Lỗi:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
