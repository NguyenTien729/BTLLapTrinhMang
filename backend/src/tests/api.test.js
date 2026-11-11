const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const mongoose = require('mongoose');
const app = require('../app');
const messageService = require('../services/messageService');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

const TEST_PORT = 5055;
let server;
let baseUrl;
let mongodProc;

// Helper to make HTTP requests
const request = async (urlPath, options = {}) => {
  const url = `${baseUrl}${urlPath}`;
  const headers = options.headers || {};
  let body = options.body;

  if (body && typeof body === 'object' && !options.isFormData) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body
  });

  const contentType = response.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return {
    status: response.status,
    headers: response.headers,
    data
  };
};

test.before(async () => {
  // 1. Spawn local mongod process in the same session
  const mongodPath = 'C:\\Program Files\\MongoDB\\Server\\8.3\\bin\\mongod.exe';
  const dbPath = path.resolve(__dirname, '../../../data/db');

  if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(dbPath, { recursive: true });
  }

  mongodProc = spawn(mongodPath, ['--dbpath', dbPath, '--port', '27017']);
  mongodProc.stdout.on('data', (d) => {
    // console.log(`[mongod] ${d}`);
  });
  mongodProc.stderr.on('data', (d) => {
    console.error(`[mongod err] ${d}`);
  });
  mongodProc.on('error', (err) => {
    console.error(`[mongod spawn error] ${err.message}`);
  });

  // Wait for mongod to accept connections
  let connected = false;
  const mongoUri = 'mongodb://127.0.0.1:27017/ptitchat_test';

  for (let i = 0; i < 25; i++) {
    try {
      await new Promise((r) => setTimeout(r, 600));
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 1500 });
      connected = true;
      break;
    } catch (e) {
      if (i === 24) console.error('[Mongoose connect error]', e.message);
    }
  }

  if (!connected) {
    throw new Error('Could not connect to spawned mongod instance');
  }

  // Clear test DB collections
  await User.deleteMany({});
  await Conversation.deleteMany({});
  await Message.deleteMany({});

  // Start HTTP server for testing
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  baseUrl = `http://127.0.0.1:${TEST_PORT}`;
  console.log(`[Test Server] Listening at ${baseUrl}`);
});

test.after(async () => {
  try {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  } catch (e) {}

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }

  if (mongodProc) {
    mongodProc.kill('SIGINT');
  }
  console.log('[Test Server] Closed');
});

