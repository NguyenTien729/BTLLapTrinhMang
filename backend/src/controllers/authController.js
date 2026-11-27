const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

function issueToken(user) {
  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: user.id, expiresIn: '1d', algorithm: 'HS256', issuer: 'ptitchat', audience: 'ptitchat-client',
  });
}

exports.register = async (req, res) => {
  const { username, email, password } = req.body || {};
  if (typeof username !== 'string' || username.trim().length < 2 || username.trim().length > 50 ||
      typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Tên phải có 2–50 ký tự, email hợp lệ và mật khẩu từ 8 ký tự, tối đa 72 byte.' });
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (await User.exists({ email: normalizedEmail })) return res.status(409).json({ message: 'Email đã được sử dụng.' });
  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ username: username.trim(), email: normalizedEmail, passwordHash });
  req.app.get('io')?.emit('user:new', user.toJSON());
  res.status(201).json({ token: issueToken(user), user });
};

exports.login = async (req, res) => {
  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
    return res.status(400).json({ message: 'Vui lòng nhập email và mật khẩu hợp lệ.' });
  }
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng.' });
  }
  user.lastSeen = new Date();
  await user.save();
  res.json({ token: issueToken(user), user });
};

exports.getMe = (req, res) => res.json({ success: true, data: req.user });
