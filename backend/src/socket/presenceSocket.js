const User = require('../models/User');

// userId -> Set các socketId đang mở
// Dùng Map để biết ai đang online. Một người mở nhiều tab thì có nhiều socketId.
const onlineUsers = new Map();

// Thêm socket vào danh sách online
const registerPresence = (io, socket) => {
  const userId = socket.userId;
  if (!userId) return;

  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
    // Chỉ lần đầu mở kết nối mới báo online cho mọi người
    io.emit('user:online', { userId });
    io.emit('presence', { id: userId, userId, online: true });
  }
  onlineUsers.get(userId).add(socket.id);

  // Lưu trạng thái vào database để lần sau đăng nhập còn biết lastSeen
  User.findByIdAndUpdate(userId, { isOnline: true }).catch(() => {});

  // Gửi danh sách đang online cho người vừa kết nối
  socket.emit('presence:list', { onlineUserIds: [...onlineUsers.keys()] });

  socket.on('disconnect', () => {
    const sockets = onlineUsers.get(userId);
    if (!sockets) return;

    sockets.delete(socket.id);
    // Còn tab khác thì chưa offline
    if (sockets.size > 0) return;

    onlineUsers.delete(userId);
    const lastSeen = new Date();
    User.findByIdAndUpdate(userId, { isOnline: false, lastSeen }).catch(() => {});
    io.emit('user:offline', { userId, lastSeen });
    io.emit('presence', { id: userId, userId, online: false, lastSeen });
  });
};

// Kiểm tra một user có đang online không
const isUserOnline = (userId) => onlineUsers.has(userId?.toString());

// Xoá hết khi test
const resetPresence = () => onlineUsers.clear();

module.exports = { registerPresence, isUserOnline, resetPresence, onlineUsers };
