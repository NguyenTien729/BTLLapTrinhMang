const User = require('../models/User');

exports.getMe = (req, res) => res.json({ user: req.user });

exports.updateMe = async (req, res) => {
  const body = req.body || {};
  const fields = Object.keys(body);
  if (!fields.length || fields.some(key => !['username', 'avatar', 'bio'].includes(key))) {
    return res.status(400).json({ message: 'Chỉ được cập nhật username, avatar và bio.' });
  }
  for (const key of fields) {
    if (typeof body[key] !== 'string') return res.status(400).json({ message: `${key} phải là chuỗi.` });
  }
  if (body.avatar) {
    try {
      const url = new URL(body.avatar);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch { return res.status(400).json({ message: 'Avatar phải là URL HTTP/HTTPS hợp lệ.' }); }
  }
  for (const key of fields) req.user[key] = body[key].trim();
  await req.user.save();
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
    $or: [{ username: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }],
  }).select('_id username email avatar bio lastSeen').sort({ username: 1, _id: 1 }).limit(20);
  res.json({ users });
};
