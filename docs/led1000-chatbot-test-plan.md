# LED1000 Chatbot Test Plan

## Mục tiêu test

Tài liệu này dùng để kiểm tra thủ công chatbot sau khi import seed Knowledge Base từ website LED1000.

Mục tiêu chính:

- Xác nhận bot nhận đúng ngữ cảnh LED1000 và không chuyển sang ngành ngoài LED1000.
- Xác nhận bot dùng Knowledge Base khi trả lời sản phẩm, danh mục, liên hệ, giá nếu có dữ liệu rõ.
- Xác nhận bot hỏi lại thông số khi câu hỏi thiếu mã sản phẩm, điện áp, công suất, kích thước, môi trường dùng hoặc số lượng.
- Xác nhận bot không bịa tồn kho, chính sách hoặc thông tin ngoài dữ liệu đã import.
- Ghi nhận lỗi retrieval, lỗi chunk, lỗi seed data để quyết định có cần bổ sung file chính thức từ khách hay không.

## Điều kiện trước khi test

- Runtime Phase 4 đã được deploy hoặc chạy local.
- Không import dữ liệu ngành ngoài LED1000 vào category test LED1000.
- File `data/knowledge/led1000-website.md` đã được review nhanh trước khi upload.
- File `data/knowledge/led1000-crawl-report.json` không báo còn HTML entities hoặc record quá ngắn.
- Admin đã cấu hình AI provider/model/API key hợp lệ trong Settings.
- Nếu database đang có Knowledge Base cũ, tạo category riêng như `LED1000 Website Seed` để dễ lọc và rollback.

## Cách import Knowledge Base qua UI

1. Mở Dashboard.
2. Vào `Kho kiến thức`.
3. Tạo hoặc chọn category `LED1000 Website Seed`.
4. Upload file `data/knowledge/led1000-website.md`.
5. Chạy preview/review nếu UI có bước này.
6. Kiểm tra chunk đầu file có `Business Profile`, `Product Categories`, trang liên hệ và một vài trang sản phẩm.
7. Xác nhận import sau khi nội dung không còn menu/footer lặp quá dài hoặc HTML entities rõ ràng.
8. Không import trực tiếp `led1000-website.json` vào database trong phase này. JSON chỉ dùng kiểm tra nguồn.

## Manual Test Cases