test('PTITChat Full Feature Suite', async (t) => {
  let user1, user2, user3, user4;
  let token1, token2, token3, token4;
  let directConvId, groupConvId;
  let firstMsgId, secondMsgId;

  // 1. Authentication & Setup Users
  await t.test('1. Setup 4 test users with JWT tokens', async () => {
    const regUser = async (u, e, p, d) => {
      const res = await request('/api/auth/register', {
        method: 'POST',
        body: { username: u, email: e, password: p, displayName: d }
      });
      assert.strictEqual(res.status, 201, `Failed to register ${u}: ${JSON.stringify(res.data)}`);
      return { user: res.data.data.user, token: res.data.data.token };
    };

    const res1 = await regUser('ptit_user1', 'user1@ptit.edu.vn', '123456', 'Nguyễn Văn A');
    user1 = res1.user;
    token1 = res1.token;

    const res2 = await regUser('ptit_user2', 'user2@ptit.edu.vn', '123456', 'Trần Thị B');
    user2 = res2.user;
    token2 = res2.token;

    const res3 = await regUser('ptit_user3', 'user3@ptit.edu.vn', '123456', 'Lê Văn C');
    user3 = res3.user;
    token3 = res3.token;

    const res4 = await regUser('ptit_user4', 'user4@ptit.edu.vn', '123456', 'Phạm Thị D');
    user4 = res4.user;
    token4 = res4.token;

    assert.ok(token1);
    assert.ok(token2);
    assert.ok(token3);
    assert.ok(token4);
  });

  // 2. Direct Conversations (1-1)
  await t.test('2. POST /api/conversations (Create 1-1 conversation)', async () => {
    const res = await request('/api/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: { recipientId: user2._id }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.type, 'direct');
    assert.strictEqual(res.data.data.members.length, 2);
    directConvId = res.data.data._id;
  });

  await t.test('3. POST /api/conversations (Deduplication: return existing 1-1)', async () => {
    const res = await request('/api/conversations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: { recipientId: user2._id }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data._id, directConvId);
  });

  await t.test('4. GET /api/conversations (List user conversations)', async () => {
    const res = await request('/api/conversations', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.length, 1);
    assert.strictEqual(res.data.data[0]._id, directConvId);
  });

  // 3. Group Conversations
  await t.test('5. POST /api/conversations/group (Create group)', async () => {
    const res = await request('/api/conversations/group', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        name: 'Nhóm Đồ Án PTITChat',
        members: [user2._id, user3._id]
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.name, 'Nhóm Đồ Án PTITChat');
    assert.strictEqual(res.data.data.type, 'group');
    assert.strictEqual(res.data.data.members.length, 3);
    assert.strictEqual(res.data.data.admin._id, user1._id);
    groupConvId = res.data.data._id;
  });

  await t.test('6. PATCH /api/conversations/:id (Rename group)', async () => {
    const res = await request(`/api/conversations/${groupConvId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token1}` },
      body: { name: 'PTITChat Group Pro' }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.name, 'PTITChat Group Pro');
  });

  await t.test('7. PATCH /api/conversations/:id (Add member)', async () => {
    const res = await request(`/api/conversations/${groupConvId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token1}` },
      body: { addMembers: [user4._id] }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.members.length, 4);
  });

  await t.test('8. PATCH /api/conversations/:id (Remove member by admin)', async () => {
    const res = await request(`/api/conversations/${groupConvId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token1}` },
      body: { removeMembers: [user4._id] }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.members.length, 3);
  });

  await t.test('9. Permission Check: Non-member cannot modify group', async () => {
    const res = await request(`/api/conversations/${groupConvId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token4}` },
      body: { name: 'Hacker Group' }
    });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
  });

  // 4. Messages (Send text, file metadata, replyTo, deduplication)
  await t.test('10. POST /api/messages (Send text message)', async () => {
    const res = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        conversationId: directConvId,
        text: 'Xin chào bạn B, mình thảo luận bài tập nhé!',
        clientTempId: 'client-msg-001'
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.text, 'Xin chào bạn B, mình thảo luận bài tập nhé!');
    assert.strictEqual(res.data.data.type, 'text');
    firstMsgId = res.data.data._id;
  });

  await t.test('11. Idempotency Check: Same clientTempId does not create duplicate record', async () => {
    const res = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        conversationId: directConvId,
        text: 'Xin chào bạn B, mình thảo luận bài tập nhé!',
        clientTempId: 'client-msg-001'
      }
    });

    // Should return existing message
    assert.strictEqual(res.data.data._id, firstMsgId);

    const count = await Message.countDocuments({ conversationId: directConvId });
    assert.strictEqual(count, 1);
  });

  await t.test('12. POST /api/messages (Send message with file metadata)', async () => {
    const res = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token2}` },
      body: {
        conversationId: directConvId,
        text: 'Đây là tài liệu đề cương bài tập lớn',
        type: 'file',
        attachments: [
          {
            url: '/uploads/de-cuong-ptitchat.pdf',
            fileName: 'de-cuong-ptitchat.pdf',
            fileType: 'file',
            fileSize: 1048576,
            mimeType: 'application/pdf'
          }
        ]
      }
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.data.attachments.length, 1);
    assert.strictEqual(res.data.data.attachments[0].fileName, 'de-cuong-ptitchat.pdf');
    secondMsgId = res.data.data._id;
  });

  await t.test('13. POST /api/messages (Reply to message with replyTo)', async () => {
    const res = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token1}` },
      body: {
        conversationId: directConvId,
        text: 'Cảm ơn bạn, tài liệu rất rõ ràng!',
        replyTo: secondMsgId
      }
    });

    assert.strictEqual(res.status, 201);
    assert.ok(res.data.data.replyTo);
    assert.strictEqual(res.data.data.replyTo._id, secondMsgId);
    assert.strictEqual(res.data.data.replyTo.text, 'Đây là tài liệu đề cương bài tập lớn');
  });

  await t.test('14. Permission Check: Non-member cannot send message', async () => {
    const res = await request('/api/messages', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token4}` }, // user4 not in directConvId
      body: {
        conversationId: directConvId,
        text: 'Tôi là người lạ gửi tin nhắn'
      }
    });

    assert.strictEqual(res.status, 403);
  });

  // 5. Message History & Pagination
  await t.test('15. GET /api/messages/:conversationId (Pagination)', async () => {
    const res = await request(`/api/messages/${directConvId}?page=1&limit=2`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.total, 3);
    assert.strictEqual(res.data.data.limit, 2);
    assert.strictEqual(res.data.data.messages.length, 2);
  });

  await t.test('16. Permission Check: Non-member cannot read message history', async () => {
    const res = await request(`/api/messages/${directConvId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token4}` }
    });

    assert.strictEqual(res.status, 403);
  });

  // 6. Search Messages
  await t.test('17. GET /api/messages/search?q= (Search in conversation)', async () => {
    const res = await request(`/api/messages/search?q=tài liệu&conversationId=${directConvId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token1}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.messages.length, 2);
  });

  // 7. Edit Message
  await t.test('18. PATCH /api/messages/:id (Edit own message)', async () => {
    const res = await request(`/api/messages/${firstMsgId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token1}` },
      body: { text: 'Nội dung tin nhắn đã được cập nhật' }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.text, 'Nội dung tin nhắn đã được cập nhật');
    assert.strictEqual(res.data.data.isEdited, true);
  });

  await t.test('19. Permission Check: Cannot edit someone else\'s message', async () => {
    const res = await request(`/api/messages/${firstMsgId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token2}` },
      body: { text: 'Hack nội dung tin nhắn' }
    });

    assert.strictEqual(res.status, 403);
  });

  // 8. Soft Recall Message
  await t.test('20. DELETE /api/messages/:id (Soft recall message)', async () => {
    const res = await request(`/api/messages/${firstMsgId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token1}` }
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.isRecall, true);
    assert.strictEqual(res.data.data.text, 'Tin nhắn đã bị thu hồi');

    // Verify record in database is preserved (not hard deleted)
    const dbMsg = await Message.findById(firstMsgId);
    assert.ok(dbMsg);
    assert.strictEqual(dbMsg.isRecall, true);
  });

  await t.test('21. Verify recalled message content is masked in GET /api/messages', async () => {
    const res = await request(`/api/messages/${directConvId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token2}` }
    });

    assert.strictEqual(res.status, 200);
    const recalledInList = res.data.data.messages.find((m) => m._id === firstMsgId);
    assert.ok(recalledInList);
    assert.strictEqual(recalledInList.text, 'Tin nhắn đã bị thu hồi');
  });

  await t.test('22. Cannot edit recalled message', async () => {
    const res = await request(`/api/messages/${firstMsgId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token1}` },
      body: { text: 'Cố sửa tin đã thu hồi' }
    });

    assert.strictEqual(res.status, 400);
  });

  // 9. Shared messageService test (Used by Socket.IO)
  await t.test('23. Shared messageService.createMessage works seamlessly with deduplication', async () => {
    const saved = await messageService.createMessage({
      conversationId: groupConvId,
      senderId: user1._id,
      text: 'Tin nhắn gửi qua Socket.IO',
      clientTempId: 'socket-temp-999'
    });

    assert.ok(saved);
    assert.strictEqual(saved.text, 'Tin nhắn gửi qua Socket.IO');

    // Calling again with same clientTempId (e.g. from REST retry)
    const duplicateCheck = await messageService.createMessage({
      conversationId: groupConvId,
      senderId: user1._id,
      text: 'Tin nhắn gửi qua REST API retry',
      clientTempId: 'socket-temp-999'
    });

    assert.strictEqual(duplicateCheck._id.toString(), saved._id.toString());
  });

  // 10. Upload File with Multer
  await t.test('24. POST /api/uploads (Upload file using multipart/form-data)', async () => {
    // Construct boundary and multipart body
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const fileContent = 'Hello PTITChat File Test Content';
    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="file"; filename="test.txt"\r\n'),
      Buffer.from('Content-Type: text/plain\r\n\r\n'),
      Buffer.from(fileContent),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await request('/api/uploads', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token1}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer,
      isFormData: true
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert.ok(res.data.data.url.startsWith('/uploads/'));
    assert.strictEqual(res.data.data.originalName, 'test.txt');
    assert.strictEqual(res.data.data.type, 'file');
  });

  await t.test('25. POST /api/uploads (Reject disallowed file type)', async () => {
    const boundary = '----WebKitFormBoundaryDisallowedType';
    const fileContent = 'malicious code';
    const bodyBuffer = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from('Content-Disposition: form-data; name="file"; filename="evil.exe"\r\n'),
      Buffer.from('Content-Type: application/x-msdownload\r\n\r\n'),
      Buffer.from(fileContent),
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const res = await request('/api/uploads', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token1}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer,
      isFormData: true
    });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
    assert.ok(res.data.message.includes('không được hỗ trợ'));
  });
});
