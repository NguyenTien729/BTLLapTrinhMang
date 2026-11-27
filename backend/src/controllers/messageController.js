<<<<<<< HEAD
const service = require('../services/messageService');
const { publishMessage } = require('../socket/events');
const handle = work => async (req,res,next) => { try { await work(req,res); } catch(error) { next(error); } };
exports.getMessages = handle(async (req,res) => res.json({ success:true, data:await service.getConversationMessages({
  ...req.query, conversationId:req.params.conversationId, userId:req.user._id,
}) }));
exports.searchMessages = handle(async (req,res) => res.json({ success:true, data:await service.searchMessages({
  ...req.query, userId:req.user._id, query:req.query.q,
}) }));
exports.sendMessage = handle(async (req,res) => {
  const message = await service.createMessage({ ...req.body, senderId:req.user._id });
  const conversation = await service.requireMember(message.conversationId,req.user._id);
  publishMessage(req.app.get('io'),conversation,'message:new',message);
  res.status(201).json({ success:true, data:message });
});
exports.editMessage = handle(async (req,res) => {
  const message=await service.editMessage({ messageId:req.params.id,userId:req.user._id,newText:req.body.text });
  const conversation=await service.requireMember(message.conversationId,req.user._id);
  publishMessage(req.app.get('io'),conversation,'message:edited',message);
  res.json({ success:true,data:message });
});
exports.recallMessage = handle(async (req,res) => {
  const message=await service.recallMessage({ messageId:req.params.id,userId:req.user._id });
  const conversation=await service.requireMember(message.conversationId,req.user._id);
  publishMessage(req.app.get('io'),conversation,'message:revoked',message);
  res.json({ success:true,data:message });
});
=======
const mongoose = require('mongoose');
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

module.exports = {
  getMessages,
  sendMessage,
  editMessage,
  recallMessage,
  searchMessages
};

>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
