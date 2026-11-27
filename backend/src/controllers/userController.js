const User = require('../models/User');

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
};

exports.searchUsers = async (req, res) => {
  const query = req.query.q;
  if (typeof query !== 'string' || !query.trim() || query.trim().length > 100) {
    return res.status(400).json({ message: 'Từ khóa tìm kiếm phải có 1–100 ký tự.' });
  }
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const users = await User.find({
    _id: { $ne: req.user._id },
    $or: [{ username: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }, { displayName: { $regex: escaped, $options: 'i' } }],
  }).select('_id username displayName email avatar bio studentId isOnline lastSeen').sort({ username: 1, _id: 1 }).limit(20);
  res.json({ users });
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
