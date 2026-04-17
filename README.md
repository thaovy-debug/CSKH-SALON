# CSKH-SALON (Minh Hy Hair Bot)

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black.svg" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.x-blue.svg" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-16+-336791.svg" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/AI-Gemini_Pro-orange.svg" alt="Gemini AI" />
  <img src="https://img.shields.io/badge/Status-Production_Ready-brightgreen.svg" alt="Status" />
</p>

Hệ thống CRM & Bot Chat AI tự động chăm sóc khách hàng đa kênh (WhatsApp, Email), được tùy biến riêng cho **Salon Tóc Minh Hy Hair**. 

Hệ thống sử dụng công nghệ **RAG (Retrieval-Augmented Generation)** kết hợp với AI tiên tiến để đọc hiểu bảng giá, kiến thức ngành tóc và tự động tư vấn khách hàng như một nhân viên thực thụ.

---

## 🌟 Tính Năng Nổi Bật

* **AI Tư Vấn Tự Động (RAG):** Trả lời câu hỏi khách hàng tự nhiên, đảm bảo "Zero-Hallucination" (không tự bịa thông tin). AI phân tích dữ liệu kiến thức (Knowledge Base) và các câu hỏi thường gặp (FAQ) để phản hồi chính xác.
* **Báo Giá 2 Bước Thông Minh:** Khả năng tự động nhận diện size tóc (S, M, L, XL), nền tóc (đã tẩy/chưa tẩy) và hỏi thêm dữ kiện trước khi báo giá chi tiết. Xử lý mượt mà các dịch vụ phức tạp (Balayage, Highlight).
* **Quản Lý Đa Kênh Tập Trung:** Giao tiếp liền mạch qua WhatsApp (kết nối quét mã QR trực tiếp) và Email trên một giao diện thống nhất.
* **Giao Diện Việt Hóa 100%:** Dashboard quản trị được tối ưu hóa bằng tiếng Việt, giúp đội ngũ nhân viên salon dễ dàng thao tác. Cho phép tùy chỉnh Logo và Tên thương hiệu.
* **Hồ Sơ Khách Hàng (CRM):** Tự động lưu trữ lịch sử hội thoại, tình trạng hóa chất (tẩy/nhuộm) và sở thích của khách để tư vấn cá nhân hóa cho các lần sau.

---

## 🛠 Tech Stack

* **Framework:** Next.js 14 (App Router)
* **Ngôn Ngữ:** TypeScript 5
* **Database & ORM:** PostgreSQL 16 + Prisma
* **Styling:** Tailwind CSS 4 + Radix UI
* **AI Engine:** Google Gemini (Hỗ trợ cấu hình Prompt hệ thống)
* **Tích Hợp Kênh:** `whatsapp-web.js` (WhatsApp), IMAP/SMTP (Email)
* **Bảo Mật:** JWT Authentication, phân quyền Admin

---

## 🚀 Hướng Dẫn Cài Đặt (Quick Start)

### 1. Yêu cầu hệ thống
* **Node.js** >= 20
* **PostgreSQL** >= 16

### 2. Cài đặt mã nguồn
```bash
# Clone the repository
git clone https://github.com/thaovy-debug/CSKH-SALON.git
cd CSKH-SALON

# Install dependencies
npm install
```

### 3. Cấu hình môi trường
Tạo file `.env` (có thể copy từ `.env.example`) và điền các thông tin bảo mật:
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/salon_db"

# AI
GEMINI_API_KEY="your-gemini-api-key"

# Redis (Tùy chọn, dùng cho cache & kết nối WhatsApp ổn định hơn)
REDIS_URL="redis://localhost:6379"

# JWT Secret
JWT_SECRET="your-secure-secret-key-here"
```

### 4. Khởi chạy dữ liệu và chạy Server
```bash
# Tạo cấu trúc Database
npx prisma migrate dev

# Tạo dữ liệu mẫu (Tài khoản Admin mặc định)
npm run db:seed

# Khởi chạy ứng dụng
npm run dev
```

Truy cập `http://localhost:3000` để bắt đầu quản trị hệ thống. 
*Tài khoản mặc định thường là `admin` / `admin123` (Cấu hình trong seed).*

---

## 🧠 Logic Phản Hồi Của AI (System Prompt Logic)

Bot được lập trình chặt chẽ để phục vụ ngành làm đẹp (tóc nữ):
1. **Xác định dịch vụ:** Thông qua hệ thống Alias (vd: "combo 40 phút" -> "Gội đầu thư giãn 40 phút").
2. **Hỏi & Báo Giá:**
   * *Khách:* "Nhuộm bao nhiêu?"
   * *Bot:* "Dạ nhuộm tóc bên em có giá từ 500k. Chị cho em hỏi tóc mình dài tới đâu và đã từng tẩy chưa ạ?"
   * *Khách:* "Tóc mình ngang vai, chưa tẩy."
   * *Bot:* Báo giá chính xác kèm quy trình cho tóc size M chưa tẩy.
3. **Chốt Sale & Fallback:** Xử lý các ca khó (Tóc nát, tẩy nhiều lần) bằng cách mời gửi ảnh tình trạng thực tế để Stylist kiểm tra.

---
*Dự án được xây dựng và tùy biến đặc quyền cho hệ sinh thái Chăm Sóc Khách Hàng của **Minh Hy Hair**.*
