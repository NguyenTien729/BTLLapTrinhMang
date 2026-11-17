const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Kiểm tra token trước khi cho client kết nối.
// Client gửi token qua: io(url, { auth: { token } })
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Thiếu token xác thực'));
    }

    // Token do module đăng nhập của Tiến/Tùng phát ra, cùng JWT_SECRET.
    // Payload có thể là { id } hoặc { sub } nên đọc cả hai cho chắc.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
