/**
 * Script cập nhật dữ liệu database sang tiếng Việt:
 * 1. Cập nhật canned-responses từ tiếng Anh sang tiếng Việt
 * 2. Sửa encoding lỗi trong knowledge categories & entries
 */
const { Pool } = require("pg");

const connectionString =
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/linhkienled1000?schema=public";

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
        title: "Chào khách LED1000",
        content:
          "Xin chào! Linh Kiện LED1000 có thể hỗ trợ bạn về đèn LED, nguồn điện, linh kiện LED hoặc phụ kiện chiếu sáng nào hôm nay?",
        category: "Chung",
        shortcut: "/chao",
      },
      {
        id: "cr-2",
        title: "Kết thúc tư vấn",
        content:
          "Cảm ơn bạn đã liên hệ Linh Kiện LED1000. Khi cần kiểm tra thêm mã hàng, giá hoặc tồn kho, bạn cứ nhắn lại nhé!",
        category: "Chung",
        shortcut: "/tambit",
      },
      {
        id: "cr-3",
        title: "Hỏi mã sản phẩm",
        content:
          "Bạn gửi giúp mình mã sản phẩm, điện áp, công suất hoặc ảnh tem thông số để bên mình kiểm tra đúng loại hàng nhé.",
        category: "Tư vấn sản phẩm",
        shortcut: "/masp",
      },
      {
        id: "cr-4",
        title: "Chuyển kỹ thuật",
        content:
          "Mình sẽ chuyển thông tin cho bộ phận kỹ thuật LED1000 để hỗ trợ chính xác hơn. Bạn vui lòng chờ trong giây lát.",
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
        name: "Sản phẩm",
        description: "Thông tin sản phẩm, thông số và điểm nổi bật",
      },
      {
        id: "cat-policies",
        name: "Chính sách",
        description: "Bảo hành, đổi trả, giao hàng và hỗ trợ sau bán",
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
          "Linh Kiện LED1000 hỗ trợ khách hàng trong giờ làm việc của cửa hàng. Trợ lý AI có thể tiếp nhận câu hỏi cơ bản 24/7 và chuyển nhân viên khi cần kiểm tra giá, tồn kho hoặc kỹ thuật.",
      },
      {
        id: "entry-2",
        title: "Thông tin liên hệ",
        content:
          "Khách có thể liên hệ Linh Kiện LED1000 qua hotline/Zalo 0909003082 hoặc 0972 90 25 25. Nếu cần xử lý gấp, bot sẽ ghi nhận và chuyển cho nhân viên tư vấn.",
      },
      {
        id: "entry-3",
        title: "Tổng quan sản phẩm",
        content:
          "Linh Kiện LED1000 cung cấp đèn LED, nguồn điện, LED dây, module LED, linh kiện LED, phụ kiện điều khiển và sản phẩm chiếu sáng trang trí. Bot cần hỏi điện áp, công suất, chiều dài, môi trường lắp đặt và nhu cầu sử dụng trước khi tư vấn.",
      },
      {
        id: "entry-4",
        title: "Quy tắc báo giá",
        content:
          "Giá và tồn kho phải đối chiếu bảng giá hoặc nhân viên phụ trách. Nếu Knowledge Base chưa có dữ liệu chính thức, bot không tự bịa giá và nên đề nghị khách cung cấp mã sản phẩm hoặc liên hệ hotline.",
      },
      {
        id: "entry-5",
        title: "Chính sách bảo hành và hỗ trợ",
        content:
          "Các vấn đề bảo hành, đổi trả hoặc lỗi kỹ thuật cần kiểm tra mã hàng, tình trạng sản phẩm và chứng từ mua hàng. Trường hợp phức tạp sẽ được chuyển cho nhân viên phụ trách.",
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
