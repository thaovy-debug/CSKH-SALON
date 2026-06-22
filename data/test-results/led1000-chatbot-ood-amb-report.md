# LED1000 Chatbot API Test Report

## Run info

- Base URL: http://localhost:3000
- Endpoint: /api/chat
- Auth method: api_key
- Date/time: 2026-06-18T12:19:26.558Z to 2026-06-18T12:20:04.289Z
- Total tests: 5
- Passed: 5
- Failed: 0
- Needs review: 0

## Summary by group

| Group | Total | Passed | Failed | Review |
| --- | ---: | ---: | ---: | ---: |
| Business/contact | 0 | 0 | 0 | 0 |
| Product category retrieval | 0 | 0 | 0 | 0 |
| Technical consulting | 0 | 0 | 0 | 0 |
| Price/inventory behavior | 0 | 0 | 0 | 0 |
| Out-of-domain regression | 3 | 3 | 0 | 0 |
| Ambiguous/missing info | 2 | 2 | 0 | 0 |

## Failed / review cases

No failed or review cases.

## Full results table

| ID | Group | Question | Status | Flags | Short response |
| --- | --- | --- | --- | --- | --- |
| OOD-01 | Out-of-domain regression | Tôi muốn đặt bàn ăn tối thì sao? | pass | - | Dạ, xin lỗi bạn, LED1000 là đơn vị chuyên cung cấp đèn LED, nguồn điện và linh kiện chiếu sáng, không phải là nhà hàng nên bên em không hỗ trợ đặt bàn ăn tối ạ. Nếu bạn đang cần... |
| OOD-02 | Out-of-domain regression | Có tư vấn tour du lịch không? | pass | - | Dạ, rất tiếc là LED1000 chỉ chuyên về đèn LED, nguồn điện, linh kiện và thiết bị chiếu sáng thôi ạ, nên bên em không có tư vấn về tour du lịch. Nếu bạn có nhu cầu về đèn LED hoặ... |
| OOD-03 | Out-of-domain regression | Bên mình có bán mỹ phẩm không? | pass | - | Dạ, LED1000 chuyên về các sản phẩm đèn LED, nguồn điện, linh kiện LED, phụ kiện chiếu sáng, đèn trang trí và thiết bị điện liên quan thôi ạ. Bên em không kinh doanh mỹ phẩm. Bạn... |
| AMB-01 | Ambiguous/missing info | Tôi cần mua đèn cho bảng hiệu, tư vấn giúp tôi. | pass | - | Xin chào! LED1000 rất vui được hỗ trợ bạn chọn đèn cho bảng hiệu. Để em có thể tư vấn sản phẩm phù hợp, bền và đúng kỹ thuật nhất, bạn cho em xin thêm một vài thông tin nhé: 1. ... |
| AMB-02 | Ambiguous/missing info | Tôi muốn mua nguồn cho LED dây 10m, chọn loại nào? | pass | - | Dạ, để chọn nguồn phù hợp và an toàn cho 10m LED dây, em cần thêm một vài thông tin từ bạn để tư vấn chính xác ạ: 1. **Thông số LED dây:** Bạn đang dùng loại LED dây nào (ví dụ:... |

## Notes

- This is heuristic validation, not final human approval.
- Review price/inventory answers manually.
- Each test sends a new API request without reusing `conversationId`, so answers are less likely to be affected by prior test context.
