const User = require('../models/User');

<<<<<<< HEAD
exports.getMe = (req, res) => res.json({ user: req.user });

exports.updateMe = async (req, res) => {
  const body = req.body || {};
  const fields = Object.keys(body);
  if (!fields.length || fields.some(key => !['username', 'displayName', 'studentId', 'avatar', 'bio'].includes(key))) {
    return res.status(400).json({ message: 'Chỉ được cập nhật username, avatar và bio.' });
  }
  for (const key of fields) {
    if (typeof body[key] !== 'string') return res.status(400).json({ message: `${key} phải là chuỗi.` });
  }
  if (body.avatar) {
    try {
      if (/^\/uploads\/[a-zA-Z0-9_.-]+\.(png|jpe?g|gif|webp|bmp)$/i.test(body.avatar)) { /* Local uploaded image. */ }
      else {
      const url = new URL(body.avatar);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      }
    } catch { return res.status(400).json({ message: 'Avatar phải là URL HTTP/HTTPS hợp lệ.' }); }
  }
  for (const key of fields) req.user[key] = body[key].trim();
  await req.user.save();
  req.app.get('io')?.emit('profile:updated', req.user.toJSON());
  res.json({ user: req.user });
=======
/**
 * @route   GET /api/users/me
 * @desc    Lấy thông tin cá nhân
 * @access  Private
 */
const getMe = (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
    data: req.user
  });
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
};

/**
 * @route   PATCH /api/users/me (hoặc PUT)
 * @desc    Cập nhật thông tin cá nhân (username, displayName, avatar, bio)
 * @access  Private
 */
const updateMe = async (req, res) => {
  try {
    const body = req.body || {};
    const allowed = ['username', 'displayName', 'avatar', 'bio'];
    const fields = Object.keys(body).filter((key) => allowed.includes(key));

    if (!fields.length) {
      return res.status(400).json({
        success: false,
        message: 'Chỉ được cập nhật username, displayName, avatar và bio.'
      });
    }

    if (body.username && (body.username.trim().length < 2 || body.username.trim().length > 50)) {
      return res.status(400).json({
        success: false,
        message: 'Username phải từ 2–50 ký tự.'
      });
    }

    if (body.avatar && typeof body.avatar === 'string' && body.avatar.startsWith('http')) {
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

    for (const key of fields) {
      if (typeof body[key] === 'string') {
        req.user[key] = body[key].trim();
      }
    }

    await req.user.save();

    res.status(200).json({
      success: true,
      message: 'Cập nhật thông tin thành công',
      user: req.user,
      data: req.user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật thông tin: ' + error.message
    });
  }
<<<<<<< HEAD
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [{ username: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }, { displayName: { $regex: escaped, $options: 'i' } }],
  }).select('_id username displayName email avatar bio studentId isOnline lastSeen').sort({ username: 1, _id: 1 }).limit(20);
  res.json({ users });
=======
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
      .select('_id username displayName email avatar bio isOnline lastSeen')
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
      .select('_id username displayName email avatar bio isOnline lastSeen')
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
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
};

/**
 * @route   GET /api/users
 * @desc    Search and list users (for creating 1-1 or group conversations)
 * @access  Private
 */
const getUsers = async (req, res) => {
  try {
    const { search } = req.query;
    const query = { _id: { $ne: req.user._id } };

    if (search && search.trim()) {
      const escaped = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      query.$or = [{ username: regex }, { displayName: regex }, { email: regex }];
    }

    const users = await User.find(query)
      .select('_id username displayName email avatar isOnline lastSeen')
      .limit(50);

    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách người dùng',
      error: error.message
    });
  }
};


exports.getUsers = getUsers;
