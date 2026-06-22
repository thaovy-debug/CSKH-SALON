# LED1000 Chatbot Capability Audit

Ngày audit: 2026-06-18

## Mục tiêu

Tài liệu này tổng hợp hiện trạng chatbot LED1000 so với các yêu cầu vận hành bán hàng/CSKH do lead nêu:

- Tư vấn sản phẩm đèn LED dây, nguồn điện, đèn pha LED.
- Học sản phẩm qua hình ảnh và thông số kỹ thuật.
- Phân loại khách hàng: khách lẻ, khách công trình, cửa hàng.
- Tính giá theo bảng giá niêm yết và phân loại khách hàng.
- Báo giá sơ bộ.
- Kiểm tra tồn kho và gợi ý sản phẩm thay thế.
- Hỏi thông tin công trình.
- Chính sách bảo hành.
- Hướng dẫn xuất VAT.
- Chuyển khách cho nhân viên khi cần.
- Bổ sung nhiều tài khoản Facebook, Zalo, Shopee.

Phạm vi audit ban đầu khảo sát code, schema, script, docs, test và dữ liệu seed trong repo.

Cập nhật triển khai data-ready: repo đã bổ sung taxonomy Knowledge Base LED1000, template entry cho từng nhóm dữ liệu chính thức, gợi ý danh mục khi preview import, nhận diện `documentKind` bằng Gemini và rule prompt để chatbot không phụ thuộc dữ liệu thật ở giai đoạn chuẩn bị.

## Kết luận tổng quan

Hệ thống hiện có nền tảng tốt cho chatbot CSKH/RAG LED1000:

- Có prompt runtime nhận vai trò tư vấn sản phẩm LED1000.
- Có Knowledge Base, semantic search, import PDF/Word/Excel/CSV/TXT/MD.
- Có import bằng Gemini cho PDF/ảnh/bảng giá khó đọc.
- Có crawler seed website `linhkienled1000.com`.
- Có ticket, team member, assign theo expertise và escalation.
- Có channel Facebook/Instagram/Zalo/WhatsApp/email/phone ở mức một cấu hình chính cho mỗi loại kênh.

Tuy nhiên hệ thống chưa đủ để cam kết toàn bộ mục tiêu vận hành thật:

- Chưa có customer classification tự động cho khách lẻ/công trình/cửa hàng.
- Chưa có pricing engine theo nhóm khách hoặc chiết khấu.
- Chưa có inventory model/API/tool để kiểm tra tồn kho.
- Chưa có product replacement logic dựa trên thông số và tồn kho.
- Chưa có chatbot runtime đọc ảnh khách gửi trong hội thoại.
- Chưa có Shopee integration.
- Chưa hỗ trợ nhiều tài khoản cùng loại kênh theo kiến trúc hiện tại vì `Channel.type` đang unique.

## Bảng đối chiếu yêu cầu

| Yêu cầu | Trạng thái | Nhận xét |
| --- | --- | --- |
| Tư vấn LED dây, nguồn điện, đèn pha LED | Có nền tốt | Prompt đã hướng bot hỏi điện áp, công suất, chiều dài, IP, trong/ngoài trời. Seed website có danh mục LED dây, nguồn, đèn pha. |
| Học hình ảnh và thông số kỹ thuật | Partial | Import Knowledge bằng Gemini hỗ trợ PDF/ảnh/file có bảng. Nhưng chatbot khi khách gửi ảnh trong hội thoại chưa phân tích ảnh thật. |
| Phân loại khách lẻ/công trình/cửa hàng | Chưa có tự động | Customer có `tags`, `purchaseContext`, `technicalNeeds`, nhưng chưa có classifier tự gán nhóm khách. |
| Tính giá theo bảng giá và loại khách | Chưa có engine | Parser import bảng giá có thể đưa giá vào KB, nhưng chưa có logic tính giá theo segment/chiết khấu. |
| Báo giá sơ bộ | Partial | Bot có thể báo giá nếu KB retrieve đúng chunk có giá cụ thể. Nếu thiếu dữ liệu, prompt yêu cầu hỏi thêm hoặc chuyển nhân viên. |
| Kiểm tra tồn kho | Chưa có | Không thấy schema/API/tool inventory. Bot hiện được dặn không bịa tồn kho. |
| Gợi ý sản phẩm thay thế | Partial yếu | Có thể gợi ý mềm từ KB, nhưng chưa có logic thay thế theo SKU/thông số/tồn kho. |
| Hỏi thông tin công trình | Có nền | Prompt đã yêu cầu hỏi mục đích, môi trường, điện áp, công suất, số lượng, IP, màu ánh sáng. |
| Chính sách bảo hành | Partial theo data | Seed có vài dòng bảo hành, nhưng crawl report hiện `policy: 0`; cần chính sách chính thức từ khách. |
| Hướng dẫn xuất VAT | Partial rất yếu | Seed có dòng "GIÁ ĐÃ BAO GỒM VAT", importer nhận biết VAT, nhưng chưa có hướng dẫn xuất VAT đầy đủ. |
| Chuyển khách cho nhân viên | Có nền, cần siết rule | Có `create_ticket`, `assign_to_person`, team expertise và conversation `escalated`; trigger còn phụ thuộc model/guardrail. |
| Nhiều tài khoản Facebook/Zalo/Shopee | Chưa sẵn sàng | Hiện `Channel.type` unique, mỗi loại kênh một config chính. Shopee chưa có integration. |

