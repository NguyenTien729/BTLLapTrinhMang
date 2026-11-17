const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

const app = require('../app');
const initSocketIO = require('../socket');
const { resetPresence, isUserOnline } = require('../socket/presenceSocket');
const User = require('../models/User');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

const PORT = 5077;
const DB = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ptitchat_socket_test';

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

const token = (user) => jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });

const makeUser = (name) =>
  User.create({
    username: name,
    email: `${name}@ptit.edu.vn`,
    password: 'password123',
    displayName: name.toUpperCase()
  });

test.before(async () => {
  process.env.JWT_SECRET = 'ptitchat_test_secret_key_2026_ptit_telecom';
  process.env.CLIENT_URL = 'http://localhost:5173';

  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(DB, { serverSelectionTimeoutMS: 4000 });
  }
  await Promise.all([User.deleteMany({}), Conversation.deleteMany({}), Message.deleteMany({})]);
  resetPresence();

  const mod = require('socket.io-client');
  client = typeof mod === 'function' ? mod : mod.io;

  server = http.createServer(app);
  io = initSocketIO(server);
  await new Promise((resolve) => server.listen(PORT, resolve));
  baseUrl = `http://127.0.0.1:${PORT}`;
});

test.after(async () => {
  if (io) await new Promise((resolve) => io.close(resolve));
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  try {
    await mongoose.disconnect();
  } catch (e) {}
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

test('3. Cho kết nối khi token hợp lệ (cả payload {id} và {sub})', async () => {
  const user = await makeUser('authtwo');

  const s1 = await connect(token(user));
  assert.ok(s1.connected);
  s1.close();

  const subToken = jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
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
  assert.strictEqual(msg.sender._id.toString(), a.id);

  sa.close();
  sb.close();
});

// 4. Nhóm chat
test('6. Gửi tin vào nhóm chat: tất cả thành viên trong phòng nhận được', async () => {
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

  await emit(sa, 'conversation:join', { conversationId: group.id });
  await emit(sb, 'conversation:join', { conversationId: group.id });
  await emit(sc, 'conversation:join', { conversationId: group.id });

  const inB = once(sb, 'message:new');
  const inC = once(sc, 'message:new');

  await emit(sa, 'message:send', {
    conversationId: group.id,
    text: 'Tin nhóm',
    clientTempId: 'grp-1'
  });

  const [mb, mc] = await Promise.all([inB, inC]);
  assert.strictEqual(mb.text, 'Tin nhóm');
  assert.strictEqual(mc.text, 'Tin nhóm');

  sa.close();
  sb.close();
  sc.close();
});

// 5. Thao tác tin nhắn: sửa & thu hồi
test('7. Sửa tin nhắn của mình phát event message:edited', async () => {
  const [a, b] = await Promise.all([makeUser('edone'), makeUser('edtwo')]);
  const conv = await Conversation.create({ type: 'direct', members: [a._id, b._id] });

  const sa = await connect(token(a));
  const sb = await connect(token(b));
  await emit(sa, 'conversation:join', { conversationId: conv.id });
  await emit(sb, 'conversation:join', { conversationId: conv.id });

  const incoming = once(sb, 'message:new');
  await emit(sa, 'message:send', { conversationId: conv.id, text: 'Tin gốc' });
  const msg = await incoming;

  const editedEvent = once(sb, 'message:edited');
  await emit(sa, 'message:edit', { messageId: msg._id, text: 'Tin đã sửa' });
  const edited = await editedEvent;

  assert.strictEqual(edited.text, 'Tin đã sửa');
  assert.strictEqual(edited.isEdited, true);

  sa.close();
  sb.close();
});

test('8. Thu hồi tin nhắn: ẩn nội dung nhưng vẫn giữ trong DB', async () => {
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

test('9. Gửi lại cùng clientTempId không tạo tin nhắn trùng', async () => {
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
