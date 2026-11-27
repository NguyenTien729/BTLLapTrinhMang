// Test cho module Socket.IO.
// Chạy: npm run test:socket (MongoDB tạm, không dùng database ứng dụng).
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const mongoose = require('mongoose');
const {startDatabase,stopDatabase}=require('../../test/helpers/database');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const app = require('../app');
const initSocketIO = require('../socket');
const { resetPresence, isUserOnline } = require('../socket/presenceSocket');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const PORT = 0;

let server;
let io;
let baseUrl;
let client;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const connect = (token) =>
  new Promise((resolve, reject) => {
    const socket = client(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: false
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });

const emit = (socket, event, data) =>
  new Promise((resolve) => {
    socket.timeout(5000).emit(event, data, (error, response) => {
      resolve(error ? { success: false, message: 'timeout' } : response);
    });
  });

const once = (socket, event) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Không nhận được "${event}"`)), 4000);
    socket.once(event, (payload) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });

const token = (user) => jwt.sign({}, process.env.JWT_SECRET, { subject:user.id,expiresIn:'1h',issuer:'ptitchat',audience:'ptitchat-client' });

const makeUser = async (name) =>
  User.create({
    username: name,
    email: `${name}@ptit.edu.vn`,
    passwordHash: await bcrypt.hash('password123', 4),
    displayName: name.toUpperCase()
  });

test.before(async () => {
  process.env.JWT_SECRET = 'ptitchat_test_secret_key_2026_ptit_telecom';
  process.env.CLIENT_URL = 'http://localhost:5173';

  await startDatabase();
  await Promise.all([User.init(),Conversation.init(),Message.init()]);
  await Promise.all([User.deleteMany({}), Conversation.deleteMany({}), Message.deleteMany({})]);
  resetPresence();

  const mod = require('socket.io-client');
  client = typeof mod === 'function' ? mod : mod.io;

  server = http.createServer(app);
  io = initSocketIO(server);
  await new Promise((resolve) => server.listen(PORT, resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (io) await new Promise((resolve) => io.close(resolve));
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await stopDatabase();
});

// 1. Xác thực bằng JWT
test('1. Chặn kết nối khi thiếu token', async () => {
  await assert.rejects(connect(undefined), /Thiếu token/);
});

test('2. Chặn token sai chữ ký', async () => {
  const user = await makeUser('authone');
  const bad = jwt.sign({ id: user.id }, 'sai-secret', { expiresIn: '1h' });
  await assert.rejects(connect(bad), /không hợp lệ/);
});

test('3. Cho kết nối khi token hợp lệ (JWT sub theo contract)', async () => {
  const user = await makeUser('authtwo');

  const s1 = await connect(token(user));
  assert.ok(s1.connected);
  s1.close();

  const subToken = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn:'1h',issuer:'ptitchat',audience:'ptitchat-client' });
  const s2 = await connect(subToken);
  assert.ok(s2.connected);
  s2.close();
});

// 2. Join room và kiểm tra quyền
test('4. Người ngoài không được vào phòng', async () => {
  const [a, b, c] = await Promise.all([makeUser('jone'), makeUser('jtwo'), makeUser('jthree')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const socketC = await connect(token(c));
  const result = await emit(socketC, 'conversation:join', { conversationId: conv.id });

  assert.strictEqual(result.success, false);
  assert.match(result.message, /không phải thành viên/);
  socketC.close();
});

// 3. Gửi tin nhắn 1-1
test('5. Gửi tin 1-1 tới người nhận realtime', async () => {
  const [a, b] = await Promise.all([makeUser('dmone'), makeUser('dmtwo')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const sa = await connect(token(a));
  const sb = await connect(token(b));
  await emit(sa, 'conversation:join', { conversationId: conv.id });
  await emit(sb, 'conversation:join', { conversationId: conv.id });

  const incoming = once(sb, 'message:new');
  const ack = await emit(sa, 'message:send', {
    conversationId: conv.id,
    text: 'Chào B',
    clientTempId: 'dm-1'
  });

  assert.strictEqual(ack.success, true);
  const msg = await incoming;
  assert.strictEqual(msg.text, 'Chào B');
  assert.strictEqual(String(msg.sender._id), a.id);

  const saved = await Message.findById(msg._id);
  assert.ok(saved, 'tin nhắn phải được lưu vào DB');

  sa.close();
  sb.close();
});

// 4. Gửi tin nhắn nhóm
test('6. Gửi tin nhóm: mọi thành viên trong phòng đều nhận', async () => {
  const [a, b, c] = await Promise.all([makeUser('gone'), makeUser('gtwo'), makeUser('gthree')]);
  const group = await Conversation.create({
    type: 'group',
    name: 'Nhóm test',
    admin: a._id,
    members: [a._id, b._id, c._id]
  });

  const sa = await connect(token(a));
  const sb = await connect(token(b));
  const sc = await connect(token(c));
  for (const s of [sa, sb, sc]) {
    await emit(s, 'conversation:join', { conversationId: group.id });
  }

  const pb = once(sb, 'message:new');
  const pc = once(sc, 'message:new');
  await emit(sa, 'message:send', { conversationId: group.id, text: 'Họp nhóm' });

  assert.strictEqual((await pb).text, 'Họp nhóm');
  assert.strictEqual((await pc).text, 'Họp nhóm');

  sa.close();
  sb.close();
  sc.close();
});

// 5. Thông báo tin nhắn mới
test('7. notification:new gửi cho người nhận, không gửi cho người gửi', async () => {
  const [a, b] = await Promise.all([makeUser('ntone'), makeUser('nttwo')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const sa = await connect(token(a));
  const sb = await connect(token(b));
  await emit(sa, 'conversation:join', { conversationId: conv.id });
  await emit(sb, 'conversation:join', { conversationId: conv.id });

  const notify = once(sb, 'notification:new');
  await emit(sa, 'message:send', { conversationId: conv.id, text: 'Có thông báo' });
  const payload = await notify;

  assert.strictEqual(payload.message.text, 'Có thông báo');

  // người gửi không nhận thông báo của chính mình
  let senderGot = false;
  sa.once('notification:new', () => {
    senderGot = true;
  });
  await wait(400);
  assert.strictEqual(senderGot, false);

  sa.close();
  sb.close();
});

// 6. Online / offline
test('8. Online khi kết nối, offline khi đóng tab cuối, có lưu lastSeen', async () => {
  const [a, b] = await Promise.all([makeUser('prone'), makeUser('prtwo')]);
  const sb = await connect(token(b));
  await wait(200);

  const onlineEvent = once(sb, 'user:online');
  const sa = await connect(token(a));
  assert.strictEqual((await onlineEvent).userId, a.id);
  assert.strictEqual(isUserOnline(a.id), true);

  const offlineEvent = once(sb, 'user:offline');
  sa.close();
  await offlineEvent;

  assert.strictEqual(isUserOnline(a.id), false);
  let stored = await User.findById(a._id);
  for (let i = 0; i < 20 && stored.isOnline; i += 1) {
    await wait(100);
    stored = await User.findById(a._id);
  }
  assert.strictEqual(stored.isOnline, false);
  assert.ok(stored.lastSeen instanceof Date);

  sb.close();
});

test('9. Mở nhiều tab: đóng 1 tab vẫn online', async () => {
  const [a, b] = await Promise.all([makeUser('mone'), makeUser('mtwo')]);
  const sb = await connect(token(b));
  await wait(200);

  const tab1 = await connect(token(a));
  const tab2 = await connect(token(a));
  await wait(300);
  assert.strictEqual(isUserOnline(a.id), true);

  tab1.close();
  await wait(500);
  assert.strictEqual(isUserOnline(a.id), true, 'còn tab 2 nên vẫn online');

  tab2.close();
  await wait(500);
  assert.strictEqual(isUserOnline(a.id), false);

  sb.close();
});

// 7. Trạng thái đã xem
test('10. Đánh dấu đã xem và phát message:seen', async () => {
  const [a, b] = await Promise.all([makeUser('seone'), makeUser('setwo')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const sa = await connect(token(a));
  const sb = await connect(token(b));
  await emit(sa, 'conversation:join', { conversationId: conv.id });
  await emit(sb, 'conversation:join', { conversationId: conv.id });

  const incoming = once(sb, 'message:new');
  await emit(sa, 'message:send', { conversationId: conv.id, text: 'Xem nhé' });
  const msg = await incoming;

  const seenEvent = once(sa, 'message:seen');
  await emit(sb, 'message:seen', { conversationId: conv.id });
  const seen = await seenEvent;

  assert.strictEqual(seen.userId, b.id);

  const stored = await Message.findById(msg._id);
  assert.strictEqual(stored.readBy.length, 1);
  assert.strictEqual(String(stored.readBy[0].user), b.id);

  sa.close();
  sb.close();
});

// 8. Sửa, thu hồi, trả lời
test('11. Sửa tin nhắn của mình, không sửa được tin người khác', async () => {
  const [a, b] = await Promise.all([makeUser('edone'), makeUser('edtwo')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const sa = await connect(token(a));
  const sb = await connect(token(b));
  await emit(sa, 'conversation:join', { conversationId: conv.id });
  await emit(sb, 'conversation:join', { conversationId: conv.id });

  const incoming = once(sb, 'message:new');
  await emit(sa, 'message:send', { conversationId: conv.id, text: 'Nội dung cũ' });
  const msg = await incoming;

  const editedEvent = once(sb, 'message:edited');
  const editAck = await emit(sa, 'message:edit', { messageId: msg._id, text: 'Nội dung mới' });
  const edited = await editedEvent;

  assert.strictEqual(editAck.success, true);
  assert.strictEqual(edited.text, 'Nội dung mới');
  assert.strictEqual(edited.isEdited, true);

  const denied = await emit(sb, 'message:edit', { messageId: msg._id, text: 'Sửa trộm' });
  assert.strictEqual(denied.success, false);

  sa.close();
  sb.close();
});

test('12. Thu hồi tin nhắn: ẩn nội dung nhưng vẫn giữ trong DB', async () => {
  const [a, b] = await Promise.all([makeUser('rvone'), makeUser('rvtwo')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const sa = await connect(token(a));
  const sb = await connect(token(b));
  await emit(sa, 'conversation:join', { conversationId: conv.id });
  await emit(sb, 'conversation:join', { conversationId: conv.id });

  const incoming = once(sb, 'message:new');
  await emit(sa, 'message:send', { conversationId: conv.id, text: 'Tin sắp thu hồi' });
  const msg = await incoming;

  const revokedEvent = once(sb, 'message:revoked');
  await emit(sa, 'message:revoke', { messageId: msg._id });
  const revoked = await revokedEvent;

  assert.strictEqual(revoked.isRecall, true);
  assert.strictEqual(revoked.text, 'Tin nhắn đã bị thu hồi');

  const stored = await Message.findById(msg._id);
  assert.ok(stored, 'bản ghi vẫn còn (thu hồi mềm)');

  sa.close();
  sb.close();
});

test('13. Trả lời tin nhắn: replyTo được lưu và populate', async () => {
  const [a, b] = await Promise.all([makeUser('rpone'), makeUser('rptwo')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const sa = await connect(token(a));
  const sb = await connect(token(b));
  await emit(sa, 'conversation:join', { conversationId: conv.id });
  await emit(sb, 'conversation:join', { conversationId: conv.id });

  const firstIncoming = once(sb, 'message:new');
  const first = await emit(sa, 'message:send', { conversationId: conv.id, text: 'Câu hỏi' });
  await firstIncoming;

  const replyIncoming = once(sa, 'message:new');
  await emit(sb, 'message:send', {
    conversationId: conv.id,
    text: 'Câu trả lời',
    replyTo: first.data._id
  });

  const reply = await replyIncoming;
  assert.strictEqual(reply.text, 'Câu trả lời');
  assert.strictEqual(reply.replyTo.text, 'Câu hỏi');

  sa.close();
  sb.close();
});

// 9. Typing
test('14. Typing:start và typing:stop được phát cho người khác', async () => {
  const [a, b] = await Promise.all([makeUser('tyone'), makeUser('tytwo')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const sa = await connect(token(a));
  const sb = await connect(token(b));
  await emit(sa, 'conversation:join', { conversationId: conv.id });
  await emit(sb, 'conversation:join', { conversationId: conv.id });

  const typingStart = once(sb, 'typing:start');
  sa.emit('typing:start', { conversationId: conv.id });
  const started = await typingStart;
  assert.strictEqual(started.userId, a.id);
  assert.strictEqual(started.displayName, 'TYONE');

  const typingStop = once(sb, 'typing:stop');
  sa.emit('typing:stop', { conversationId: conv.id });
  assert.strictEqual((await typingStop).userId, a.id);

  sa.close();
  sb.close();
});

// 10. Chống trùng khi gửi lại
test('15. Gửi lại cùng clientTempId không tạo tin nhắn trùng', async () => {
  const [a, b] = await Promise.all([makeUser('ddone'), makeUser('ddtwo')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const sa = await connect(token(a));
  const sb = await connect(token(b));
  await emit(sa, 'conversation:join', { conversationId: conv.id });
  await emit(sb, 'conversation:join', { conversationId: conv.id });

  const first = await emit(sa, 'message:send', {
    conversationId: conv.id,
    text: 'Chỉ lưu một lần',
    clientTempId: 'dup-1'
  });
  const retry = await emit(sa, 'message:send', {
    conversationId: conv.id,
    text: 'Chỉ lưu một lần',
    clientTempId: 'dup-1'
  });

  assert.strictEqual(first.success, true);
  assert.strictEqual(retry.data._id, first.data._id);

  const count = await Message.countDocuments({ clientTempId: 'dup-1' });
  assert.strictEqual(count, 1);

  sa.close();
  sb.close();
});

// 11. Reconnect
test('16. Kết nối lại và vẫn gửi/nhận được tin nhắn', async () => {
  const [a, b] = await Promise.all([makeUser('rcone'), makeUser('rctwo')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const sa1 = await connect(token(a));
  await emit(sa1, 'conversation:join', { conversationId: conv.id });
  sa1.close();
  await wait(300);

  const sa2 = await connect(token(a));
  const sb = await connect(token(b));
  await emit(sa2, 'conversation:join', { conversationId: conv.id });
  await emit(sb, 'conversation:join', { conversationId: conv.id });

  const incoming = once(sa2, 'message:new');
  await emit(sb, 'message:send', { conversationId: conv.id, text: 'Sau reconnect' });

  assert.strictEqual((await incoming).text, 'Sau reconnect');

  sa2.close();
  sb.close();
});