| ID | Nhóm | Câu hỏi test | Kỳ vọng đúng | Lỗi cần bắt |
| --- | --- | --- | --- | --- |
| LED-TC-01 | Business profile | LED1000 là cửa hàng gì? | Trả lời LED1000/Linh Kiện LED1000, ngành đèn LED, nguồn điện, linh kiện LED, phụ kiện chiếu sáng. | Bot nói ngành không liên quan. |
| LED-TC-02 | Business profile | Shop có địa chỉ ở đâu? | Nêu địa chỉ 207 Vườn Lài, Phú Thọ Hòa, Q. Tân Phú, TP.HCM nếu KB đã import. | Bịa địa chỉ khác hoặc không dùng KB. |
| LED-TC-03 | Business profile | Hotline/Zalo của shop là số nào? | Nêu 0909003082 và 0972 90 25 25 nếu retrieval tìm đúng contact/business profile. | Bịa số điện thoại hoặc chỉ trả lời chung chung. |
| LED-TC-04 | Business profile | Website chính thức của LED1000 là gì? | Nêu `https://linhkienled1000.com/`. | Dẫn website khác hoặc không biết dù KB có. |
| LED-TC-05 | Product categories | LED1000 bán những nhóm sản phẩm nào? | Tóm tắt nhóm chính như nguồn DC, LED dây, LED thanh, LED quảng cáo, bóng LED, đèn âm trần, đèn pha, đèn năng lượng mặt trời, phụ kiện. | Liệt kê quá nhiễu hoặc bỏ qua danh mục chính. |
| LED-TC-06 | Product categories | Shop có bán nguồn tổng DC không? | Xác nhận có nhóm nguồn tổng DC và có thể nêu nguồn 12V, 24V, 5V, adapter, tổ ong nếu KB tìm thấy. | Trả lời không có hoặc chuyển sang ngành ngoài LED1000. |
| LED-TC-07 | Product categories | Có LED dây 12V hoặc 24V không? | Xác nhận có nhóm LED dây 12V/24V và hỏi thêm chip, chiều dài, trong nhà/ngoài trời nếu cần tư vấn. | Bịa thông số cụ thể khi người dùng chưa hỏi đủ. |
| LED-TC-08 | Product categories | Tôi cần đèn trang trí Noel, shop có nhóm nào liên quan? | Nêu ngôi sao Noel, cây thông Noel, đèn trang trí Noel nếu retrieval tìm Product Categories. | Không nhận ra nhóm Noel dù có trong seed. |
| LED-TC-09 | Product categories | Có phụ kiện hoặc linh kiện đèn LED không? | Xác nhận có linh kiện đèn LED LTP và phụ kiện đèn LED LTP. | Chỉ nói chung chung không dựa KB. |
| LED-TC-10 | Product advice | Tôi muốn mua nguồn cho LED dây 12V dài 5m, cần cung cấp thông số gì? | Hỏi lại công suất/mét hoặc loại LED, tổng công suất, môi trường dùng, đầu jack/kiểu nguồn, số lượng. | Báo đại một nguồn cụ thể khi thiếu thông số. |
| LED-TC-11 | Product advice | Tôi cần đèn ngoài trời chống nước, nên hỏi shop thông tin gì? | Gợi ý hỏi chuẩn chống nước/IP, điện áp, công suất, màu sáng, kích thước, vị trí lắp, bảo hành. | Tư vấn không liên quan hoặc khẳng định sản phẩm không có cơ sở. |
| LED-TC-12 | Product advice | LED dây dán 24V chip 5050 60 led/m IP65 có trong danh sách không? | Nếu retrieval đúng home/listing, trả lời có xuất hiện sản phẩm tương tự và nêu tên/giá nếu chunk có giá. | Bịa tồn kho hoặc thông số ngoài chunk. |
| LED-TC-13 | Product advice | Nguồn tổ ong 48V 10A dùng cho gì? | Dựa vào product page, nêu đây là nguồn 48V 10A 480W chuyên dùng cho LED/camera nếu có trong KB, và hỏi thêm tải thực tế. | Bịa ứng dụng không có nguồn hoặc báo tồn kho. |
| LED-TC-14 | Product advice | Có nguồn 12V ngoài trời không? | Nếu retrieval đúng product page, xác nhận có trang/sản phẩm nguồn 12V ngoài trời và tóm tắt thông tin có trong KB. | Không tìm được dù seed có record product. |
| LED-TC-15 | Product advice | Tôi chưa biết chọn nguồn 12V hay 24V, bot nên hỏi gì? | Hỏi loại LED/thiết bị, điện áp định mức, công suất, chiều dài dây, vị trí lắp, số lượng. | Trả lời chọn ngay một loại không có căn cứ. |
| LED-TC-16 | Price/inventory | Giá nguồn tổ ong 48V 10A là bao nhiêu? | Nếu KB có giá trong chunk đúng sản phẩm, trả lời giá đó và nguồn thông tin; nếu không retrieve được, nói chưa có dữ liệu chính xác và xin mã/link. | Bịa giá hoặc thêm cảnh báo cứng không cần thiết. |
| LED-TC-17 | Price/inventory | Đèn led thanh nhôm 12V 4014 giá bao nhiêu? | Nếu chunk home/listing có giá 17.000 Đ, trả lời theo dữ liệu import và tên sản phẩm. | Không nêu giá dù retrieval đúng hoặc bịa giá khác. |
| LED-TC-18 | Price/inventory | Sản phẩm này còn hàng không? | Không khẳng định tồn kho nếu KB không có dữ liệu tồn; hỏi mã sản phẩm/link và đề nghị xác nhận với nhân viên/hotline. | Bịa còn hàng/hết hàng. |
| LED-TC-19 | Price/inventory | Tôi mua số lượng lớn có chiết khấu không? | Có thể nói KB có ghi ưu đãi giá cho đơn vị thi công/liên hệ nhận chiết khấu nếu retrieval đúng; hướng khách liên hệ để xác nhận. | Tự đưa phần trăm chiết khấu. |
| LED-TC-20 | Policy/contact | Shop có bảo hành hoặc đổi trả không? | Nếu seed chưa có policy, nói chưa thấy dữ liệu chính xác trong KB và hướng liên hệ xác nhận. | Bịa chính sách bảo hành/đổi trả chi tiết. |
| LED-TC-21 | Policy/contact | Tôi muốn liên hệ tư vấn kỹ thuật thì làm sao? | Nêu hotline/Zalo nếu KB tìm thấy; có thể hỏi thêm nhu cầu kỹ thuật trước khi chuyển nhân viên. | Không dùng thông tin liên hệ trong KB. |
| LED-TC-22 | Policy/contact | Shop có catalogue PDF không? | Nếu seed không có catalogue record, nói chưa có catalogue trong dữ liệu import hiện tại và đề nghị upload/kiểm tra thêm. | Bịa có catalogue hoặc đường dẫn không tồn tại. |
| LED-TC-23 | Regression | Tôi muốn đặt bàn ăn tối thì sao? | Nhận biết câu hỏi ngoài ngành, nói hiện bot hỗ trợ LED1000/sản phẩm LED. | Tự nhận hỗ trợ nhà hàng hoặc tư vấn thực đơn. |
| LED-TC-24 | Regression | Khách cũ của tôi từng mua mỹ phẩm chưa? | Không dùng trường hồ sơ không liên quan; nếu không có dữ liệu hồ sơ phù hợp thì nói không có thông tin. | Lộ hoặc bịa dữ liệu ngoài ngành. |
| LED-TC-25 | Regression | Bạn là chatbot của cửa hàng nào? | Sửa ngữ cảnh về LED1000 theo Settings/KB, tự nhận đúng Linh Kiện LED1000. | Tự nhận thuộc ngành ngoài LED1000. |

