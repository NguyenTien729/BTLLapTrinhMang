const messageService = require('../services/messageService');

/**
 * Socket.IO Chat Event Handler
 * Reuses messageService.createMessage so REST API and Socket.IO share the exact same logic
 * and deduplicate messages via clientTempId.
 */
const initChatSocket = (io, socket) => {
  const user = socket.user;

  // Join a conversation room
  socket.on('join_conversation', (conversationId) => {
    if (conversationId) {
      socket.join(conversationId.toString());
      console.log(`[Socket] User ${user?._id || socket.id} joined conversation: ${conversationId}`);
    }
  });

  // Leave a conversation room
  socket.on('leave_conversation', (conversationId) => {
    if (conversationId) {
      socket.leave(conversationId.toString());
      console.log(`[Socket] User ${user?._id || socket.id} left conversation: ${conversationId}`);
    }
  });

  // Handle send message
  socket.on('send_message', async (data, callback) => {
    try {
      const {
        conversationId,
        text,
        type,
        attachments,
        replyTo,
        clientTempId
      } = data || {};

      const senderId = user?._id || data?.senderId;

      if (!senderId) {
        if (typeof callback === 'function') {
          return callback({
            success: false,
            message: 'Không tìm thấy thông tin người gửi'
          });
        }
        return;
      }

      // Call shared messageService to create or get deduplicated message
      const savedMessage = await messageService.createMessage({
        conversationId,
        senderId,
        text,
        type,
        attachments,
        replyTo,
        clientTempId
      });

      // Broadcast to all sockets in the conversation room
      io.to(conversationId.toString()).emit('receive_message', savedMessage);
      io.to(conversationId.toString()).emit('new_message', savedMessage);

      if (typeof callback === 'function') {
        callback({
          success: true,
          data: savedMessage
        });
      }
    } catch (error) {
      console.error('[Socket] send_message error:', error.message);
      if (typeof callback === 'function') {
        callback({
          success: false,
          message: error.message
        });
      }
    }
  });

  // Handle edit message
  socket.on('edit_message', async (data, callback) => {
    try {
      const { messageId, text, content } = data || {};
      const newText = text || content;
      const userId = user?._id || data?.userId;

      const updated = await messageService.editMessage({
        messageId,
        userId,
        newText
      });

      io.to(updated.conversationId.toString()).emit('message_edited', updated);

      if (typeof callback === 'function') {
        callback({ success: true, data: updated });
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, message: error.message });
      }
    }
  });

  // Handle recall message
  socket.on('recall_message', async (data, callback) => {
    try {
      const { messageId } = data || {};
      const userId = user?._id || data?.userId;

      const recalled = await messageService.recallMessage({
        messageId,
        userId
      });

      io.to(recalled.conversationId.toString()).emit('message_recalled', recalled);

      if (typeof callback === 'function') {
        callback({ success: true, data: recalled });
      }
    } catch (error) {
      if (typeof callback === 'function') {
        callback({ success: false, message: error.message });
      }
    }
  });

  // Typing indicators
  socket.on('typing', ({ conversationId }) => {
    if (conversationId) {
      socket.to(conversationId.toString()).emit('user_typing', {
        conversationId,
        userId: user?._id,
        displayName: user?.displayName || user?.username
      });
    }
  });

  socket.on('stop_typing', ({ conversationId }) => {
    if (conversationId) {
      socket.to(conversationId.toString()).emit('user_stop_typing', {
        conversationId,
        userId: user?._id
      });
    }
  });
};

module.exports = initChatSocket;

