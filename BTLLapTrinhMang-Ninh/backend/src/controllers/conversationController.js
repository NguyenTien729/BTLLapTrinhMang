const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const User = require('../models/User');

/**
 * @route   GET /api/conversations
 * @desc    Get all conversations of the authenticated user
 * @access  Private
 */
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ members: userId })
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .populate('members', '_id username displayName email avatar isOnline lastSeen')
      .populate('admin', '_id username displayName email avatar')
      .populate({
        path: 'lastMessage',
        select: '_id text type attachments sender isRecall createdAt',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      });

    // Mask recalled last messages
    const formatted = conversations.map((conv) => {
      const convObj = conv.toObject();
      if (convObj.lastMessage && convObj.lastMessage.isRecall) {
        convObj.lastMessage.text = 'Tin nhắn đã bị thu hồi';
        convObj.lastMessage.attachments = [];
      }
      return convObj;
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi lấy danh sách cuộc trò chuyện',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/conversations
 * @desc    Create or get existing 1-1 conversation
 * @access  Private
 */
const createOrGetDirectConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const recipientId = req.body.recipientId || req.body.memberId || req.body.userId;

    if (!recipientId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp recipientId (ID người nhận)'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({
        success: false,
        message: 'recipientId không đúng định dạng ObjectId'
      });
    }

    if (recipientId.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Không thể tạo cuộc trò chuyện với chính mình'
      });
    }

    // Verify recipient exists
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({
        success: false,
        message: 'Người dùng nhận không tồn tại'
      });
    }

    // Check if direct conversation already exists
    let conversation = await Conversation.findOne({
      type: 'direct',
      members: { $all: [userId, recipientId], $size: 2 }
    })
      .populate('members', '_id username displayName email avatar isOnline lastSeen')
      .populate({
        path: 'lastMessage',
        select: '_id text type attachments sender isRecall createdAt',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      });

    if (conversation) {
      return res.status(200).json({
        success: true,
        message: 'Đã có cuộc trò chuyện từ trước',
        data: conversation
      });
    }

    // Create new direct conversation
    const newConv = new Conversation({
      type: 'direct',
      members: [userId, recipientId]
    });

    await newConv.save();

    conversation = await Conversation.findById(newConv._id).populate(
      'members',
      '_id username displayName email avatar isOnline lastSeen'
    );

    res.status(201).json({
      success: true,
      message: 'Tạo cuộc trò chuyện 1-1 thành công',
      data: conversation
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi tạo cuộc trò chuyện 1-1',
      error: error.message
    });
  }
};

/**
 * @route   POST /api/conversations/group
 * @desc    Create a new group conversation
 * @access  Private
 */
const createGroupConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, members, avatar } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên nhóm'
      });
    }

    let memberList = Array.isArray(members) ? [...members] : [];

    // Ensure creator is in the members list
    const stringMemberIds = memberList.map((m) => m.toString());
    if (!stringMemberIds.includes(userId.toString())) {
      memberList.push(userId);
    }

    // Deduplicate member IDs
    const uniqueMembers = [...new Set(memberList.map((m) => m.toString()))];

    // Group should have at least 2 members total (creator + 1 member)
    if (uniqueMembers.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Nhóm phải có ít nhất 2 thành viên (bao gồm bạn)'
      });
    }

    // Validate all user IDs
    for (const mId of uniqueMembers) {
      if (!mongoose.Types.ObjectId.isValid(mId)) {
        return res.status(400).json({
          success: false,
          message: `ID thành viên ${mId} không hợp lệ`
        });
      }
    }

    // Verify all members exist in database
    const usersCount = await User.countDocuments({
      _id: { $in: uniqueMembers }
    });
    if (usersCount !== uniqueMembers.length) {
      return res.status(400).json({
        success: false,
        message: 'Một số thành viên trong danh sách không tồn tại'
      });
    }

    const groupConversation = new Conversation({
      type: 'group',
      name: name.trim(),
      avatar: avatar || '',
      admin: userId,
      members: uniqueMembers
    });

    await groupConversation.save();

    const populatedGroup = await Conversation.findById(groupConversation._id)
      .populate('members', '_id username displayName email avatar isOnline lastSeen')
      .populate('admin', '_id username displayName email avatar');

    res.status(201).json({
      success: true,
      message: 'Tạo nhóm trò chuyện thành công',
      data: populatedGroup
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi tạo nhóm trò chuyện',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/conversations/:id
 * @desc    Update group conversation: rename, avatar, add/remove members, or leave
 * @access  Private
 */
const updateConversation = async (req, res) => {
  try {
    const userId = req.user._id;
    const conversationId = req.params.id;
    const { name, avatar, addMembers, removeMembers, removeMember, leave } = req.body;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'ID cuộc trò chuyện không hợp lệ'
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Cuộc trò chuyện không tồn tại'
      });
    }

    // Check membership
    const isMember = conversation.hasMember(userId);
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải là thành viên của cuộc trò chuyện này'
      });
    }

    // 1. Rename group
    if (name !== undefined) {
      if (conversation.type !== 'group') {
        return res.status(400).json({
          success: false,
          message: 'Chỉ có thể đổi tên cho nhóm trò chuyện'
        });
      }
      if (!name.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Tên nhóm không được để trống'
        });
      }
      conversation.name = name.trim();
    }

    // 2. Change group avatar
    if (avatar !== undefined) {
      if (conversation.type !== 'group') {
        return res.status(400).json({
          success: false,
          message: 'Chỉ có thể cập nhật ảnh đại diện cho nhóm trò chuyện'
        });
      }
      conversation.avatar = avatar;
    }

    // 3. Add members
    if (addMembers || req.body.addMember) {
      if (conversation.type !== 'group') {
        return res.status(400).json({
          success: false,
          message: 'Chỉ có thể thêm thành viên vào nhóm trò chuyện'
        });
      }

      const toAdd = Array.isArray(addMembers)
        ? addMembers
        : [req.body.addMember];

      for (const mId of toAdd) {
        if (!mongoose.Types.ObjectId.isValid(mId)) {
          return res.status(400).json({
            success: false,
            message: `ID người dùng ${mId} không hợp lệ`
          });
        }
      }

      // Check users exist
      const existingUsers = await User.find({ _id: { $in: toAdd } });
      if (existingUsers.length !== toAdd.length) {
        return res.status(400).json({
          success: false,
          message: 'Một số người dùng cần thêm không tồn tại'
        });
      }

      // Filter only members not yet in conversation
      const currentMemberStrings = conversation.members.map((m) => m.toString());
      for (const mId of toAdd) {
        if (!currentMemberStrings.includes(mId.toString())) {
          conversation.members.push(mId);
          currentMemberStrings.push(mId.toString());
        }
      }
    }

    // 4. Remove member(s) or leave group
    let toRemove = [];
    if (removeMembers) {
      toRemove = Array.isArray(removeMembers) ? removeMembers : [removeMembers];
    } else if (removeMember) {
      toRemove = [removeMember];
    } else if (leave) {
      toRemove = [userId.toString()];
    }

    if (toRemove.length > 0) {
      if (conversation.type !== 'group') {
        return res.status(400).json({
          success: false,
          message: 'Chỉ có thể xóa thành viên khỏi nhóm trò chuyện'
        });
      }

      const isAdmin =
        conversation.admin &&
        conversation.admin.toString() === userId.toString();

      for (const mId of toRemove) {
        const targetIdStr = mId.toString();

        // If not removing oneself, only group admin can remove other members
        if (targetIdStr !== userId.toString() && !isAdmin) {
          return res.status(403).json({
            success: false,
            message: 'Chỉ quản trị viên nhóm mới có quyền xóa thành viên khác'
          });
        }

        conversation.members = conversation.members.filter(
          (m) => m.toString() !== targetIdStr
        );

        // If the removed member was the admin and others remain, reassign admin
        if (
          conversation.admin &&
          conversation.admin.toString() === targetIdStr &&
          conversation.members.length > 0
        ) {
          conversation.admin = conversation.members[0];
        }
      }
    }

    await conversation.save();

    const updated = await Conversation.findById(conversation._id)
      .populate('members', '_id username displayName email avatar isOnline lastSeen')
      .populate('admin', '_id username displayName email avatar')
      .populate({
        path: 'lastMessage',
        select: '_id text type attachments sender isRecall createdAt',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      });

    res.status(200).json({
      success: true,
      message: 'Cập nhật cuộc trò chuyện thành công',
      data: updated
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật cuộc trò chuyện',
      error: error.message
    });
  }
};

module.exports = {
  getConversations,
  createOrGetDirectConversation,
  createGroupConversation,
  updateConversation
};

