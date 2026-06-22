import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hướng dẫn xóa dữ liệu người dùng - LinhKienLed1000",
  description: "Cách yêu cầu xóa dữ liệu người dùng khỏi LinhKienLed1000.",
};

export default function DataDeletionPage() {
  return (
    <main className="min-h-screen bg-owly-bg px-6 py-12 text-owly-text">
      <article className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-3 border-b border-owly-border pb-6">
          <p className="text-sm font-medium text-owly-text-light">
            Cập nhật lần cuối: 31/05/2026
          </p>
          <h1 className="text-3xl font-semibold">Hướng dẫn xóa dữ liệu người dùng</h1>
          <p className="text-base leading-7 text-owly-text-light">
            Người dùng có thể yêu cầu xóa dữ liệu liên quan đến hội thoại hoặc
            thông tin CRM đang được lưu trong LinhKienLed1000.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Cách gửi yêu cầu</h2>
          <p className="leading-7">
            Vui lòng gửi email tới{" "}
            <a className="text-owly-primary underline" href="mailto:linhkienled1000@gmail.com">
              linhkienled1000@gmail.com
            </a>{" "}
            với tiêu đề đề xuất:
          </p>
          <p className="rounded border border-owly-border bg-owly-surface px-4 py-3 font-mono text-sm">
            Data Deletion Request - LinhKienLed1000
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Thông tin nên cung cấp</h2>
          <ul className="list-disc space-y-2 pl-6 leading-7">
            <li>Nền tảng đã sử dụng: Facebook, Instagram, WhatsApp, Email hoặc Web chat.</li>
            <li>Thời gian tương tác gần đúng.</li>
            <li>
              Thông tin nhận diện nếu có: username, sender ID, email hoặc số
              điện thoại.
            </li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Quy trình xử lý</h2>
          <p className="leading-7">
            Sau khi nhận yêu cầu, dữ liệu liên quan sẽ được kiểm tra và xóa nếu
            còn được lưu trong hệ thống. Đội ngũ vận hành có thể cần thêm thông tin để xác
            định đúng hồ sơ hoặc hội thoại cần xóa.
          </p>
        </section>
      </article>
    </main>
  );
}
