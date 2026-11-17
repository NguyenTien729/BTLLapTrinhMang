const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'ptitchat_secret_key_2026',
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '7d'
    }
  );
};

/**
 * @route   POST /api/auth/register
 * @desc    Register a new user
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { username, email, password, displayName, avatar } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp username, email và password'
      });
    }

    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Username hoặc email đã tồn tại'
      });
    }

    const user = new User({
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      password,
      displayName: displayName || username,
      avatar: avatar || ''
    });

    await user.save();

    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'Đăng ký tài khoản thành công',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi đăng ký tài khoản',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/auth/login
 * @desc    Login user & get token
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { account, email, username, password } = req.body;
    const loginIdentifier = account || email || username;

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tài khoản (username hoặc email) và mật khẩu'
      });
    }

    const user = await User.findOne({
      $or: [
        { email: loginIdentifier.toLowerCase().trim() },
        { username: loginIdentifier.toLowerCase().trim() }
      ]
    }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác'
      });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Tài khoản hoặc mật khẩu không chính xác'
      });
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Đăng nhập thành công',
      data: {
        user,
        token
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi đăng nhập',
      error: error.message
    });
  }
};

/**
 * @route   GET /api/auth/me
 * @desc    Get current logged in user profile
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy thông tin người dùng',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  getMe
};

