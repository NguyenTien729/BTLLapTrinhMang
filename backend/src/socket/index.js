const { Server } = require('socket.io');
const socketAuth = require('./authSocket');
const { registerPresence } = require('./presenceSocket');
const initChatSocket = require('./chatSocket');
const initCallSocket = require('./callSocket');
const Conversation = require('../models/Conversation');

// Khởi tạo Socket.IO và gắn các module xử lý
const initSocketIO = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      credentials: true
    }
  });

  // Bước 1: kiểm tra token trước khi cho kết nối
  io.use(socketAuth);

  io.on('connection', (socket) => {
    console.log(`[Socket] ${socket.user?.username || socket.userId} kết nối (${socket.id})`);

    // Bước 2: vào room riêng của user để nhận thông báo ở mọi tab
    socket.join('user:' + socket.userId);

    // Bước 2.1: tự động vào tất cả các phòng hội thoại mà user tham gia
    Conversation.find({ members: socket.userId })
      .select('_id')
      .then((convs) => {
        convs.forEach((c) => socket.join(c._id.toString()));
      })
      .catch(() => {});

    // Bước 3: theo dõi online/offline
    registerPresence(io, socket);

    // Bước 4: các sự kiện chat
    initChatSocket(io, socket);

    // Bước 4.1: các sự kiện WebRTC Video/Audio Call 1-1
    initCallSocket(io, socket);

    // Bước 4.1: sự kiện typing tương thích giao diện Son
    socket.on('typing', (payload) => {
      if (payload?.conversationId) {
        socket.to(payload.conversationId.toString()).emit('typing', {
          conversationId: payload.conversationId.toString(),
          userId: socket.userId,
          isTyping: !!payload.isTyping
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user?.username || socket.userId} ngắt kết nối (${socket.id})`);
    });
  });

  return io;
};

module.exports = initSocketIO;
