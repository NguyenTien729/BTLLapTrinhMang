const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Kiểm tra token trước khi cho client kết nối.
// Client gửi token qua: io(url, { auth: { token } })
const socketAuth = async (socket, next) => {
  try {
    const token =
      socket.handshake.auth?.token ||
      socket.handshake.headers?.authorization?.replace(/^Bearer\s+/, '') ||
      socket.handshake.query?.token;

    if (!token) {
      return next(new Error('Thiếu token xác thực'));
    }

    // Token do module đăng nhập phát ra, cùng JWT_SECRET.
    // Hỗ trợ cả { id } và { sub } để tương thích mọi bên.
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'ptitchat_super_secret_jwt_key_2026_ptit_telecom');
    const userId = decoded.id || decoded.sub || decoded.userId;

    const user = await User.findById(userId);
    if (!user) {
      return next(new Error('Tài khoản không tồn tại'));
    }

    socket.user = user;
    socket.userId = user._id.toString();
    next();
  } catch (error) {
    next(new Error('Token không hợp lệ hoặc đã hết hạn'));
  }
};

module.exports = socketAuth;
