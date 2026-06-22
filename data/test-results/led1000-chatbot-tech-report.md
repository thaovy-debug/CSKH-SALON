# LED1000 Chatbot API Test Report

## Run info

- Base URL: http://localhost:3000
- Endpoint: /api/chat
- Auth method: api_key
- Date/time: 2026-06-18T12:31:59.151Z to 2026-06-18T12:32:56.561Z
- Total tests: 6
- Passed: 6
- Failed: 0
- Needs review: 0

## Summary by group

| Group | Total | Passed | Failed | Review |
| --- | ---: | ---: | ---: | ---: |
| Business/contact | 0 | 0 | 0 | 0 |
| Product category retrieval | 0 | 0 | 0 | 0 |
| Technical consulting | 6 | 6 | 0 | 0 |
| Price/inventory behavior | 0 | 0 | 0 | 0 |
| Out-of-domain regression | 0 | 0 | 0 | 0 |
| Ambiguous/missing info | 0 | 0 | 0 | 0 |

## Failed / review cases

No failed or review cases.

## Full results table

| ID | Group | Question | Status | Flags | Short response |
| --- | --- | --- | --- | --- | --- |
| TECH-01 | Technical consulting | Tôi cần LED dây ngoài trời thì nên chọn loại nào? | pass | - | Dạ, để tư vấn loại LED dây ngoài trời phù hợp và an toàn nhất, bạn vui lòng chia sẻ thêm giúp em một vài thông tin sau nhé: 1. **Chiều dài tổng cộng** bạn cần lắp đặt là bao nhi... |
| TECH-02 | Technical consulting | Tôi muốn hắt trần phòng khách thì cần loại LED nào? | pass | - | Dạ, chào bạn! Để tư vấn loại LED hắt trần phòng khách phù hợp và thẩm mỹ nhất, em cần thêm một vài thông tin từ mình ạ: 1. Tổng chiều dài hắt trần mình dự kiến là bao nhiêu mét?... |
| TECH-03 | Technical consulting | Nguồn 12V 5A dùng cho LED dây được không? | pass | - | Dạ, nguồn 12V 5A hoàn toàn có thể dùng cho LED dây, tuy nhiên để đảm bảo an toàn và độ bền cho thiết bị, bạn cần lưu ý một số điểm sau: 1. **Tổng công suất:** Bạn cần tính tổng ... |
| TECH-04 | Technical consulting | Tôi chưa biết chọn nguồn bao nhiêu W thì cần cung cấp thông tin gì? | pass | - | Dạ, để em có thể tư vấn cho mình chọn loại nguồn phù hợp và đảm bảo an toàn, chị vui lòng cung cấp giúp em một số thông tin sau nhé: 1. **Loại đèn LED chị đang sử dụng là gì?** ... |
| TECH-05 | Technical consulting | LED dây COB khác gì LED dây thường? | pass | - | Dạ, sự khác biệt chính giữa LED dây COB và LED dây thường (như loại 5050) nằm ở cấu tạo và hiệu ứng ánh sáng ạ: 1. **Về ánh sáng:** - **LED dây COB:** Các chip LED được gắn dày ... |
| TECH-06 | Technical consulting | Đèn LED dây 12V và 220V khác nhau thế nào? | pass | - | Dạ, LED dây 12V và 220V có những khác biệt cơ bản về cách sử dụng và tính an toàn như sau: **1. LED dây 12V (và 24V):** * **Đặc điểm:** Sử dụng điện áp thấp, cần có **nguồn chuy... |

## Notes

- This is heuristic validation, not final human approval.
- Review price/inventory answers manually.
- Each test sends a new API request without reusing `conversationId`, so answers are less likely to be affected by prior test context.
