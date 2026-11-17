import { io } from 'socket.io-client';

// Địa chỉ backend. Khi dev có thể đổi qua biến môi trường VITE_SOCKET_URL
const SOCKET_URL = import.meta.env?.VITE_SOCKET_URL || 'http://localhost:5000';

// Tạo id tạm cho tin nhắn, dùng để server chống tạo trùng khi gửi lại
const createTempId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

let socket = null;

// Các hội thoại đang mở, để tự vào lại phòng sau khi mất mạng
const joinedConversations = new Set();

// Kết nối tới server kèm token đăng nhập.
// Gọi sau khi đăng nhập thành công.
const connect = (token) => {
  if (socket) socket.disconnect();

  socket = io(SOCKET_URL, {
    auth: { token },
    // Tự kết nối lại khi mạng bị ngắt
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000
  });

  // Khi kết nối lại, socket có id mới nên phải vào lại các phòng đang mở
  socket.on('connect', () => {
    for (const conversationId of joinedConversations) {
      socket.emit('conversation:join', { conversationId });
    }
  });

  return socket;
};

// Ngắt kết nối khi đăng xuất
const disconnect = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  joinedConversations.clear();
};

// Lấy socket hiện tại
const getSocket = () => socket;

// Vào / rời phòng chat
const joinConversation = (conversationId) => {
  joinedConversations.add(conversationId);
  socket?.emit('conversation:join', { conversationId });
};

const leaveConversation = (conversationId) => {
  joinedConversations.delete(conversationId);
  socket?.emit('conversation:leave', { conversationId });
};

// Gửi tin nhắn, trả về Promise để biết gửi thành công hay chưa
const sendMessage = ({ conversationId, text, replyTo = null }) =>
  new Promise((resolve, reject) => {
    if (!socket) return reject(new Error('Chưa kết nối tới server'));

    socket.emit(
      'message:send',
      { conversationId, text, replyTo, clientTempId: createTempId() },
      (response) => {
        if (response?.success) resolve(response.data);
        else reject(new Error(response?.message || 'Gửi tin nhắn thất bại'));
      }
    );
  });

// Sửa tin nhắn
const editMessage = (messageId, text) =>
  new Promise((resolve, reject) => {
    socket?.emit('message:edit', { messageId, text }, (response) => {
      if (response?.success) resolve(response.data);
      else reject(new Error(response?.message || 'Sửa tin nhắn thất bại'));
    });
  });

// Thu hồi tin nhắn
const revokeMessage = (messageId) =>
  new Promise((resolve, reject) => {
    socket?.emit('message:revoke', { messageId }, (response) => {
      if (response?.success) resolve(response.data);
      else reject(new Error(response?.message || 'Thu hồi tin nhắn thất bại'));
    });
  });

// Đánh dấu đã xem
const markSeen = (conversationId) => {
  socket?.emit('message:seen', { conversationId });
};

// Đang nhập
const startTyping = (conversationId) => {
  socket?.emit('typing:start', { conversationId });
};

const stopTyping = (conversationId) => {
  socket?.emit('typing:stop', { conversationId });
};

export {
  connect,
  disconnect,
  getSocket,
  joinConversation,
  leaveConversation,
  sendMessage,
  editMessage,
  revokeMessage,
  markSeen,
  startTyping,
  stopTyping,
  createTempId
};
