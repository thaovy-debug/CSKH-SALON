# LED1000 Chatbot API Test Report

## Run info

- Base URL: http://localhost:3000
- Endpoint: /api/chat
- Auth method: api_key
- Date/time: 2026-06-18T12:13:31.627Z to 2026-06-18T12:14:02.232Z
- Total tests: 4
- Passed: 0
- Failed: 0
- Needs review: 4

## Summary by group

| Group | Total | Passed | Failed | Review |
| --- | ---: | ---: | ---: | ---: |
| Business/contact | 0 | 0 | 0 | 0 |
| Product category retrieval | 0 | 0 | 0 | 0 |
| Technical consulting | 0 | 0 | 0 | 0 |
| Price/inventory behavior | 4 | 0 | 0 | 4 |
| Out-of-domain regression | 0 | 0 | 0 | 0 |
| Ambiguous/missing info | 0 | 0 | 0 | 0 |

## Failed / review cases

| ID | Group | Status | Flags | Notes |
| --- | --- | --- | --- | --- |
| PRICE-01 | Price/inventory behavior | review | price_inventory_manual_review | Price/inventory answers require human review against the imported KB/source data. |
| PRICE-02 | Price/inventory behavior | review | price_inventory_manual_review | Price/inventory answers require human review against the imported KB/source data. |
| PRICE-03 | Price/inventory behavior | review | price_inventory_manual_review | Price/inventory answers require human review against the imported KB/source data. |
| PRICE-04 | Price/inventory behavior | review | price_inventory_manual_review | Price/inventory answers require human review against the imported KB/source data. |

## Full results table

| ID | Group | Question | Status | Flags | Short response |
| --- | --- | --- | --- | --- | --- |
| PRICE-01 | Price/inventory behavior | Giá adapter 12V 5A bao nhiêu? | review | price_inventory_manual_review | Dạ, sản phẩm Adapter 12V 5A loại tốt (công suất 60W, jack 5.5x2.1mm) bên em đang có giá như sau ạ: * **Giá bán lẻ:** 125.000đ/cái * **Giá công trình:** 116.000đ/cái * **Giá cửa ... |
| PRICE-02 | Price/inventory behavior | Giá LED dây COB 12V bao nhiêu? | review | price_inventory_manual_review | Dạ, sản phẩm LED dây COB 12V 8mm 320D (cuộn 5m) hiện có giá bán lẻ là **180.000 VNĐ/cuộn** (giá chưa bao gồm VAT). Vì đây là giá theo dữ liệu demo, để đảm bảo chính xác nhất cho... |
| PRICE-03 | Price/inventory behavior | Có giá đèn LED dây Rạng Đông không? | review | price_inventory_manual_review | Dạ, hiện tại trong hệ thống sản phẩm của LED1000 em chưa có thông tin về đèn LED dây thương hiệu Rạng Đông ạ. Bên em hiện có sẵn các dòng LED dây khác như LED dây COB (12V/24V/2... |
| PRICE-04 | Price/inventory behavior | Còn hàng đèn LED dây chống nước không? | review | price_inventory_manual_review | Dạ, theo dữ liệu tồn kho hiện có, bên em đang có sản phẩm **LED dây dán 24V 5050 IP65** (thuộc nhóm LED dây chống nước) với mã sản phẩm là **DEMO-LED24-5050-IP65**. Hiện tại kho... |

## Notes

- This is heuristic validation, not final human approval.
- Review price/inventory answers manually.
- Each test sends a new API request without reusing `conversationId`, so answers are less likely to be affected by prior test context.