## Cập nhật Phase Data-Ready

Đã bổ sung khung triển khai trước khi có dữ liệu chính thức:

- Danh mục Knowledge Base LED1000 chuẩn hóa: hồ sơ doanh nghiệp, catalogue sản phẩm, bảng giá, tồn kho, bảo hành, đổi trả, VAT, tư vấn kỹ thuật, phân loại khách hàng, kịch bản tư vấn và tài khoản kênh bán hàng.
- Template entry cho từng danh mục để bot hiểu nguyên tắc xử lý khi chưa có file thật.
- Gemini document import nhận diện `documentKind` tổng thể trước khi tách chunk, ví dụ `price_list`, `inventory`, `warranty_policy`, `vat_invoice`, `technical_guide`, `channel_accounts`.
- Preview import trả về danh mục gợi ý dựa trên metadata Gemini và heuristic nội dung.
- UI import hiển thị loại tài liệu/danh mục gợi ý nhưng không tự ép import; người dùng vẫn review và chọn/chuyển danh mục thủ công.
- Prompt chatbot có luật rõ: giá, tồn kho, VAT, bảo hành, đổi trả chỉ trả lời theo Knowledge Base; thiếu dữ liệu thì hỏi thêm và chuyển nhân viên.

Điều này cho phép triển khai khung trước, sau đó khách import dữ liệu chính thức vào đúng danh mục tương ứng mà không cần sửa schema.

## Bằng chứng kỹ thuật chính

### AI/RAG runtime

- Runtime prompt ở `src/lib/ai/engine.ts` đã chuyển sang ngữ cảnh LED1000.
- Prompt có yêu cầu hỏi thêm thông số khi khách hỏi sản phẩm chưa đủ rõ: điện áp, công suất, chiều dài LED dây, màu ánh sáng, IP, mục đích dùng, số lượng, quy cách.
- Prompt có rule giá/tồn kho/bảo hành/khuyến mãi: chỉ trả lời theo Knowledge Base, không tự bịa.
- `getKnowledgeBase(query)` gọi `searchKnowledgeBase(query, 10)`, tức mỗi câu hỏi chỉ đưa top 10 knowledge chunks vào prompt.
- Nếu response confidence thấp, conversation có thể bị chuyển `status: "escalated"`.

Kết luận: AI runtime đủ nền để tư vấn theo KB, nhưng chưa phải engine nghiệp vụ cho giá/tồn kho/phân loại khách.

### Knowledge Base và import dữ liệu

- Parser thường hỗ trợ: PDF, DOC, DOCX, XLS, XLSX, CSV, TXT, MD.
- Parser có logic nhận bảng giá và tạo chunk theo từng dòng sản phẩm trong spreadsheet.
- Parser thường không OCR PDF scan; nếu PDF không có text sẽ báo cần OCR/Gemini.
- Import preview có chế độ Gemini và giới hạn file 10MB.
- UI Knowledge cho phép chọn "Đọc bằng Gemini", hỗ trợ ảnh `.png`, `.jpg`, `.jpeg`, `.webp`, `.heic`, `.heif` khi dùng Gemini.
- Gemini import prompt yêu cầu giữ tên sản phẩm, mã, quy cách, cột giá; không bỏ sót giá; không bịa dữ liệu.
- Gemini import có kiểm chứng giá, cảnh báo giá thiếu hoặc giá VNĐ đáng nghi.

Kết luận: có nền nhập dữ liệu sản phẩm/bảng giá tốt. Nhưng đó là nhập dữ liệu vào KB, không phải chatbot live tự đọc ảnh khách gửi trong inbox.

### Dữ liệu seed LED1000 hiện có

File crawler report hiện ghi:

