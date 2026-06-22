# Bàn giao task tối ưu import Kho kiến thức bằng Gemini

## Tên commit đề xuất

`feat: add Gemini-assisted knowledge import preview`

## Tóm tắt

Task này tập trung tối ưu phần import dữ liệu vào Kho kiến thức, đặc biệt cho các file catalogue LED1000 có bố cục phức tạp như bảng giá Word/PDF/ảnh nhiều cột, nhiều bảng, có phần giới thiệu, quy trình, chính sách, FAQ và thông tin liên hệ.

Trước đây luồng import chủ yếu dựa vào parser thường. Với file Word có bảng phức tạp hoặc nhiều ảnh, dữ liệu dễ bị cắt sai, ghép nhầm tiêu đề/giá, hoặc import thành các mục quá vụn. Sau thay đổi này, hệ thống có thêm luồng đọc bằng Gemini, có màn hình xem trước có thể chỉnh sửa trước khi import thật.

Phạm vi task chỉ xử lý chất lượng dữ liệu đầu vào và luồng import. Không chỉnh lõi RAG, semantic search, model embedding, prompt chatbot chính hoặc logic trả lời cuối của chatbot.

## Đã triển khai

### 1. Thêm chế độ import có preview

Đã thêm API preview:

- `POST /api/knowledge/import/preview`
- File: `src/app/api/knowledge/import/preview/route.ts`

Luồng này chỉ đọc file và trả về danh sách chunk xem trước, chưa tạo `KnowledgeEntry` trong database.

Preview trả về:

- tên file
- loại source
- số chunk
- confidence trung bình
- số chunk confidence thấp
- warnings
- danh sách section gồm `title`, `content`, `metadata`, `parserConfidence`

### 2. Thêm luồng import sau khi đã review

Đã thêm API reviewed import:

- `POST /api/knowledge/import/reviewed`
- File: `src/app/api/knowledge/import/reviewed/route.ts`

Luồng này nhận các section đã được người dùng chọn/sửa ở preview, sau đó mới tạo `KnowledgeEntry`.

Sau khi tạo entry, hệ thống vẫn gọi lại luồng cũ:

- `indexKnowledgeEntry(entry.id, settings.aiApiKey)`

Vì vậy embedding/indexing vẫn đi theo cơ chế hiện có của dự án.

### 3. Cập nhật UI import trong trang Kho kiến thức

File: `src/app/(dashboard)/knowledge/page.tsx`

Đã bổ sung:

- chọn mode import: Parser thường hoặc Đọc bằng Gemini
- upload file rồi bấm `Xem trước`
- chỉnh sửa title/content từng chunk trước khi import
- chọn/bỏ chọn từng chunk
- chọn tất cả/bỏ chọn tất cả
- hiển thị confidence
- hiển thị cảnh báo `Cần kiểm tra giá` hoặc `Giá đáng nghi`
- sau khi tạo danh mục mới, tự chọn đúng danh mục vừa tạo thay vì nhảy về danh mục đầu tiên
- sửa lỗi input mất focus khi gõ tên kiến thức trong preview

### 4. Thêm Gemini document import

File: `src/lib/knowledge/gemini-import.ts`

Luồng Gemini hỗ trợ:

- PDF
- ảnh `png`, `jpg/jpeg`, `webp`, `heic/heif`
- DOCX
- TXT/MD
- Excel/CSV thông qua text extract

Với PDF và ảnh, file được gửi trực tiếp cho Gemini dưới dạng inline data.

Với DOCX, đã thêm parser OpenXML bằng:

- `jszip`
- `@xmldom/xmldom`

DOCX parser đọc:

- `word/document.xml`
- paragraph
- heading
- table
- merged cell gần đúng qua `gridSpan` và `vMerge`
- image reference trong `word/media`

Giới hạn ảnh DOCX hiện tại:

- tối đa 8 ảnh gửi kèm Gemini
- mỗi ảnh tối đa 1.5MB
- ảnh vượt giới hạn sẽ bị bỏ qua và có warning

Lý do chọn hướng này: không cần cài LibreOffice/`soffice`, đỡ bất tiện khi bàn giao cho khách hàng hoặc chạy ở môi trường deployment.

### 5. Gemini model fallback

File:

- `src/lib/ai/catalog.ts`
- `src/lib/ai/provider.ts`
- `src/lib/knowledge/gemini-import.ts`

