const express = require('express');
const router = express.Router();
const {
  getConversations,
  createOrGetDirectConversation,
  createGroupConversation,
  updateConversation,
  pinConversationMessage
} = require('../controllers/conversationController');
const { protect } = require('../middleware/authMiddleware');

// All conversation routes require JWT authentication
router.use(protect);

router.route('/')
  .get(getConversations)
  .post(createOrGetDirectConversation);

router.post('/group', createGroupConversation);

const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

router.patch('/:id', updateConversation);
router.patch('/:id/pin', pinConversationMessage);

// Send message to conversation (Son's frontend endpoint)
router.post('/:id/messages', async (req, res) => {
  try {
    const convId = req.params.id;
    const userId = req.user._id;
    const { text = '', file, clientTempId, replyTo } = req.body || {};

    // Deduplication check
    if (clientTempId) {
      const existing = await Message.findOne({ conversationId: convId, clientTempId }).populate({
        path: 'replyTo',
        select: '_id text type isRecall attachments sender',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      });
      if (existing) {
        return res.status(200).json({
          id: existing._id.toString(),
          _id: existing._id,
          sender: existing.sender.toString(),
          text: existing.text,
          time: existing.createdAt,
          createdAt: existing.createdAt,
          status: existing.status || 'sent',
          clientTempId: existing.clientTempId,
          reactions: existing.reactions || [],
          isPinned: !!existing.isPinned,
          replyTo: existing.replyTo ? {
            id: existing.replyTo._id.toString(),
            _id: existing.replyTo._id,
            text: existing.replyTo.isRecall ? 'Tin nhắn đã bị thu hồi' : (existing.replyTo.text || ''),
            sender: existing.replyTo.sender ? (existing.replyTo.sender._id || existing.replyTo.sender).toString() : null
          } : null,
          file: existing.attachments?.[0] ? { name: existing.attachments[0].fileName || existing.attachments[0].originalName, url: existing.attachments[0].url } : undefined
        });
      }
    }

    const conversation = await Conversation.findById(convId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy cuộc trò chuyện.',
        message: 'Không tìm thấy cuộc trò chuyện.'
      });
    }

    let attachments = [];
    if (file) {
      attachments.push({
        url: file.url || file.data || '',
        fileName: file.name,
        originalName: file.name,
        fileType: 'file',
        fileSize: file.size || 0
      });
    }

    const message = await Message.create({
      conversationId: convId,
      sender: userId,
      type: file ? 'file' : 'text',
      text: (text || '').trim(),
      clientTempId: clientTempId || null,
      replyTo: replyTo && mongoose.Types.ObjectId.isValid(replyTo) ? replyTo : null,
      status: 'sent',
      attachments
    });

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    const populated = await Message.findById(message._id).populate({
      path: 'replyTo',
      select: '_id text type isRecall attachments sender',
      populate: { path: 'sender', select: '_id username displayName avatar' }
    });

    const formattedMsg = {
      id: message._id.toString(),
      _id: message._id,
      sender: userId.toString(),
      text: message.text,
      type: message.type || 'text',
      time: message.createdAt,
      createdAt: message.createdAt,
      status: message.status || 'sent',
      clientTempId: message.clientTempId,
      reactions: message.reactions || [],
      isPinned: !!message.isPinned,
      replyTo: populated?.replyTo ? {
        id: populated.replyTo._id.toString(),
        _id: populated.replyTo._id,
        text: populated.replyTo.isRecall ? 'Tin nhắn đã bị thu hồi' : (populated.replyTo.text || ''),
        sender: populated.replyTo.sender ? (populated.replyTo.sender._id || populated.replyTo.sender).toString() : null
      } : null,
      file: file ? { name: file.name, url: file.url || file.data } : undefined
    };

    const io = req.app.get('io');
    if (io) {
      io.to(convId.toString()).emit('message', {
        conversationId: convId.toString(),
        message: formattedMsg
      });
      io.to(convId.toString()).emit('message:new', populated || message);
    }

    res.status(201).json(formattedMsg);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, message: error.message });
  }
});

module.exports = router;