- `pagesCrawled`: 20
- `recordsExported`: 20
- `recordsByType`:
  - `home`: 1
  - `contact`: 1
  - `policy`: 0
  - `catalogue`: 0
  - `product_category`: 15
  - `product_listing`: 1
  - `product`: 2
  - `unknown`: 0
- `recordsWithHtmlEntitiesRemaining`: 0
- `recordsWithVeryShortContent`: 0

Dữ liệu seed có:

- Business profile.
- Product categories.
- Một số nhóm LED dây, nguồn, đèn pha.
- Một số giá crawl từ website.
- Một số dòng ưu đãi cho đơn vị thi công.
- Một số thông tin bảo hành rời rạc.
- Một dòng VAT: "GIÁ ĐÃ BAO GỒM VAT".

Dữ liệu seed thiếu hoặc chưa đủ chính thức:

- Policy bảo hành/đổi trả đầy đủ.
- Quy trình xuất VAT.
- Catalogue chính thức.
- Bảng giá chuẩn theo nhóm khách.
- Tồn kho.
- Dữ liệu sản phẩm thay thế.

Kết luận: website crawl chỉ nên xem là seed test RAG, chưa đủ làm nguồn vận hành production.

### Customer profile và phân loại khách

Schema `Customer` hiện có các field hữu ích:

- `tags`
- `quoteStatus`
- `technicalNeeds`
- `purchaseContext`
- `preferences`
- `previousAdvisor`
- `profileNotes`

API customer cho phép tạo/sửa các field này.

Nhưng hiện chưa thấy:

- Classifier tự động nhận khách lẻ/công trình/cửa hàng.
- Rule tự cập nhật `tags` hoặc `purchaseContext` từ hội thoại.
- Luồng xác nhận segment với khách.
- Pricing logic dùng segment để chọn bảng giá.

Kết luận: CRM có nơi lưu thông tin, nhưng chưa có automation phân loại khách.

### Báo giá và bảng giá

Hiện có:

- Knowledge importer nhận bảng giá Excel/CSV.
- Gemini import có guard kiểm chứng giá.
- Prompt cho phép trả giá nếu KB có giá cụ thể gắn đúng sản phẩm/quy cách.
- Seed có canned response hỏi mã sản phẩm/link/hình ảnh/số lượng/quy cách để báo giá.

Chưa có:

- Model `Product`, `SKU`, `PriceList`, `CustomerTier`, `DiscountRule`.
- Tool `quote_product` hoặc `calculate_quote`.
- Rule tính giá theo khách lẻ/công trình/cửa hàng.
- Audit trail báo giá.
- Trạng thái báo giá chính thức ngoài field `quoteStatus` đơn giản.

Kết luận: báo giá sơ bộ dựa trên KB có thể dùng để test, nhưng chưa đủ làm báo giá vận hành chính thức.

### Tồn kho và sản phẩm thay thế

Hiện chưa thấy:

- Model tồn kho.
- API tồn kho.
- Tool check tồn kho.
- Import tồn kho định kỳ.
- Mapping sản phẩm thay thế theo SKU/thông số.
- Rule đề xuất thay thế khi hết hàng.

Prompt hiện còn yêu cầu không tự bịa tồn kho. Test plan cũng kỳ vọng nếu không có dữ liệu tồn thì bot phải hỏi mã/link và chuyển nhân viên.

Kết luận: tồn kho và gợi ý thay thế là gap lớn, cần phase riêng.

### Chuyển khách cho nhân viên

Hiện có:

- Tool `create_ticket`.
- Tool `assign_to_person`.
- Tool `send_internal_email`.
- Ticket type có `quotation`, `consultation`, `complaint`, `warranty`.
- Team member có `expertise`.
- Seed team có người tư vấn, CSKH/bảo hành, kỹ thuật, kho hàng.
- Conversation có status `escalated`.
- API manual transfer/route conversation.

Chưa chắc:

- Trigger tiếng Việt chắc chắn cho "gặp nhân viên", "báo giá chính thức", "kiểm tồn", "bảo hành", "khiếu nại".
- Auto assign đúng bộ phận trong mọi tình huống.
- Outbound manual reply cho Meta/Zalo đầy đủ như WhatsApp/email.

Kết luận: có nền chuyển nhân viên, nhưng nên bổ sung rule/test trước khi cam kết production.

### Multi-account Facebook/Zalo/Shopee

Hiện trạng schema/channel:

- `Channel.type` là unique.
- Channel API `upsert` theo `{ type }`.
- Danh sách channel gồm `widget`, `whatsapp`, `email`, `phone`, `sms`, `telegram`, `zalo`, `facebook`, `instagram`.

