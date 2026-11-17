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
