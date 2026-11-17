// Demo nhanh module Socket.IO: 3 người dùng nhắn tin trong một nhóm.
// Chạy: npm start (terminal 1) rồi npm run demo (terminal 2)
require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { io } = require('socket.io-client');

const User = require('./src/models/User');
const Conversation = require('./src/models/Conversation');
const Message = require('./src/models/Message');

const BASE = process.env.DEMO_URL || 'http://127.0.0.1:5000';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (text) => console.log(text);

const connect = (token, label) =>
  new Promise((resolve, reject) => {
    const socket = io(BASE, { auth: { token }, transports: ['websocket'] });
    socket.once('connect', () => {
      log(`  + ${label} đã kết nối`);
      resolve(socket);
    });
    socket.once('connect_error', (e) => reject(new Error(`${label}: ${e.message}`)));
  });

const emit = (socket, event, data) =>
  new Promise((resolve) => {
    socket.timeout(5000).emit(event, data, (error, response) =>
      resolve(error ? { success: false, message: 'timeout' } : response)
    );
  });

(async () => {
  log('===== DEMO SOCKET.IO =====');

  await mongoose.connect(process.env.MONGODB_URI);
  await Promise.all([User.deleteMany({}), Conversation.deleteMany({}), Message.deleteMany({})]);

  // 1. Tạo 3 người dùng và một nhóm chat
  const hash = await bcrypt.hash('password123', 10);
  const [an, binh, cuong] = await User.create([
    { username: 'tranan', email: 'an@ptit.edu.vn', password: hash, displayName: 'An' },
    { username: 'lebinh', email: 'binh@ptit.edu.vn', password: hash, displayName: 'Bình' },
    { username: 'phamcuong', email: 'cuong@ptit.edu.vn', password: hash, displayName: 'Cường' }
  ]);
  const group = await Conversation.create({
    type: 'group',
    name: 'Nhóm đồ án',
    admin: an._id,
    members: [an._id, binh._id, cuong._id]
  });
  log(`\n1. Đã tạo 3 người dùng và nhóm "${group.name}"`);

  // 2. Lấy token và kết nối
  const tk = (user) => jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  log('\n2. Kết nối 3 người dùng');
  const sAn = await connect(tk(an), 'An');
  const sBinh = await connect(tk(binh), 'Bình');
  const sCuong = await connect(tk(cuong), 'Cường');
  await wait(500);

  // 3. Kiểm tra chặn token sai
  log('\n3. Thử kết nối với token sai');
  await new Promise((resolve) => {
    const bad = io(BASE, { auth: { token: 'token-gia' }, transports: ['websocket'] });
    bad.once('connect_error', (e) => {
      log(`  + Bị chặn đúng: ${e.message}`);
      bad.close();
      resolve();
    });
  });

  // 4. Vào phòng chat
  log('\n4. Cả 3 vào phòng chat');
  for (const s of [sAn, sBinh, sCuong]) {
    await emit(s, 'conversation:join', { conversationId: group.id });
  }
  log('  + Đã vào phòng');

  // 5. Gửi tin nhắn
  log('\n5. An gửi tin nhắn, Bình và Cường nhận');
  const gotBinh = [];
  const gotCuong = [];
  const notifBinh = [];
  sBinh.on('message:new', (m) => gotBinh.push(m));
  sCuong.on('message:new', (m) => gotCuong.push(m));
  sBinh.on('notification:new', (n) => notifBinh.push(n));

  const sent = await emit(sAn, 'message:send', {
    conversationId: group.id,
    text: 'Chào cả nhóm!',
    clientTempId: 'demo-1'
  });
  await wait(400);
  log(`  + Bình nhận: "${gotBinh[0]?.text}"`);
  log(`  + Cường nhận: "${gotCuong[0]?.text}"`);
  log(`  + Bình có ${notifBinh.length} thông báo`);

  // 6. Chống trùng
  log('\n6. Gửi lại cùng clientTempId (mô phỏng mất mạng)');
  const dup = await emit(sAn, 'message:send', {
    conversationId: group.id,
    text: 'Chào cả nhóm!',
    clientTempId: 'demo-1'
  });
  const count = await Message.countDocuments({ clientTempId: 'demo-1' });
  log(`  + Trùng id: ${dup.data._id === sent.data._id}, số bản ghi trong DB: ${count}`);

  // 7. Typing
  log('\n7. Bình đang gõ, An thấy');
  const typing = [];
  sAn.on('typing:start', (t) => typing.push(t));
  sBinh.emit('typing:start', { conversationId: group.id });
  await wait(300);
  log(`  + An thấy: ${typing[0]?.displayName} đang gõ`);

  // 8. Trả lời
  log('\n8. Bình trả lời tin của An');
  const reply = await emit(sBinh, 'message:send', {
    conversationId: group.id,
    text: 'Đã nhận nhé!',
    replyTo: sent.data._id
  });
  log(`  + Reply vào tin: "${reply.data.replyTo.text}"`);

  // 9. Sửa tin
  log('\n9. Bình sửa tin của mình');
  const edited = await emit(sBinh, 'message:edit', {
    messageId: reply.data._id,
    text: 'Đã nhận và đã test xong!'
  });
  log(`  + Nội dung mới: "${edited.data.text}"`);

  // 10. Sửa tin người khác thì bị chặn
  log('\n10. Cường thử sửa tin của Bình');
  const denied = await emit(sCuong, 'message:edit', {
    messageId: reply.data._id,
    text: 'Sửa trộm'
  });
  log(`  + Bị chặn đúng: ${denied.message}`);

  // 11. Thu hồi
  log('\n11. An thu hồi tin nhắn');
  const revoked = await emit(sAn, 'message:revoke', { messageId: sent.data._id });
  log(`  + Client thấy: "${revoked.data.text}"`);

  // 12. Đã xem
  log('\n12. Bình và Cường đánh dấu đã xem');
  await emit(sBinh, 'message:seen', { conversationId: group.id });
  await emit(sCuong, 'message:seen', { conversationId: group.id });
  const msgs = await Message.find({ conversationId: group._id });
  log(`  + Số lượt xem mỗi tin: ${msgs.map((m) => m.readBy.length).join(', ')}`);

  // 13. Nhiều tab
  log('\n13. An mở thêm tab thứ 2');
  const sAn2 = await connect(tk(an), 'An (tab 2)');
  await emit(sAn2, 'conversation:join', { conversationId: group.id });
  await wait(300);
  const tab2 = [];
  sAn2.on('message:new', (m) => tab2.push(m));
  await emit(sBinh, 'message:send', { conversationId: group.id, text: 'Tin khi An mở 2 tab' });
  await wait(400);
  log(`  + Tab 2 của An cũng nhận: "${tab2[0]?.text}"`);
  sAn2.close();

  // 14. Reconnect
  log('\n14. Cường mất mạng rồi kết nối lại');
  sCuong.close();
  await wait(400);
  const sCuong2 = await connect(tk(cuong), 'Cường (kết nối lại)');
  await emit(sCuong2, 'conversation:join', { conversationId: group.id });
  const after = [];
  sCuong2.on('message:new', (m) => after.push(m));
  await emit(sBinh, 'message:send', { conversationId: group.id, text: 'Sau khi Cường nối lại' });
  await wait(400);
  log(`  + Cường vẫn nhận được: "${after[0]?.text}"`);

  log('\n===== DEMO XONG =====');

  for (const s of [sAn, sBinh, sCuong2]) s.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  process.exit(0);
})().catch((e) => {
  console.error('Lỗi demo:', e.message);
  process.exit(1);
});