Facebook/Instagram:

- Có webhook `/api/webhooks/meta`.
- Mapping `object=page` thành `facebook`, `object=instagram` thành `instagram`.
- Hiện parse text message, bỏ qua non-text/attachment.
- Send API lấy token theo kênh `facebook` hoặc `instagram`.
- Config hiện là một config cho `facebook` và một config cho `instagram`.
- Không route token theo từng Page ID / Instagram Business Account ID.

Zalo:

- Zalo dùng một process/session runtime.
- Config lưu cookies/session vào một channel type `zalo`.
- Incoming route nhận text từ bot/script ngoài và gọi `chat`.
- Có chức năng gửi text/image thủ công qua script Zalo, nhưng không phải nhiều account.

Shopee:

- Không tìm thấy integration Shopee trong source.

Kết luận: yêu cầu "cho thêm nhiều tk fb, zl, shopee" là một phase kiến trúc riêng. Không nên vá nhanh vào `Channel.config` hiện tại nếu muốn chạy ổn định.

## Test hiện có

Đã chạy nhóm test trọng tâm:

```bash
npx vitest run tests/unit/ai-engine.test.ts tests/unit/meta.test.ts tests/unit/knowledge-import.test.ts tests/unit/gemini-import.test.ts tests/api/knowledge-import-preview.test.ts
```

Kết quả:

- Test files: 5 passed
- Tests: 47 passed

Nhóm test này xác nhận:

- Prompt LED1000 có các guardrail chính.
- Customer profile fields được inject vào prompt.
- Meta parser/send text hoạt động theo test.
- Knowledge import parser xử lý bảng giá.
- Gemini import fallback model, image/docx parts, price validation hoạt động theo test.

Chưa chạy được query DB hiện tại vì Postgres local trả `ECONNREFUSED`. Vì vậy audit này chưa xác nhận trạng thái dữ liệu thực tế trong database local, chỉ xác nhận source/test/data files trong repo.

## Gap cần xử lý trước production

### Gap dữ liệu

Cần khách/lead cung cấp:

- Bảng giá niêm yết chính thức.
- Bảng giá theo khách lẻ/công trình/cửa hàng.
- Quy tắc chiết khấu theo số lượng hoặc nhóm khách.
- File tồn kho hoặc API/cách sync tồn kho.
- Catalogue sản phẩm có ảnh, SKU/mã, thông số kỹ thuật.
- Chính sách bảo hành/đổi trả chính thức.
- Hướng dẫn xuất VAT.
- Danh sách nhân viên/bộ phận phụ trách tư vấn, kỹ thuật, kho, bảo hành.
- Danh sách tài khoản Facebook Page, Zalo OA/tài khoản, Shopee shop cần kết nối.

### Gap code/kiến trúc

- Customer classification tự động.
- Quote/pricing engine.
- Inventory source + check tool.
- Product alternative matching.
- Vision/runtime image understanding cho ảnh khách gửi.
- Handoff policy tiếng Việt rõ hơn.
- Multi-account channel architecture.
- Shopee integration.

## Đề xuất phase tiếp theo

### Phase A - Audit test coverage

Mục tiêu:

- Bổ sung test plan cho toàn bộ checklist lead.
- Tách test thành nhóm: product advice, image/spec, customer segment, price, inventory, warranty, VAT, handoff, multi-channel.

Deliverables:

- `docs/led1000-chatbot-test-plan.md` mở rộng.
- Script test API thêm case segment/VAT/warranty/handoff.
- Báo cáo pass/fail/review.

### Phase B - Chuẩn hóa dữ liệu chính thức

Mục tiêu:

- Import dữ liệu khách cung cấp thay vì chỉ dựa vào website crawl.
- Review chunk trước khi import.

Deliverables:

- Category KB riêng cho bảng giá, policy, VAT, warranty, catalogue.
- Báo cáo import warnings.
- Kiểm tra embedding/index.

### Phase C - Prompt/KB policy hardening

Mục tiêu:

- Siết câu trả lời VAT, bảo hành, giá, tồn kho, chuyển nhân viên.
- Không để bot bịa khi thiếu dữ liệu.

Deliverables:

- KB rule entries chính thức.
- Test regression ngoài ngành và không bịa giá/tồn.

### Phase D - Customer classification

Mục tiêu:

- Nhận diện khách lẻ/công trình/cửa hàng.
- Lưu segment vào customer profile/tags sau khi đủ tín hiệu.

Deliverables:

