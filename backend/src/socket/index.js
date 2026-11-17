const { Server } = require('socket.io');
const socketAuth = require('./authSocket');
const { registerPresence } = require('./presenceSocket');
const initChatSocket = require('./chatSocket');

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

    // Bước 3: theo dõi online/offline
    registerPresence(io, socket);

    // Bước 4: các sự kiện chat
    initChatSocket(io, socket);

    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user?.username || socket.userId} ngắt kết nối (${socket.id})`);
    });
  });

  return io;
};

module.exports = initSocketIO;
