# LED1000 Chatbot API Test Report

## Run info

- Base URL: http://localhost:3000
- Endpoint: /api/chat
- Auth method: api_key
- Date/time: 2026-06-18T11:48:44.196Z to 2026-06-18T11:50:11.947Z
- Total tests: 10
- Passed: 10
- Failed: 0
- Needs review: 0

## Summary by group

| Group | Total | Passed | Failed | Review |
| --- | ---: | ---: | ---: | ---: |
| Business/contact | 4 | 4 | 0 | 0 |
| Product category retrieval | 6 | 6 | 0 | 0 |
| Technical consulting | 0 | 0 | 0 | 0 |
| Price/inventory behavior | 0 | 0 | 0 | 0 |
| Out-of-domain regression | 0 | 0 | 0 | 0 |
| Ambiguous/missing info | 0 | 0 | 0 | 0 |

## Failed / review cases

No failed or review cases.

## Full results table

| ID | Group | Question | Status | Flags | Short response |
| --- | --- | --- | --- | --- | --- |
| BIZ-01 | Business/contact | LED1000 là bên nào? | pass | - | Dạ LED1000 hay Linh Kiện LED1000 là tên thương hiệu của Chi nhánh CTY TNHH TM DV QC Long Thịnh Phát. Bên em chuyên về các sản phẩm đèn LED, nguồn điện, linh kiện LED, phụ kiện c... |
| BIZ-02 | Business/contact | Shop ở đâu? | pass | - | Dạ, LED1000 có địa chỉ tham khảo tại 207 Vườn Lài, Phú Thọ Hòa, Q. Tân Phú, TP.HCM ạ. |
| BIZ-03 | Business/contact | Hotline là gì? | pass | - | Dạ hotline là một đường dây điện thoại thường được thiết lập để khách hàng liên hệ trực tiếp với doanh nghiệp để được hỗ trợ, tư vấn hoặc giải đáp thắc mắc nhanh chóng ạ. Bên em... |
| BIZ-04 | Business/contact | LED1000 bán những nhóm sản phẩm nào? | pass | - | Dạ LED1000 chuyên tư vấn và cung cấp các nhóm sản phẩm sau ạ: - Nguồn tổng DC, nguồn tổ ong, nguồn siêu mỏng, nguồn ngoài trời. - Adapter 5V, 12V, 24V, 48V. - LED dây 12V, 24V, ... |
| CAT-01 | Product category retrieval | Có bán adapter 12V không? | pass | - | Dạ có ạ. LED1000 có bán các loại Adapter 12V để cấp nguồn cho LED dây 12V, camera, module LED nhỏ, tủ kệ, hộp đèn nhỏ. Để em tư vấn loại phù hợp, chị/bạn cho em hỏi mình cần dùn... |
| CAT-02 | Product category retrieval | Có bán nguồn 24V không? | pass | - | Dạ LED1000 có bán nguồn 24V ạ. Mình cần công suất bao nhiêu và dùng cho mục đích gì ạ? |
| CAT-03 | Product category retrieval | Có bán LED dây không? | pass | - | Dạ LED1000 có bán LED dây ạ. Để em tư vấn đúng loại mình cần, bạn cho em hỏi thêm là mình muốn dùng LED dây cho mục đích nào, ví dụ như hắt trần, tủ kệ, hay trang trí ngoài trời... |
| CAT-04 | Product category retrieval | Có LED dây COB không? | pass | - | Dạ bên em có LED dây COB ạ. Hiện tại LED1000 đang cung cấp các dòng LED dây COB với ưu điểm ánh sáng liền mạch, không bị lộ điểm LED, phù hợp cho hắt trần, tủ kệ hoặc trang trí ... |
| CAT-05 | Product category retrieval | Có đèn năng lượng mặt trời không? | pass | - | Dạ có ạ. LED1000 có cung cấp đèn năng lượng mặt trời. Bạn cho em hỏi bạn cần dùng cho diện tích chiếu sáng khoảng bao nhiêu, độ cao lắp đặt là bao nhiêu, dùng trong nhà hay ngoà... |
| CAT-06 | Product category retrieval | Có linh kiện đèn LED không? | pass | - | Dạ có ạ. LED1000 cung cấp nhiều loại linh kiện và phụ kiện LED như LED module, LED đúc F5/F8, chip LED, mạch điều khiển, dimmer, remote RGB, thanh nhôm LED, dây điện, jack DC, d... |

## Notes

- This is heuristic validation, not final human approval.
- Review price/inventory answers manually.
- Each test sends a new API request without reusing `conversationId`, so answers are less likely to be affected by prior test context.
