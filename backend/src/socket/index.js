const { Server } = require('socket.io');
const socketAuth = require('./authSocket');
const { registerPresence } = require('./presenceSocket');
const initChatSocket = require('./chatSocket');
<<<<<<< HEAD

// Khởi tạo Socket.IO và gắn các phần xử lý
const initSocketIO = (server) => {
  const io = new Server(server, {
    cors: {
      // Cho phép frontend Vite gọi tới
      origin: require('../config/origins')(),
=======
const Conversation = require('../models/Conversation');

// Khởi tạo Socket.IO và gắn các module xử lý
const initSocketIO = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || process.env.CLIENT_ORIGIN || 'http://localhost:5173',
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
      credentials: true
    }
  });

  // Bước 1: kiểm tra token trước khi cho kết nối
  io.use(socketAuth);

  io.on('connection', (socket) => {
<<<<<<< HEAD
    const expire = () => { socket.emit('auth:expired'); socket.disconnect(true); };
    const expiryTimer = setTimeout(expire, Math.max(0, socket.tokenExpiresAt - Date.now()));
    expiryTimer.unref();
    socket.use((_packet, next) => {
      if (Date.now() >= socket.tokenExpiresAt) { expire(); return next(new Error('Phiên đăng nhập đã hết hạn.')); }
      next();
    });
    socket.once('disconnect', () => clearTimeout(expiryTimer));
    console.log(`[Socket] ${socket.user.username} kết nối (${socket.id})`);
=======
    console.log(`[Socket] ${socket.user?.username || socket.userId} kết nối (${socket.id})`);
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034

    // Bước 2: vào room riêng của user để nhận thông báo ở mọi tab
    socket.join('user:' + socket.userId);

<<<<<<< HEAD
=======
    // Bước 2.1: tự động vào tất cả các phòng hội thoại mà user tham gia
    Conversation.find({ members: socket.userId })
      .select('_id')
      .then((convs) => {
        convs.forEach((c) => socket.join(c._id.toString()));
      })
      .catch(() => {});

>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
    // Bước 3: theo dõi online/offline
    registerPresence(io, socket);

    // Bước 4: các sự kiện chat
    initChatSocket(io, socket);

<<<<<<< HEAD
    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user.username} ngắt kết nối (${socket.id})`);
=======
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
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
    });
  });

  return io;
};

module.exports = initSocketIO;
