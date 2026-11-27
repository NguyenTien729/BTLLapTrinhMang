const { Server } = require('socket.io');
const socketAuth = require('./authSocket');
const { registerPresence } = require('./presenceSocket');
const initChatSocket = require('./chatSocket');

// Khởi tạo Socket.IO và gắn các phần xử lý
const initSocketIO = (server) => {
  const io = new Server(server, {
    cors: {
      // Cho phép frontend Vite gọi tới
      origin: require('../config/origins')(),
      credentials: true
    }
  });

  // Bước 1: kiểm tra token trước khi cho kết nối
  io.use(socketAuth);

  io.on('connection', (socket) => {
    const expire = () => { socket.emit('auth:expired'); socket.disconnect(true); };
    const expiryTimer = setTimeout(expire, Math.max(0, socket.tokenExpiresAt - Date.now()));
    expiryTimer.unref();
    socket.use((_packet, next) => {
      if (Date.now() >= socket.tokenExpiresAt) { expire(); return next(new Error('Phiên đăng nhập đã hết hạn.')); }
      next();
    });
    socket.once('disconnect', () => clearTimeout(expiryTimer));
    console.log(`[Socket] ${socket.user.username} kết nối (${socket.id})`);

    // Bước 2: vào room riêng của user để nhận thông báo ở mọi tab
    socket.join('user:' + socket.userId);

    // Bước 3: theo dõi online/offline
    registerPresence(io, socket);

    // Bước 4: các sự kiện chat
    initChatSocket(io, socket);

    socket.on('disconnect', () => {
      console.log(`[Socket] ${socket.user.username} ngắt kết nối (${socket.id})`);
    });
  });

  return io;
};

module.exports = initSocketIO;
