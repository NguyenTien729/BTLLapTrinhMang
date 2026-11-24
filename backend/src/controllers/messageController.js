const mongoose = require('mongoose');
const Message = require('../models/Message');
const messageService = require('../services/messageService');

/**
 * @route   GET /api/messages/:conversationId
 * @desc    Get message history for a conversation with pagination
 * @access  Private
 */
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { page, limit, before } = req.query;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'conversationId không hợp lệ'
      });
    }

    const result = await messageService.getConversationMessages({
      conversationId,
      userId: req.user._id,
      page,
      limit,
      before
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Lỗi lấy lịch sử tin nhắn'
    });
  }
};

/**
 * @route   POST /api/messages
 * @desc    Send a new message (text and/or file metadata)
 * @access  Private
 */
const sendMessage = async (req, res) => {
  try {
    const {
      conversationId,
      text,
      type,
      attachments,
      replyTo,
      clientTempId
    } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp conversationId'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'conversationId không hợp lệ'
      });
    }

    const message = await messageService.createMessage({
      conversationId,
      senderId: req.user._id,
      text,
      type,
      attachments,
      replyTo,
      clientTempId
    });

    res.status(201).json({
      success: true,
      message: 'Gửi tin nhắn thành công',
      data: message
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Lỗi gửi tin nhắn'
    });
  }
};

/**
 * @route   PATCH /api/messages/:id
 * @desc    Edit user's own message
 * @access  Private
 */
const editMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const newText = req.body.text || req.body.content;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID tin nhắn không hợp lệ'
      });
    }

    const updated = await messageService.editMessage({
      messageId: id,
      userId: req.user._id,
      newText
    });

    res.status(200).json({
      success: true,
      message: 'Chỉnh sửa tin nhắn thành công',
      data: updated
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Lỗi chỉnh sửa tin nhắn'
    });
  }
};

/**
 * @route   DELETE /api/messages/:id
 * @desc    Soft recall message (hide content without deleting from database)
 * @access  Private
 */
const recallMessage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID tin nhắn không hợp lệ'
      });
    }

    const recalled = await messageService.recallMessage({
      messageId: id,
      userId: req.user._id
    });

    res.status(200).json({
      success: true,
      message: 'Thu hồi tin nhắn thành công',
      data: recalled
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Lỗi thu hồi tin nhắn'
    });
  }
};

/**
 * @route   GET /api/messages/search?q=
 * @desc    Search messages in a conversation or across conversations
 * @access  Private
 */
const searchMessages = async (req, res) => {
  try {
    const { q, conversationId, page, limit } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp tham số tìm kiếm ?q='
      });
    }

    if (conversationId && !mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'conversationId không hợp lệ'
      });
    }

    const result = await messageService.searchMessages({
      userId: req.user._id,
      query: q,
      conversationId,
      page,
      limit
    });

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    res.status(statusCode).json({
      success: false,
      message: error.message || 'Lỗi tìm kiếm tin nhắn'
    });
  }
};

/**
 * @route   PATCH /api/messages/:conversationId/seen
 * @desc    Mark all messages in conversation as seen
 * @access  Private
 */
const markMessagesSeen = async (req, res) => {
  try {
    const { conversationId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'conversationId không hợp lệ'
      });
    }

    const userId = req.user._id;
    const now = new Date();

    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        'readBy.user': { $ne: userId }
      },
      {
        $set: { status: 'seen' },
        $push: { readBy: { user: userId, readAt: now } }
      }
    );

    res.status(200).json({
      success: true,
      message: 'Đã đánh dấu đã xem'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Lỗi cập nhật trạng thái đã xem'
    });
  }
};

/**
 * @route   PATCH /api/messages/:id/react
 * @desc    Toggle emoji reaction on message
 * @access  Private
 */
const reactMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body || {};
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID tin nhắn không hợp lệ'
      });
    }

    if (!emoji || typeof emoji !== 'string' || !emoji.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Emoji không được để trống'
      });
    }

    const cleanEmoji = emoji.trim();
    const msg = await Message.findById(id);
    if (!msg) {
      return res.status(404).json({
        success: false,
        message: 'Tin nhắn không tồn tại'
      });
    }

    if (!Array.isArray(msg.reactions)) {
      msg.reactions = [];
    }

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

    const io = req.app?.get('io');
    if (io) {
      io.to(msg.conversationId.toString()).emit('message:reaction', payload);
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật cảm xúc thành công',
      data: payload
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật cảm xúc: ' + error.message
    });
  }
};

module.exports = {
  getMessages,
  sendMessage,
  editMessage,
  recallMessage,
  markMessagesSeen,
  searchMessages,
  reactMessage
};