- Rule/AI classifier.
- UI/metadata hiển thị segment.
- Test xác nhận không gán bừa khi thiếu thông tin.

### Phase E - Quote/pricing engine

Mục tiêu:

- Tính giá theo bảng giá và nhóm khách.
- Báo giá sơ bộ có nguồn và điều kiện rõ ràng.

Deliverables:

- Data model hoặc structured import cho bảng giá.
- Quote tool.
- Audit trail báo giá.
- Rule chuyển nhân viên khi cần báo giá chính thức.

### Phase F - Inventory và sản phẩm thay thế

Mục tiêu:

- Kiểm tra tồn kho thật.
- Gợi ý sản phẩm thay thế theo thông số tương đương.

Deliverables:

- Inventory model/API/sync.
- Product/SKU model hoặc mapping trong KB structured.
- Alternative recommendation logic.

### Phase G - Multi-account FB/Zalo/Shopee

Mục tiêu:

- Hỗ trợ nhiều Page/OA/shop.
- Route đúng token, webhook, hội thoại, nhân viên, KB nếu cần.

Deliverables:

- Thiết kế `ChannelAccount` hoặc tương đương.
- Migration/schema mới.
- UI quản lý nhiều account.
- Webhook routing theo account id.
- Shopee integration design trước khi code.

## Câu hỏi cần hỏi lead/khách

1. "Nhiều tài khoản FB/Zalo/Shopee" nghĩa là bao nhiêu account mỗi nền tảng?
2. Facebook là nhiều Page hay nhiều app/token?
3. Zalo là Zalo OA hay tài khoản Zalo cá nhân qua bot cookies?
4. Shopee cần đọc chat, trả lời chat, đồng bộ sản phẩm, hay kiểm đơn/tồn kho?
5. Mỗi account có dùng cùng Knowledge Base hay mỗi account/shop có dữ liệu riêng?
6. Khách lẻ/công trình/cửa hàng phân loại theo tiêu chí nào?
7. Bảng giá theo nhóm khách là cột riêng hay rule chiết khấu?
8. Báo giá sơ bộ được phép chốt đến mức nào, hay luôn cần nhân viên xác nhận?
9. Tồn kho lấy từ file Excel, phần mềm kho, website, Shopee, hay nhân viên xác nhận?
10. VAT cần xuất hóa đơn theo công ty nào, cần thông tin gì từ khách, có phụ phí hay điều kiện không?

## Tin nhắn tổng hợp có thể gửi lead

```txt
Em audit lại rồi anh. Hiện hệ thống đã có nền chatbot LED1000/RAG: có Knowledge Base, import PDF/Word/Excel/ảnh bằng Gemini, crawler seed website, prompt tư vấn LED1000, hỏi thêm thông số công trình và có ticket/chuyển nhân viên.

Tuy nhiên chưa thể xem là đã đủ toàn bộ checklist vận hành bán hàng. Các phần tư vấn sản phẩm, hỏi thông số, báo giá nếu KB có giá thì đã có nền. Nhưng phân loại khách lẻ/công trình/cửa hàng, tính giá theo nhóm khách, kiểm tra tồn kho, gợi ý sản phẩm thay thế theo tồn kho, đọc ảnh khách gửi trong hội thoại và nhiều tài khoản FB/Zalo/Shopee chưa phải cơ chế hoàn chỉnh.

Đặc biệt multi-account cần thiết kế riêng vì hiện Channel đang unique theo type, tức mỗi loại kênh một config chính. Facebook/Instagram hiện text-only theo một config mỗi loại, Zalo là một session cookies/process, Shopee chưa có integration.

Em đề xuất chia phase: trước mắt bổ sung test checklist + import data chính thức của khách; sau đó làm customer classification, pricing engine, inventory/alternative product, rồi mới multi-account FB/Zalo/Shopee. Đồng thời cần khách cung cấp bảng giá theo nhóm khách, tồn kho, catalogue/hình/thông số, chính sách bảo hành, hướng dẫn VAT và danh sách account cần kết nối.
```

## Kết luận cuối

Không nên báo là hệ thống đã đáp ứng 100% các mục lead nêu.

Nên báo là:

- Đã có nền chatbot LED1000/RAG/import/ticket/channel.
- Đã đủ để demo tư vấn cơ bản theo dữ liệu import.
- Chưa đủ để vận hành bán hàng chính thức với phân loại khách, giá theo nhóm, tồn kho, thay thế, VAT/bảo hành đầy đủ và nhiều account kênh bán.
- Cần data chính thức và các phase code riêng cho nghiệp vụ sale/inventory/multi-account.
