const express = require('express');
const router = express.Router();
const {
  getMessages,
  sendMessage,
  editMessage,
  recallMessage,
  markMessagesSeen,
  searchMessages,
  reactMessage
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

// All message routes require JWT authentication
router.use(protect);

// Search messages (defined before :conversationId or :id to avoid route collision)
router.get('/search', searchMessages);

// Send message
router.post('/', sendMessage);

// Get conversation messages by conversationId
router.get('/:conversationId', getMessages);

// Mark conversation messages as seen
router.patch('/:conversationId/seen', markMessagesSeen);

// Edit message by message id
router.patch('/:id', editMessage);

// React to message by message id
router.patch('/:id/react', reactMessage);

// Soft recall message by message id
router.delete('/:id', recallMessage);

module.exports = router;

