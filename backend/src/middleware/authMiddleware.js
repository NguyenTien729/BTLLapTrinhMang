const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

/**
 * Middleware xác thực JWT token
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
        process.env.JWT_SECRET || 'ptitchat_super_secret_jwt_key_2026_ptit_telecom'
      );

      const userId = decoded.id || decoded.sub || decoded.userId;

      if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(401).json({
          success: false,
          message: 'Token không hợp lệ.'
        });
      }

      const user = await User.findById(userId).select('-password -passwordHash');
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Tài khoản không tồn tại hoặc đã bị xóa.'
        });
      }

      req.user = user;
      return next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ hoặc đã hết hạn.',
        error: error.message
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Không tìm thấy token xác thực, vui lòng đăng nhập.'
    });
  }
};

<<<<<<< HEAD
const Conversation = require('../models/Conversation');
=======
/**
 * Middleware kiểm tra quyền thành viên cuộc trò chuyện
 */
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
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

<<<<<<< HEAD
    const isMember = conversation.members.some(
      (m) => m.toString() === req.user._id.toString()
    );

=======
    const isMember = conversation.hasMember(req.user._id);
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là thành viên của cuộc trò chuyện này'
      });
    }

<<<<<<< HEAD
    // Attach conversation to req for reuse in controller
=======
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
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

<<<<<<< HEAD

module.exports.protect = module.exports;
module.exports.requireConversationMember = requireConversationMember;
=======
// Cho phép cả require('...').protect và require('...') trực tiếp
protect.protect = protect;
protect.requireConversationMember = requireConversationMember;

module.exports = protect;
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