Model chính cho document import:

- `gemini-2.5-pro`

Nếu model chính không dùng được hoặc bị lỗi model/unavailable, hệ thống fallback sang:

- `gemini-2.5-flash`

Lỗi Gemini API hiện được trả chi tiết hơn, ví dụ HTTP 503 high demand, để UI hiển thị rõ lý do.

### 6. Mở rộng parser thường

File: `src/lib/knowledge/import.ts`

Parser thường vẫn được giữ để dùng cho file text rõ ràng, không tốn AI.

Đã tối ưu thêm cho các dạng phổ biến:

- FAQ có nhãn câu hỏi/trả lời linh hoạt hơn
- bảng giá LED1000
- bảng dịch vụ có nhiều dòng mô tả
- intro/heading/chunk text fallback
- workbook/Excel/CSV
- giới hạn số section tăng lên 200
- chunk mặc định 1400 ký tự, overlap 160 ký tự

### 7. Phân loại nội dung Gemini chunk

Gemini prompt/schema đã được mở rộng để phân loại nhiều loại kiến thức, không chỉ bảng giá:

- `price`
- `faq`
- `policy`
- `warranty`
- `process`
- `service`
- `product`
- `promotion`
- `membership`
- `contact`
- `hours`
- `intro`
- `note`

Mục tiêu: file catalogue LED1000 có nhiều loại thông tin khác nhau thì không bị ép hết thành bảng giá.

### 8. Validator giá và cảnh báo review

Đã thêm các cảnh báo trước khi import:

- thiếu giá so với source
- giá đáng nghi quá thấp kiểu `từ 850 VNĐ*`, có thể là đọc thiếu `K` hoặc thiếu số 0
- confidence thấp

Quan trọng: cảnh báo giá hiện chỉ áp vào chunk có token giá thật. Nếu Gemini lỡ phân loại một ghi chú thành `price` nhưng nội dung không có giá, hệ thống không còn gắn `Cần kiểm tra giá` nhầm.

Các label review hiện có:

- `Cần kiểm tra giá`
- `Giá đáng nghi`

## Kết quả kiểm thử

Đã chạy TypeScript:

```bash
npx tsc --noEmit
```

Kết quả: pass.

Đã chạy test liên quan import:

```bash
npm test -- tests/unit/gemini-import.test.ts tests/unit/knowledge-import.test.ts tests/api/knowledge-import-preview.test.ts tests/api/knowledge-import-reviewed.test.ts
```

Kết quả gần nhất:

- 4 test files pass
- 23 tests pass

Lưu ý trên Windows/Vite, test cần chạy ngoài sandbox trong một số môi trường do lỗi `spawn EPERM`.

## Kết quả thử với file catalogue LED1000 thực tế

File thử: `Data.docx`

Kết quả preview gần nhất:

- tách được 38 mục
- confidence trung bình khoảng 78%
- 19 mục bị đánh dấu confidence thấp/cần kiểm tra
- DOCX OpenXML đọc được paragraph/heading/table
- bỏ qua 49 ảnh DOCX do vượt giới hạn số lượng/kích thước
- fallback model từ `gemini-2.5-pro` sang `gemini-2.5-flash`
- cảnh báo còn thiếu 166/410 giá từ source theo validator

Các phần không phải giá đã được phân loại tốt hơn:

- giới thiệu doanh nghiệp LED1000
- thương hiệu sản phẩm
- phân loại thông số sản phẩm
- mô tả dịch vụ
- quy trình
- chính sách bảo hành
- FAQ
- thời gian thực hiện
- thông tin liên hệ

Các phần bảng giá vẫn cần review thủ công trước khi import, đặc biệt những bảng có layout rất dày hoặc có text trong ảnh.

## Cách sử dụng đề xuất

### Parser thường

Dùng khi:

- file TXT/MD rõ ràng
- Excel/CSV đơn giản
- file Word/PDF đã có text dễ đọc
- muốn import nhanh, không tốn Gemini

### Đọc bằng Gemini

Dùng khi:

- file PDF bảng giá nhiều cột
- ảnh chụp bảng giá
- DOCX nhiều bảng
- tài liệu có heading, bảng, mô tả, FAQ, chính sách lẫn nhau

Với Word nhiều ảnh/bảng phức tạp, nên xuất sang PDF rồi import bằng Gemini để Gemini đọc bố cục thị giác tốt hơn.

