const fs = require('fs');

const translate = (filePath, replacements) => {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [en, vi] of Object.entries(replacements)) {
    content = content.split(en).join(vi);
  }
  fs.writeFileSync(filePath, content, 'utf8');
};

const convPath = 'src/app/(dashboard)/conversations/page.tsx';
translate(convPath, {
  '"Conversations"': '"Hội thoại"',
  '"Manage your support conversations"': '"Quản lý các cuộc hội thoại hỗ trợ khách hàng"',
  'Search conversations...': 'Tìm kiếm cuộc trò chuyện...',
  '>All Statuses<': '>Tất cả trạng thái<',
  '>Open<': '>Đang mở<',
  '>Closed<': '>Đã đóng<',
  '>All Channels<': '>Tất cả kênh<',
  '>Loading...<': '>Đang tải...<',
  '"No conversations found"': '"Không tìm thấy cuộc hội thoại nào"',
  '"Try adjusting your search or filters"': '"Vui lòng thay đổi từ khóa hoặc bộ lọc"',
  '>Select a conversation to start messaging<': '>Chọn một cuộc trò chuyện để bắt đầu nhắn tin<',
  '>Customer details<': '>Chi tiết khách hàng<',
  '>Phone<': '>Số điện thoại<',
  '>Email<': '>Email<',
  '>Close Conversation<': '>Đóng hội thoại<',
  '>Reopen Conversation<': '>Mở lại hội thoại<',
  'Type your message...': 'Nhập tin nhắn của bạn...',
  '"Send"': '"Gửi"',
  '>Create Ticket<': '>Tạo phiếu hỗ trợ<',
});
