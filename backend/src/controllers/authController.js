const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const issueToken = (user) => {
  const secret = process.env.JWT_SECRET || 'ptitchat_super_secret_jwt_key_2026_ptit_telecom';
  // Payload chứa cả id và sub để tương thích hoàn hảo mọi middleware
  return jwt.sign(
    { id: user.id, userId: user.id },
    secret,
    {
      subject: user.id,
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Đăng ký tài khoản mới
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { username, email, password, displayName, avatar, bio } = req.body || {};

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp username, email và password.'
      });
    }

    if (username.trim().length < 2 || username.trim().length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Tên người dùng phải có từ 2–50 ký tự.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Email không hợp lệ.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu phải có ít nhất 6 ký tự.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username hoặc email đã được sử dụng.'
      });
    }

    const user = new User({
      username: normalizedUsername,
      email: normalizedEmail,
      password,
      displayName: (displayName && displayName.trim()) || normalizedUsername,
      avatar: avatar || '',
      bio: bio || ''
    });

    await user.save();

    const token = issueToken(user);
    const userObj = user.toObject ? user.toObject() : { ...user };
    userObj.id = user._id.toString();
    userObj.name = user.displayName || user.username;
    userObj.online = true;
    delete userObj.password;
    delete userObj.passwordHash;

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      token,
      user: userObj,
      data: { user: userObj, token }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi đăng ký tài khoản: ' + error.message
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Đăng nhập lấy JWT token
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { account, email, username, password } = req.body || {};
    const identifier = (account || email || username || '').trim().toLowerCase();

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tài khoản (username hoặc email) và mật khẩu.'
      });
    }

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    }).select('+password +passwordHash');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác.'
      });
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = issueToken(user);
    const userObj = user.toObject ? user.toObject() : { ...user };
    userObj.id = user._id.toString();
    userObj.name = user.displayName || user.username;
    userObj.online = true;
    delete userObj.password;
    delete userObj.passwordHash;

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: userObj,
      data: { user: userObj, token }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi đăng nhập: ' + error.message
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Lấy thông tin tài khoản đang đăng nhập
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      user,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin người dùng: ' + error.message
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  issueToken
};
