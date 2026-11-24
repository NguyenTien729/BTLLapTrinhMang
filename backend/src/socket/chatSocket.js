const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const messageService = require('../services/messageService');
const { notifyNewMessage } = require('./notificationSocket');

/**
 * Gắn các sự kiện chat cho một socket đã xác thực.
 * Tích hợp chặt chẽ với messageService để lưu tin nhắn dùng chung cho REST API và Socket.IO,
 * chống tạo trùng lặp với clientTempId.
 */
const initChatSocket = (io, socket) => {
  const userId = socket.userId || socket.user?._id?.toString();

  // Helper lấy cuộc trò chuyện và kiểm tra quyền thành viên
  const getConversation = async (conversationId) => {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error('Cuộc trò chuyện không tồn tại');
    if (!conversation.hasMember(userId)) {
      throw new Error('Bạn không phải thành viên của cuộc trò chuyện này');
    }
    return conversation;
  };

  // 1. Vào phòng chat
  const handleJoin = async (data, callback) => {
    try {
      const convId = data?.conversationId || data;
      const conversation = await getConversation(convId);
      socket.join(conversation._id.toString());
      if (typeof callback === 'function') {
        callback({ success: true, conversationId: conversation._id.toString() });
      }
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('conversation:join', handleJoin);
  socket.on('join_conversation', handleJoin);

  // 2. Rời phòng chat
  const handleLeave = (data) => {
    const convId = data?.conversationId || data;
    if (convId) socket.leave(convId.toString());
  };
  socket.on('conversation:leave', handleLeave);
  socket.on('leave_conversation', handleLeave);

  // 3. Gửi tin nhắn mới
  const handleSend = async (data, callback) => {
    try {
      const conversation = await getConversation(data?.conversationId);

      const message = await messageService.createMessage({
        conversationId: conversation._id,
        senderId: userId,
        text: data?.text,
        type: data?.type,
        attachments: data?.attachments,
        replyTo: data?.replyTo,
        clientTempId: data?.clientTempId
      });

      // Phát cho các client khác trong phòng
      socket.to(conversation._id.toString()).emit('message:new', message);
      socket.to(conversation._id.toString()).emit('receive_message', message);

      // Thông báo cho thành viên khác không mở tab hội thoại này
      notifyNewMessage(io, conversation, message, socket.id);

      if (typeof callback === 'function') callback({ success: true, data: message });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('message:send', handleSend);
  socket.on('send_message', handleSend);

  // 4. Sửa tin nhắn
  const handleEdit = async (data, callback) => {
    try {
      const message = await messageService.editMessage({
        messageId: data?.messageId || data?.id,
        userId,
        newText: data?.text || data?.content
      });
      io.to(message.conversationId.toString()).emit('message:edited', message);
      io.to(message.conversationId.toString()).emit('message_edited', message);
      if (typeof callback === 'function') callback({ success: true, data: message });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('message:edit', handleEdit);
  socket.on('edit_message', handleEdit);

  // 5. Thu hồi tin nhắn
  const handleRevoke = async (data, callback) => {
    try {
      const message = await messageService.recallMessage({
        messageId: data?.messageId || data?.id,
        userId
      });
      io.to(message.conversationId.toString()).emit('message:revoked', message);
      io.to(message.conversationId.toString()).emit('message_recalled', message);
      if (typeof callback === 'function') callback({ success: true, data: message });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('message:revoke', handleRevoke);
  socket.on('recall_message', handleRevoke);

  // 5.1. Đánh dấu đã nhận (Delivery ACK)
  const handleDelivered = async (data) => {
    try {
      const messageId = data?.messageId || data?.id;
      const convId = data?.conversationId;
      if (!messageId) return;

      const now = new Date();
      const updated = await Message.findByIdAndUpdate(
        messageId,
        {
          $set: { status: 'delivered' },
          $addToSet: { deliveredTo: { user: userId, deliveredAt: now } }
        },
        { new: true }
      );

      if (updated) {
        const roomId = (convId || updated.conversationId).toString();
        io.to(roomId).emit('message:delivered', {
          messageId: updated._id.toString(),
          conversationId: roomId,
          userId,
          status: 'delivered'
        });
      }
    } catch (err) {
      console.error('[Socket] message:delivered error:', err.message);
    }
  };
  socket.on('message:delivered', handleDelivered);
  socket.on('message_delivered', handleDelivered);

  // 6. Đánh dấu đã xem (Read Receipt ACK)
  const handleSeen = async (data, callback) => {
    try {
      const convId = data?.conversationId || data;
      if (!convId) return;
      const conversation = await getConversation(convId);
      const seenAt = new Date();

      await Message.updateMany(
        { conversationId: conversation._id, sender: { $ne: userId }, isRecall: false },
        {
          $set: { status: 'seen' },
          $addToSet: { readBy: { user: userId, readAt: seenAt } }
        }
      );

      socket.to(conversation._id.toString()).emit('message:seen', {
        conversationId: conversation._id.toString(),
        userId,
        seenAt,
        status: 'seen'
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('message:seen', handleSeen);
  socket.on('mark_seen', handleSeen);

  // 7. Đang nhập / dừng nhập
  socket.on('typing:start', (data) => {
    if (!data?.conversationId) return;
    socket.to(data.conversationId.toString()).emit('typing:start', {
      conversationId: data.conversationId,
      userId,
      displayName: socket.user?.displayName || socket.user?.username
    });
  });

  socket.on('typing:stop', (data) => {
    if (!data?.conversationId) return;
    socket.to(data.conversationId.toString()).emit('typing:stop', {
      conversationId: data.conversationId,
      userId
    });
  });

  // 8. Thả cảm xúc tin nhắn (Reactions)
  const handleReact = async (data, callback) => {
    try {
      const messageId = data?.messageId || data?.id;
      const emoji = data?.emoji;
      if (!messageId || !emoji) return;

      const msg = await Message.findById(messageId);
      if (!msg) throw new Error('Tin nhắn không tồn tại');

      if (!Array.isArray(msg.reactions)) msg.reactions = [];
      const cleanEmoji = emoji.trim();
      const existingIndex = msg.reactions.findIndex(
        (r) => r.user.toString() === userId.toString()
      );

      if (existingIndex > -1) {
        if (msg.reactions[existingIndex].emoji === cleanEmoji) {
          msg.reactions.splice(existingIndex, 1);
        } else {
          msg.reactions[existingIndex].emoji = cleanEmoji;
        }
      } else {
        msg.reactions.push({ user: userId, emoji: cleanEmoji });
      }

      await msg.save();

      const payload = {
        messageId: msg._id.toString(),
        conversationId: msg.conversationId.toString(),
        reactions: msg.reactions
      };

      io.to(msg.conversationId.toString()).emit('message:reaction', payload);
      if (typeof callback === 'function') callback({ success: true, data: payload });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('message:react', handleReact);
  socket.on('message_react', handleReact);

  // 9. Ghim / Bỏ ghim tin nhắn
  const handlePin = async (data, callback) => {
    try {
      const conversationId = data?.conversationId;
      const messageId = data?.messageId; // null or id
      if (!conversationId) return;

      const conv = await Conversation.findById(conversationId);
      if (!conv) throw new Error('Cuộc trò chuyện không tồn tại');
      if (!conv.hasMember(userId)) throw new Error('Không có quyền ghim tin nhắn');

      let pinnedMsg = null;
      if (messageId) {
        const msg = await Message.findOne({ _id: messageId, conversationId });
        if (!msg) throw new Error('Tin nhắn không tồn tại');

        if (conv.pinnedMessage) {
          await Message.findByIdAndUpdate(conv.pinnedMessage, {
            isPinned: false,
            pinnedAt: null,
            pinnedBy: null
          });
        }

        msg.isPinned = true;
        msg.pinnedAt = new Date();
        msg.pinnedBy = userId;
        await msg.save();

        conv.pinnedMessage = msg._id;
        await conv.save();

        const populated = await Message.findById(msg._id).populate('sender', '_id username displayName avatar');
        pinnedMsg = populated.toClientJSON ? populated.toClientJSON() : populated;
      } else {
        if (conv.pinnedMessage) {
          await Message.findByIdAndUpdate(conv.pinnedMessage, {
            isPinned: false,
            pinnedAt: null,
            pinnedBy: null
          });
        }
        conv.pinnedMessage = null;
        await conv.save();
      }

      const payload = {
        conversationId: conversationId.toString(),
        pinnedMessage: pinnedMsg
      };

      io.to(conversationId.toString()).emit('conversation:pinned', payload);
      if (typeof callback === 'function') callback({ success: true, data: payload });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('message:pin', handlePin);
  socket.on('pin_message', handlePin);
};

module.exports = initChatSocket;
