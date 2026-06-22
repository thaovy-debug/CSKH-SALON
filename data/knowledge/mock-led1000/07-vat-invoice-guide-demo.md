# LED1000 - Hướng dẫn xuất VAT demo

Loại dữ liệu: vat_invoice
Trạng thái: DỮ LIỆU GIẢ LẬP ĐỂ TEST, không dùng thay chính sách kế toán thật.

## Nguyên tắc VAT demo

- Giá trong bảng giá demo đang ghi là "Chưa gồm VAT" trừ khi từng dòng sản phẩm ghi chú khác.
- Nếu khách cần hóa đơn VAT, bot cần xin thông tin và chuyển nhân viên xác nhận trước khi chốt giá cuối.
- Không tự cộng VAT hoặc cam kết xuất hóa đơn nếu Knowledge Base không có chính sách chính thức cho đơn đó.

## Thông tin khách cần cung cấp để xuất VAT

- Tên công ty.
- Mã số thuế.
- Địa chỉ công ty trên hóa đơn.
- Email nhận hóa đơn điện tử.
- Tên người liên hệ và số điện thoại.
- Nội dung hàng hóa cần thể hiện trên hóa đơn nếu khách có yêu cầu.

## Quy trình demo

1. Khách báo cần xuất VAT.
2. Bot hỏi khách đã có mã sản phẩm, số lượng, nhóm khách và thông tin công ty chưa.
3. Bot nhắc khách gửi MST/email nhận hóa đơn.
4. Bot chuyển nhân viên xác nhận giá cuối, VAT và thời điểm xuất hóa đơn.

## Câu trả lời mẫu

Dạ bên em có thể hỗ trợ kiểm tra xuất VAT cho đơn hàng. Bạn cho em xin tên công ty, mã số thuế, địa chỉ công ty, email nhận hóa đơn và danh sách sản phẩm/số lượng cần mua. Em sẽ chuyển nhân viên xác nhận giá cuối và thời điểm xuất hóa đơn giúp mình.
