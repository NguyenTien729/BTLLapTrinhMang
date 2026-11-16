const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const messageService = require('../services/messageService');
const { notifyNewMessage } = require('./notificationSocket');

// Gắn các sự kiện chat cho một socket đã đăng nhập.
// Tin nhắn luôn được lưu qua messageService của Tùng để REST API và Socket.IO
// dùng chung một chỗ xử lý.
const initChatSocket = (io, socket) => {
  const userId = socket.userId;

  // Lấy hội thoại và kiểm tra người dùng có trong nhóm không
  const getConversation = async (conversationId) => {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error('Cuộc trò chuyện không tồn tại');
    if (!conversation.hasMember(userId)) {
      throw new Error('Bạn không phải thành viên của cuộc trò chuyện này');
    }
    return conversation;
  };

  // Vào phòng chat
  socket.on('conversation:join', async (data, callback) => {
    try {
      const conversation = await getConversation(data?.conversationId);
      socket.join(conversation._id.toString());
      if (typeof callback === 'function') {
        callback({ success: true, conversationId: conversation._id.toString() });
      }
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  });

  // Rời phòng chat
  socket.on('conversation:leave', (data) => {
    if (data?.conversationId) socket.leave(data.conversationId.toString());
  });

  // Gửi tin nhắn (1-1 hoặc nhóm đều dùng chung)
  socket.on('message:send', async (data, callback) => {
    try {
      const conversation = await getConversation(data?.conversationId);

      const message = await messageService.createMessage({
        conversationId: conversation._id,
        senderId: userId,
        text: data?.text,
        type: data?.type,
        attachments: data?.attachments,
        replyTo: data?.replyTo,
        // clientTempId giúp không tạo trùng khi client gửi lại lúc mạng chập chờn
        clientTempId: data?.clientTempId
      });

      // Gửi cho mọi người trong phòng (trừ tab vừa gửi)
      socket.to(conversation._id.toString()).emit('message:new', message);

      // Thông báo cho thành viên không mở hội thoại này
      notifyNewMessage(io, conversation, message, socket.id);

      if (typeof callback === 'function') callback({ success: true, data: message });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  });

  // Sửa tin nhắn của mình
  socket.on('message:edit', async (data, callback) => {
    try {
      const message = await messageService.editMessage({
        messageId: data?.messageId,
        userId,
        newText: data?.text
      });
      io.to(message.conversationId.toString()).emit('message:edited', message);
      if (typeof callback === 'function') callback({ success: true, data: message });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  });

  // Thu hồi tin nhắn
  socket.on('message:revoke', async (data, callback) => {
    try {
      const message = await messageService.recallMessage({
        messageId: data?.messageId,
        userId
      });
      io.to(message.conversationId.toString()).emit('message:revoked', message);
      if (typeof callback === 'function') callback({ success: true, data: message });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  });

  // Đánh dấu đã xem
  socket.on('message:seen', async (data, callback) => {
    try {
      const conversation = await getConversation(data?.conversationId);
      const seenAt = new Date();

      await Message.updateMany(
        { conversationId: conversation._id, isRecall: false },
        { $addToSet: { readBy: { user: userId, readAt: seenAt } } }
      );

      socket.to(conversation._id.toString()).emit('message:seen', {
        conversationId: conversation._id.toString(),
        userId,
        seenAt
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  });

  // Đang nhập / dừng nhập
  socket.on('typing:start', (data) => {
    if (!data?.conversationId) return;
    socket.to(data.conversationId.toString()).emit('typing:start', {
      conversationId: data.conversationId,
      userId,
      displayName: socket.user.displayName || socket.user.username
    });
  });

  socket.on('typing:stop', (data) => {
    if (!data?.conversationId) return;
    socket.to(data.conversationId.toString()).emit('typing:stop', {
      conversationId: data.conversationId,
      userId
    });
  });
};

module.exports = initChatSocket;
