# LinhKienLed1000 CSKH

Hệ thống CRM và chatbot AI đa kênh cho **Linh Kiện LED1000** (`https://linhkienled1000.com/`), tập trung vào tư vấn đèn LED, nguồn điện, linh kiện LED, phụ kiện chiếu sáng, catalogue và bảng giá.

## Tính Năng Chính

- **AI tư vấn RAG:** Trả lời dựa trên Knowledge Base, tránh tự bịa giá, tồn kho, bảo hành hoặc khuyến mãi khi chưa có dữ liệu chính thức.
- **Tư vấn sản phẩm LED:** Hỏi rõ điện áp, công suất, chiều dài LED dây, môi trường lắp đặt trong nhà/ngoài trời, nhu cầu bảng hiệu/trang trí/hắt trần.
- **CRM khách hàng:** Lưu lịch sử hội thoại, nhu cầu kỹ thuật, bối cảnh mua hàng, trạng thái báo giá và ghi chú tư vấn.
- **Đa kênh:** Hỗ trợ web chat, WhatsApp, Email, Zalo, SMS/Phone và Meta webhook cho Facebook/Instagram.
- **Kho kiến thức:** Import Markdown, TXT, CSV, Excel, Word, PDF; có chế độ Gemini import cho tài liệu/catelogue phức tạp.

## Tech Stack

- Next.js App Router, React, TypeScript
- PostgreSQL và Prisma
- Tailwind CSS, Radix UI
- Google Gemini/OpenAI provider tùy cấu hình
- Vitest cho unit/API tests

## Quick Start

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run db:seed
npm run dev
```

Ứng dụng chạy tại:

```txt
http://localhost:3000
```

Database mặc định trong ví dụ:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/linhkienled1000?schema=public"
```

## Knowledge Base LED1000

Dữ liệu crawl website một lần nằm ở:

```txt
data/knowledge/led1000-website.md
data/knowledge/led1000-website.json
data/knowledge/led1000-crawl-report.json
```

File nên upload vào Knowledge Base là:

```txt
data/knowledge/led1000-website.md
```

Giá và tồn kho crawl từ website chỉ là seed ban đầu. Nếu muốn bot báo giá chính xác, khách cần upload bảng giá hoặc catalogue chính thức mới nhất.

## Meta App Legal URLs

Khi cấu hình Meta Developer App cho Facebook Messenger hoặc Instagram Messaging, dùng domain public của ứng dụng:

```txt
Privacy Policy URL: <APP_URL>/privacy
Terms of Service URL: <APP_URL>/terms
Data Deletion URL: <APP_URL>/data-deletion
Webhook Callback URL: <APP_URL>/api/webhooks/meta
```

## Test Gợi Ý

```bash
npx tsc --noEmit
npm test
npx tsx scripts/test-led1000-chatbot.ts --base-url=http://localhost:3000 --api-key=<NEW_API_KEY>
```

Các câu hỏi nên kiểm tra sau khi import Knowledge Base:

- LED1000 bán những nhóm sản phẩm nào?
- Có bán adapter 12V không?
- Tôi muốn mua nguồn cho LED dây 10m, chọn loại nào?
- LED dây ngoài trời nên chọn loại nào?
- Giá adapter 12V 5A bao nhiêu?

Nếu chưa có bảng giá chính thức, bot phải nói cần đối chiếu dữ liệu/hotline thay vì tự bịa.
