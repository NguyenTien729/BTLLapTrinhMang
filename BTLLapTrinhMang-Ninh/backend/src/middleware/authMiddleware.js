const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

/**
 * Middleware to authenticate requests via JWT
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'ptitchat_secret_key_2026'
      );

      const user = await User.findById(decoded.id || decoded.userId).select('-password');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Tài khoản không tồn tại hoặc đã bị xóa'
        });
      }

      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ hoặc đã hết hạn',
        error: error.message
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Không tìm thấy token xác thực, vui lòng đăng nhập'
    });
  }
};

/**
 * Helper / middleware to verify user is a member of the specified conversation
 */
const requireConversationMember = async (req, res, next) => {
  try {
    const conversationId =
      req.params.conversationId ||
      req.params.id ||
      req.body.conversationId;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Thiếu thông tin conversationId'
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Cuộc trò chuyện không tồn tại'
      });
    }

    const isMember = conversation.members.some(
      (m) => m.toString() === req.user._id.toString()
    );

    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là thành viên của cuộc trò chuyện này'
      });
    }

    // Attach conversation to req for reuse in controller
    req.conversation = conversation;
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Lỗi kiểm tra quyền thành viên',
      error: error.message
    });
  }
};

module.exports = {
  protect,
  requireConversationMember
};

