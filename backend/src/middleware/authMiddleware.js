const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const User = require('../models/User');

module.exports = async (req, res, next) => {
  const match = /^Bearer (\S+)$/i.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({ message: 'Bạn cần đăng nhập.' });
  let payload;
  try {
    payload = jwt.verify(match[1], process.env.JWT_SECRET, {
      algorithms: ['HS256'], issuer: 'ptitchat', audience: 'ptitchat-client',
    });
  } catch {
    return res.status(401).json({ message: 'Token không hợp lệ hoặc đã hết hạn.' });
  }
  if (!mongoose.isObjectIdOrHexString(payload.sub)) return res.status(401).json({ message: 'Token không hợp lệ.' });
  try {
    req.user = await User.findById(payload.sub);
    if (!req.user) return res.status(401).json({ message: 'Tài khoản không còn tồn tại.' });
    next();
  } catch (error) { next(error); }
};

const Conversation = require('../models/Conversation');
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


module.exports.protect = module.exports;
module.exports.requireConversationMember = requireConversationMember;
