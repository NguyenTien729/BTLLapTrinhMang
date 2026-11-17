const User = require('../models/User');

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

module.exports = {
  getUsers
};

