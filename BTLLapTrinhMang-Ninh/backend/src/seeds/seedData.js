require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const seedDatabase = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI;
    console.log(`[Seeder] Đang kết nối tới MongoDB Atlas...`);
    await mongoose.connect(mongoUri);
    console.log('[Seeder] Kết nối MongoDB Atlas thành công!');

    // 1. Dọn dẹp dữ liệu cũ
    console.log('[Seeder] Đang làm mới dữ liệu...');
    await User.deleteMany({});
    await Conversation.deleteMany({});
    await Message.deleteMany({});

    // 2. Tạo 4 thành viên chính thức của nhóm PTITChat
    console.log('[Seeder] Đang tạo tài khoản 4 thành viên nhóm...');
    const users = await User.create([
      {
        username: 'ngotung05',
        email: 'ngotung05@ptit.edu.vn',
        password: 'password123',
        displayName: 'Ngô Bùi Tùng',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=ngotung05',
        isOnline: true
      },
      {
        username: 'nguyentien05',
        email: 'nguyentien05@ptit.edu.vn',
        password: 'password123',
        displayName: 'Nguyễn Mạnh Tiến',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=nguyentien05',
        isOnline: true
      },
      {
        username: 'hoangson05',
        email: 'hoangson05@ptit.edu.vn',
        password: 'password123',
        displayName: 'Nguyễn Hoàng Sơn',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=hoangson05',
        isOnline: false
      },
      {
        username: 'tranninh05',
        email: 'tranninh05@ptit.edu.vn',
        password: 'password123',
        displayName: 'Trần Đăng Ninh',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=tranninh05',
        isOnline: false
      }
    ]);

    const [tung, tien, son, ninh] = users;
    console.log(`[Seeder] Đã tạo thành công 4 thành viên nhóm PTIT.`);

    // 3. Tạo cuộc hội thoại 1-1 giữa Tùng và Tiến
    console.log('[Seeder] Đang tạo hội thoại 1-1 (Tùng - Tiến)...');
    const directConv = await Conversation.create({
      type: 'direct',
      members: [tung._id, tien._id],
      lastMessageAt: new Date()
    });

    // 4. Tạo nhóm trò chuyện "Nhóm Đồ Án PTITChat" với đủ 4 thành viên
    console.log('[Seeder] Đang tạo nhóm trò chuyện cả 4 bạn...');
    const groupConv = await Conversation.create({
      type: 'group',
      name: 'Nhóm Đồ Án PTITChat',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=ptitchat2026',
      admin: tung._id,
      members: [tung._id, tien._id, son._id, ninh._id],
      lastMessageAt: new Date()
    });

    // 5. Tạo tin nhắn mẫu cho hội thoại 1-1
    console.log('[Seeder] Đang tạo tin nhắn mẫu cho hội thoại 1-1...');
    const msg1 = await Message.create({
      conversationId: directConv._id,
      sender: tung._id,
      type: 'text',
      text: 'Chào Tiến, mình đã code xong toàn bộ REST API và Schema MongoDB rồi nhé!'
    });

    const msg2 = await Message.create({
      conversationId: directConv._id,
      sender: tien._id,
      type: 'text',
      text: 'Oke Tùng, mình đang ghép giao diện React với Socket.IO, các API chạy rất mượt!',
      replyTo: msg1._id
    });

    const msg3 = await Message.create({
      conversationId: directConv._id,
      sender: tung._id,
      type: 'file',
      text: 'Gửi cậu tài liệu đặc tả API và đề cương đồ án PTITChat',
      attachments: [
        {
          url: '/uploads/de-cuong-ptitchat.pdf',
          fileName: 'de-cuong-ptitchat.pdf',
          originalName: 'de-cuong-ptitchat.pdf',
          fileType: 'file',
          fileSize: 1048576,
          mimeType: 'application/pdf'
        }
      ]
    });

    directConv.lastMessage = msg3._id;
    directConv.lastMessageAt = msg3.createdAt;
    await directConv.save();

    // 6. Tạo tin nhắn trao đổi trong nhóm cả 4 bạn
    console.log('[Seeder] Đang tạo tin nhắn thảo luận nhóm...');
    const gMsg1 = await Message.create({
      conversationId: groupConv._id,
      sender: tung._id,
      type: 'text',
      text: 'Chào cả nhóm! Tiến, Sơn, Ninh xem lại tiến độ các module PTITChat nhé.'
    });

    const gMsg2 = await Message.create({
      conversationId: groupConv._id,
      sender: son._id,
      type: 'text',
      text: 'Phần kết nối Socket.IO thời gian thực mình đã test xong sự kiện gửi nhận tin nhắn rồi!',
      replyTo: gMsg1._id
    });

    const gMsg3 = await Message.create({
      conversationId: groupConv._id,
      sender: ninh._id,
      type: 'text',
      text: 'Tuyệt vời, phần slide và báo cáo Word mình cũng đang hoàn thiện để tuần tới nộp thầy cô.'
    });

    const gMsg4 = await Message.create({
      conversationId: groupConv._id,
      sender: tien._id,
      type: 'text',
      text: 'Database Atlas đã kết nối chung ổn định rồi nhé mọi người.'
    });

    groupConv.lastMessage = gMsg4._id;
    groupConv.lastMessageAt = gMsg4.createdAt;
    await groupConv.save();

    console.log('========================================================');
    console.log('🎉 ĐÃ CẬP NHẬT THÀNH CÔNG 4 THÀNH VIÊN NHÓM VÀO MONGODB ATLAS!');
    console.log('--------------------------------------------------------');
    console.log('Danh sách tài khoản (Mật khẩu chung: password123):');
    users.forEach((u) => {
      console.log(` - Username: ${u.username.padEnd(14)} | Họ tên: ${u.displayName}`);
    });
    console.log('--------------------------------------------------------');
    console.log('Database : ptitchat');
    console.log('Nhóm chat: "Nhóm Đồ Án PTITChat" (4 thành viên)');
    console.log('========================================================');

    process.exit(0);
  } catch (error) {
    console.error('❌ Lỗi khi đẩy dữ liệu vào MongoDB:', error.message);
    process.exit(1);
  }
};

seedDatabase();
