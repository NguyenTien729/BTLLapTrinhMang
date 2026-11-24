const User = require('../models/User');

/**
 * @route   GET /api/users/me
 * @desc    Lấy thông tin cá nhân
 * @access  Private
 */
const getMe = (req, res) => {
  const userObj = req.user.toObject ? req.user.toObject() : { ...req.user };
  userObj.id = req.user._id.toString();
  userObj._id = req.user._id;
  userObj.name = req.user.displayName || req.user.username;
  userObj.displayName = req.user.displayName || req.user.username;
  delete userObj.password;
  delete userObj.passwordHash;

  res.status(200).json({
    success: true,
    user: userObj,
    data: userObj
  });
};

/**
 * @route   PATCH /api/users/me (hoặc PUT)
 * @desc    Cập nhật thông tin cá nhân (name, displayName, username, email, studentId, avatar, bio)
 * @access  Private
 */
const updateMe = async (req, res) => {
  try {
    const body = req.body || {};
    const allowed = ['username', 'displayName', 'name', 'avatar', 'bio', 'studentId', 'email'];
    const fields = Object.keys(body).filter((key) => allowed.includes(key));

    if (!fields.length) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp thông tin cần cập nhật.'
      });
    }

    const name = body.displayName !== undefined ? body.displayName : body.name;
    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Họ và tên không được để trống.'
        });
      }
      req.user.displayName = name.trim();
    }

    if (body.studentId !== undefined) {
      req.user.studentId = typeof body.studentId === 'string' ? body.studentId.trim() : '';
    }

    if (body.email !== undefined && typeof body.email === 'string') {
      const emailTrim = body.email.trim().toLowerCase();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailTrim && !emailRegex.test(emailTrim)) {
        return res.status(400).json({
          success: false,
          message: 'Email không hợp lệ.'
        });
      }
      if (emailTrim && emailTrim !== req.user.email) {
        const exist = await User.findOne({ email: emailTrim, _id: { $ne: req.user._id } });
        if (exist) {
          return res.status(409).json({
            success: false,
            message: 'Email này đã được sử dụng bởi tài khoản khác.'
          });
        }
        req.user.email = emailTrim;
      }
    }

    if (body.bio !== undefined) {
      req.user.bio = typeof body.bio === 'string' ? body.bio.trim() : '';
    }

    if (body.avatar !== undefined) {
      if (typeof body.avatar === 'string' && body.avatar.startsWith('http')) {
        try {
          const url = new URL(body.avatar);
          if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
        } catch {
          return res.status(400).json({
            success: false,
            message: 'Avatar phải là URL HTTP/HTTPS hợp lệ hoặc đường dẫn tệp tải lên.'
          });
        }
      }
      req.user.avatar = typeof body.avatar === 'string' ? body.avatar.trim() : '';
    }

    if (body.username !== undefined && typeof body.username === 'string') {
      const uTrim = body.username.trim().toLowerCase();
      if (uTrim.length < 2 || uTrim.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Username phải từ 2–50 ký tự.'
        });
      }
      if (uTrim !== req.user.username) {
        const exist = await User.findOne({ username: uTrim, _id: { $ne: req.user._id } });
        if (exist) {
          return res.status(409).json({
            success: false,
            message: 'Username này đã được sử dụng bởi tài khoản khác.'
          });
        }
        req.user.username = uTrim;
      }
    }

    await req.user.save();

    const userObj = req.user.toObject ? req.user.toObject() : { ...req.user };
    userObj.id = req.user._id.toString();
    userObj._id = req.user._id;
    userObj.name = req.user.displayName || req.user.username;
    userObj.displayName = req.user.displayName || req.user.username;
    userObj.online = !!req.user.isOnline;
    delete userObj.password;
    delete userObj.passwordHash;

    const io = req.app?.get('io');
    if (io) {
      io.emit('profile', userObj);
      io.emit('user', userObj);
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      user: userObj,
      data: userObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật thông tin: ' + error.message
    });
  }
};

/**
 * @route   GET /api/users/search?q=
 * @desc    Tìm kiếm người dùng theo từ khóa
 * @access  Private
 */
const searchUsers = async (req, res) => {
  try {
    const query = req.query.q || req.query.search;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập từ khóa tìm kiếm.'
      });
    }

    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const users = await User.find({
      _id: { $ne: req.user._id },
      $or: [{ username: regex }, { displayName: regex }, { email: regex }]
    })
      .select('_id username displayName email avatar bio studentId isOnline lastSeen')
      .sort({ username: 1 })
      .limit(20);

    res.status(200).json({
      success: true,
      count: users.length,
      users,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi tìm kiếm người dùng: ' + error.message
    });
  }
};

/**
 * @route   GET /api/users
 * @desc    Lấy danh sách người dùng để tạo hội thoại
 * @access  Private
 */
const getUsers = async (req, res) => {
  try {
    const { search, q, all, includeSelf } = req.query;
    const query = (all === 'true' || all === '1' || includeSelf === 'true' || includeSelf === '1')
      ? {}
      : { _id: { $ne: req.user._id } };

    const keyword = search || q;
    if (keyword && keyword.trim()) {
      const escaped = keyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ username: regex }, { displayName: regex }, { email: regex }];
    }

    const users = await User.find(query)
      .select('_id username displayName email avatar bio studentId isOnline lastSeen')
      .limit(50);

    const formattedUsers = users.map((u) => {
      const uObj = u.toObject ? u.toObject() : { ...u };
      return {
        ...uObj,
        id: u._id.toString(),
        _id: u._id,
        name: u.displayName || u.username,
        displayName: u.displayName || u.username,
        online: !!u.isOnline,
        color: '#b52740'
      };
    });

    res.status(200).json({
      success: true,
      count: formattedUsers.length,
      users: formattedUsers,
      data: formattedUsers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách người dùng: ' + error.message
    });
  }
};

module.exports = {
  getMe,
  updateMe,
  searchUsers,
  getUsers
};