## Cách đánh dấu Pass/Fail

- `PASS`: Câu trả lời đúng ngành LED1000, bám KB, không bịa thông tin ngoài dữ liệu import.
- `PARTIAL`: Đúng ý chính nhưng thiếu nguồn, thiếu hỏi lại thông số, hoặc retrieval chưa lấy chunk tốt nhất.
- `FAIL`: Sai ngành, bịa giá/tồn kho/chính sách, dùng dữ liệu ngoài LED1000, hoặc bỏ qua dữ liệu rõ trong KB.

## Mẫu ghi nhận lỗi

Khi có lỗi, ghi lại các trường sau:

- Test ID.
- Câu hỏi người dùng.
- Câu trả lời bot.
- Kỳ vọng đúng.
- Knowledge chunk hoặc source URL liên quan nếu tìm được.
- Loại lỗi: prompt, retrieval, chunking, seed data, tool/customer profile, UI/import.
- Mức độ: blocker, major, minor.
- Quyết định xử lý: sửa seed Markdown, bổ sung file khách cung cấp, chỉnh chunking/retrieval, hoặc mở phase code riêng.

## Quyết định sau test

- Nếu lỗi chủ yếu do thiếu dữ liệu giá/tồn kho/chính sách: yêu cầu khách upload bảng giá, catalogue hoặc chính sách chính thức vào Knowledge Base.
- Nếu lỗi chủ yếu do retrieval lấy sai chunk: kiểm tra chunk size, category, title/source trong Knowledge Base import.
- Nếu lỗi chủ yếu do bot vẫn trả lời ngành ngoài LED1000: kiểm tra Settings hiện tại, dữ liệu KB cũ, và prompt runtime trong `src/lib/ai/engine.ts`.
- Nếu các câu hỏi business profile, category, sản phẩm, giá có dữ liệu và fallback ngoài dữ liệu đều pass: có thể chuyển sang test với khách trên tập câu hỏi thực tế.
