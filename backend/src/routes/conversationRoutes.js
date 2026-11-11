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

router.patch('/:id', updateConversation);

module.exports = router;

