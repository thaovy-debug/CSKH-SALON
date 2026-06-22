# LED1000 Crawl and Knowledge Import Guide

## Mục tiêu

Script `scripts/crawl-led1000-knowledge.ts` dùng để crawl một lần website `https://linhkienled1000.com/` và xuất dữ liệu seed ban đầu cho Knowledge Base.

Script không tích hợp vào UI, không ghi database, không đổi Prisma schema, không chạm prompt AI và không ảnh hưởng Meta/Facebook/Instagram flow.

## Cách chạy

Chạy thử giới hạn 20 trang:

```bash
npx tsx scripts/crawl-led1000-knowledge.ts --max-pages=20
```

Chạy mặc định tối đa 80 trang:

```bash
npx tsx scripts/crawl-led1000-knowledge.ts
```

Tùy chọn hữu ích:

```bash
npx tsx scripts/crawl-led1000-knowledge.ts --max-pages=80 --delay-ms=600 --timeout-ms=15000
```

## Output

Script ghi ra:

- `data/knowledge/led1000-website.md`
- `data/knowledge/led1000-website.json`
- `data/knowledge/led1000-crawl-report.json`

File Markdown được thiết kế để upload vào Knowledge Base sau khi review. File JSON dùng để kiểm tra nguồn, loại trang, category và content từng URL. File report ghi số record theo loại trang, số URL skip, duplicate đã bỏ, độ dài trung bình, record còn HTML entities và record quá ngắn.

## Cách import vào Knowledge Base

1. Mở Dashboard.
2. Vào `Kho kiến thức`.
3. Tạo hoặc chọn category phù hợp, ví dụ `LED1000 Website Seed`.
4. Upload `data/knowledge/led1000-website.md`.
5. Chọn chế độ preview/review trước khi import.
6. Kiểm tra các chunk về giá, chính sách, bảo hành, thông tin liên hệ.
7. Chỉ xác nhận import sau khi nội dung đã sạch và đúng ngữ cảnh.

Không import trực tiếp file JSON vào database trong phase này. JSON chỉ là file kiểm tra nguồn.

Script đã cleanup menu/footer ở mức best-effort và rút gọn các trang listing sản phẩm để dễ dùng cho RAG hơn. Tuy vậy vẫn nên mở `data/knowledge/led1000-website.md` đọc lại trước khi upload chính thức, nhất là các đoạn giá, hotline, chính sách giao hàng và mô tả sản phẩm dài.

## Câu hỏi test chatbot sau khi import

- LED1000 bán những nhóm sản phẩm nào?
- Tôi cần nguồn cho LED dây 12V dài 5m thì cần cung cấp thông số gì?
- Shop có thông tin bảo hành hoặc đổi trả không?
- Tôi muốn mua đèn LED trang trí ngoài trời, cần lưu ý gì?
- Có sản phẩm nguồn LED, module LED hoặc phụ kiện điều khiển không?
- Nếu chưa biết mã sản phẩm thì bot có hỏi lại thông số điện áp, công suất, trong nhà/ngoài trời không?
- Nếu hỏi giá hoặc tồn kho mà dữ liệu không có, bot có từ chối bịa và yêu cầu mã sản phẩm/hotline không?

## Giới hạn và lưu ý

- Dữ liệu crawl từ website chỉ là seed ban đầu.
- Giá/tồn kho crawl từ website chỉ nên dùng để seed test pipeline. Nếu muốn bot báo giá chính xác, khách cần upload bảng giá chính thức hoặc catalogue mới nhất vào Knowledge Base.
- Giá, tồn kho, khuyến mãi, catalogue mới nhất và chính sách chính xác nên do khách xác nhận/upload thêm qua Knowledge Base.
- Catalogue PDF scan ảnh có thể không đọc tốt nếu không dùng OCR hoặc Gemini import mode.
- Bảng giá Excel nhiều sheet, nhiều cột hoặc ô gộp cần review kỹ trước khi import.
- Crawler cố gắng bỏ menu/footer/header/search/cart và decode HTML entities như `&eacute;`, `&acirc;`, `&Agrave;`, nhưng vẫn cần kiểm tra lại Markdown trước khi đưa vào chatbot.
- Script chỉ crawl domain `linhkienled1000.com` và bỏ qua cart, checkout, account, login, search, add-to-cart, external links.
- Nếu thấy HTML entities còn sót trong `led1000-crawl-report.json` hoặc Markdown, fix helper decode trong crawler rồi rerun script trước khi import.

## Khi nào cần crawl lại

Crawl lại khi website thay đổi lớn về danh mục sản phẩm, chính sách, liên hệ hoặc nội dung catalogue. Sau khi crawl lại, luôn review `led1000-website.md` trước khi import.
