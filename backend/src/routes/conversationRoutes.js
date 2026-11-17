const express = require('express');
const router = express.Router();
const {
  getConversations,
  createOrGetDirectConversation,
  createGroupConversation,
  updateConversation
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

// Send message to conversation (Son's frontend endpoint)
router.post('/:id/messages', async (req, res) => {
  try {
    const convId = req.params.id;
    const userId = req.user._id;
    const { text = '', file } = req.body || {};

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
      attachments
    });

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    const formattedMsg = {
      id: message._id.toString(),
      _id: message._id,
      sender: userId.toString(),
      text: message.text,
      time: message.createdAt,
      createdAt: message.createdAt,
      file: file ? { name: file.name, url: file.url || file.data } : undefined
    };

    const io = req.app.get('io');
    if (io) {
      io.to(convId.toString()).emit('message', {
        conversationId: convId.toString(),
        message: formattedMsg
      });
      io.to(convId.toString()).emit('message:new', message);
    }

    res.status(201).json(formattedMsg);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, message: error.message });
  }
});

module.exports = router;

