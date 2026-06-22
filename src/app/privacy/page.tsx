import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chính sách quyền riêng tư - LinhKienLed1000",
  description: "Chính sách quyền riêng tư của ứng dụng LinhKienLed1000.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-owly-bg px-6 py-12 text-owly-text">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3 border-b border-owly-border pb-6">
          <p className="text-sm font-medium text-owly-text-light">
            Cập nhật lần cuối: 31/05/2026
          </p>
          <h1 className="text-3xl font-semibold">Chính sách quyền riêng tư</h1>
          <p className="text-base leading-7 text-owly-text-light">
            Chính sách này mô tả cách ứng dụng LinhKienLed1000 xử lý dữ liệu trong quá
            trình vận hành CRM và chatbot AI/RAG chăm sóc khách hàng đa kênh cho
            doanh nghiệp.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Mục đích xử lý dữ liệu</h2>
          <p className="leading-7">
            LinhKienLed1000 được dùng để hỗ trợ doanh nghiệp quản lý hội thoại, lưu lịch sử
            chăm sóc khách hàng, vận hành chatbot tư vấn tự động và cải thiện
            chất lượng hỗ trợ khách hàng trên các kênh tích hợp.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Dữ liệu có thể được xử lý</h2>
          <ul className="list-disc space-y-2 pl-6 leading-7">
            <li>
              Nội dung tin nhắn khách hàng gửi qua web chat, Facebook,
              Instagram, WhatsApp, Email hoặc các kênh tích hợp khác.
            </li>
            <li>
              Thông tin định danh nền tảng như sender ID, user ID, email hoặc số
              điện thoại nếu được nền tảng cung cấp.
            </li>
            <li>
              Lịch sử hội thoại và thông tin CRM do doanh nghiệp nhập hoặc khách hàng
              cung cấp.
            </li>
            <li>
              Log kỹ thuật phục vụ vận hành, kiểm thử, bảo mật và debug hệ
              thống.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Cách sử dụng dữ liệu</h2>
          <p className="leading-7">
            Dữ liệu chỉ được dùng để vận hành chatbot, lưu lịch sử chăm sóc
            khách hàng, cải thiện chất lượng tư vấn và hỗ trợ khách hàng khi có
            yêu cầu. LinhKienLed1000 không bán dữ liệu người dùng cho bên thứ ba.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Yêu cầu xóa dữ liệu</h2>
          <p className="leading-7">
            Người dùng có thể yêu cầu xóa dữ liệu bằng cách gửi email tới{" "}
            <a className="text-owly-primary underline" href="mailto:linhkienled1000@gmail.com">
              linhkienled1000@gmail.com
            </a>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