### Trước khi import thật

Nên kiểm tra các mục:

- có label `Cần kiểm tra giá`
- có label `Giá đáng nghi`
- confidence dưới 75%
- bảng giá nhiều cột, có size S/M/L/XL
- bảng có giá dạng `K`, `VNĐ*`, range giá

## So với bản gốc của dự án

### Tốt hơn

- Có preview trước khi import thật
- Có thể chỉnh tay từng chunk
- Có Gemini đọc PDF/ảnh/DOCX phức tạp
- Có cảnh báo confidence
- Có cảnh báo thiếu giá/giá đáng nghi
- Có metadata chi tiết hơn cho chunk import
- Vẫn giữ luồng embedding/indexing cũ sau khi confirm import

### Vẫn giữ nguyên

- model embedding hiện tại
- `indexKnowledgeEntry`
- `searchKnowledgeBase`
- prompt chatbot chính
- logic RAG/retrieval
- database schema `KnowledgeEntry.metadata.embedding`

## Phạm vi không chỉnh

Các phần sau chưa triển khai vì nằm ngoài phạm vi task import:

- Không đổi model embedding
- Không thêm pgvector
- Không sửa semantic search/retrieval
- Không thêm rerank
- Không sửa prompt chatbot chính
- Không đánh giá tự động chất lượng trả lời cuối của chatbot
- Không đảm bảo chatbot trả lời đúng 100% sau import nếu retrieval/RAG lấy sai chunk

Nói cách khác: task này cải thiện chất lượng dữ liệu đầu vào, còn chất lượng trả lời cuối vẫn phụ thuộc vào RAG/embedding hiện có của dự án.

## Rủi ro còn lại

1. DOCX nhiều ảnh vẫn có thể mất thông tin vì chỉ gửi một số ảnh nhỏ cho Gemini.
2. Bảng giá quá dày có thể bị Gemini đọc thiếu hoặc lệch cột.
3. Giá dạng `850 VNĐ*`, `999 VNĐ*` có thể là lỗi đọc thiếu `K` hoặc thiếu số 0, cần người dùng sửa ở preview.
4. Validator giá hiện là heuristic, dùng để cảnh báo chứ không thay thế review thủ công.
5. Trang test knowledge hiện tại có thể không phản ánh đúng chatbot thật nếu nó nhét toàn bộ knowledge vào prompt. Chatbot thật dùng retrieval top 10.
6. Nếu Gemini API bị 503/high demand thì import Gemini có thể thất bại tạm thời.

## Đề xuất bàn giao cho phase sau

Chưa triển khai / Đề xuất Phase sau:

- tạo bộ câu hỏi đánh giá RAG thực tế cho LED1000
- test retrieval top 10 theo đúng luồng chatbot
- thêm rerank kết quả retrieval bằng Gemini
- cân nhắc pgvector nếu số lượng knowledge lớn
- thêm màn hình hiển thị source chunk mà chatbot đã dùng khi trả lời
- cho phép import PDF được ưu tiên hơn DOCX đối với file có nhiều bảng/ảnh

## File chính đã thay đổi/thêm

- `src/lib/knowledge/import.ts`
- `src/lib/knowledge/gemini-import.ts`
- `src/lib/ai/catalog.ts`
- `src/lib/ai/provider.ts`
- `src/app/(dashboard)/knowledge/page.tsx`
- `src/app/api/knowledge/import/preview/route.ts`
- `src/app/api/knowledge/import/reviewed/route.ts`
- `tests/unit/gemini-import.test.ts`
- `tests/api/knowledge-import-preview.test.ts`
- `tests/api/knowledge-import-reviewed.test.ts`
- `tests/unit/knowledge-import.test.ts`
- `package.json`
- `package-lock.json`

## Dependencies đã thêm

- `jszip`
- `@xmldom/xmldom`

## Kết luận

Task import đã được nâng từ luồng parser/import trực tiếp sang luồng có preview, review thủ công, Gemini document understanding và cảnh báo dữ liệu đáng nghi. Đây là cải thiện rõ so với bản gốc ở phần đưa dữ liệu vào Kho kiến thức.

Tuy nhiên chưa nên cam kết chất lượng chatbot trả lời cuối nếu chưa có đánh giá riêng cho retrieval/RAG. Phần này nên được tách thành task khác để đúng phạm vi và trách nhiệm kỹ thuật.
