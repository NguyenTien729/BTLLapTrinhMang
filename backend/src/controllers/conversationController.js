const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
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
        path: 'pinnedMessage',
        select: '_id text type attachments sender createdAt isRecall isPinned reactions',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      })
      .populate({
        path: 'lastMessage',
        select: '_id text type attachments sender isRecall createdAt',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      });

    // Populate recent messages for each conversation so frontend gets full history
    const convIds = conversations.map((c) => c._id);
    const allMessages = await Message.find({ conversationId: { $in: convIds } })
      .sort({ createdAt: 1 })
      .limit(300)
      .populate({
        path: 'replyTo',
        select: '_id text type isRecall attachments sender',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      });

    const msgsByConv = {};
    for (const m of allMessages) {
      const cid = m.conversationId.toString();
      if (!msgsByConv[cid]) msgsByConv[cid] = [];
      msgsByConv[cid].push({
        id: m._id.toString(),
        _id: m._id,
        sender: (m.sender?._id || m.sender).toString(),
        text: m.isRecall ? 'Tin nhắn đã bị thu hồi' : (m.text || ''),
        type: m.type || 'text',
        time: m.createdAt,
        createdAt: m.createdAt,
        status: m.status || 'sent',
        readBy: m.readBy || [],
        deliveredTo: m.deliveredTo || [],
        reactions: m.reactions || [],
        isPinned: !!m.isPinned,
        pinnedAt: m.pinnedAt || null,
        pinnedBy: m.pinnedBy || null,
        replyTo: m.replyTo ? {
          id: m.replyTo._id.toString(),
          _id: m.replyTo._id,
          text: m.replyTo.isRecall ? 'Tin nhắn đã bị thu hồi' : (m.replyTo.text || ''),
          sender: m.replyTo.sender ? (m.replyTo.sender._id || m.replyTo.sender).toString() : null
        } : null,
        file: m.attachments?.[0]
          ? {
              name: m.attachments[0].originalName || m.attachments[0].fileName,
              url: m.attachments[0].url
            }
          : undefined
      });
    }

    // Mask recalled last messages and format fields for both REST and UI
    const formatted = conversations.map((conv) => {
      const convObj = conv.toObject();
      const cid = convObj._id.toString();
      convObj.id = cid;
      convObj.members = convObj.members.map((m) => (m._id ? m._id.toString() : m.toString()));
      convObj.messages = msgsByConv[cid] || [];
      convObj.unread = 0;
      convObj.color = '#b52740';

      if (convObj.lastMessage && convObj.lastMessage.isRecall) {
        convObj.lastMessage.text = 'Tin nhắn đã bị thu hồi';
        convObj.lastMessage.attachments = [];
      }
      if (convObj.pinnedMessage && convObj.pinnedMessage.isRecall) {
        convObj.pinnedMessage.text = 'Tin nhắn đã bị thu hồi';
        convObj.pinnedMessage.attachments = [];
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
 * @desc    Create or get existing 1-1 conversation (or group if type === 'group')
 * @access  Private
 */
const createOrGetDirectConversation = async (req, res) => {
  try {
    if (req.body.type === 'group') {
      return createGroupConversation(req, res);
    }

    const userId = req.user._id;
    const recipientId =
      req.body.recipientId ||
      req.body.memberId ||
      req.body.userId ||
      (Array.isArray(req.body.members)
        ? req.body.members.find((m) => m.toString() !== userId.toString())
        : req.body.members);

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
    const { name, members, avatar, description } = req.body;

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
      description: (description && typeof description === 'string') ? description.trim() : '',
      avatar: avatar || '',
      admin: userId,
      members: uniqueMembers
    });

    await groupConversation.save();

    const populatedGroup = await Conversation.findById(groupConversation._id)
      .populate('members', '_id username displayName email avatar isOnline lastSeen')
      .populate('admin', '_id username displayName email avatar');

    const convObj = populatedGroup.toObject();
    const cid = convObj._id.toString();
    convObj.id = cid;
    convObj.members = convObj.members.map((m) => (m._id ? m._id.toString() : m.toString()));
    convObj.messages = [];
    convObj.unread = 0;
    convObj.color = '#b52740';

    const io = req.app?.get('io');
    if (io) {
      io.to(cid).emit('conversation', convObj);
      io.emit('conversation', convObj);
    }

    res.status(201).json({
      success: true,
      message: 'Tạo nhóm trò chuyện thành công',
      data: convObj
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
    const { name, avatar, description, addMembers, removeMembers, removeMember, leave } = req.body;

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

    const systemMessages = [];
    const actorName = req.user.displayName || req.user.username;

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
      const newName = name.trim();
      if (conversation.name !== newName) {
        conversation.name = newName;
        const sysMsg = new Message({
          conversationId: conversation._id,
          sender: userId,
          type: 'system',
          text: `${actorName} đã đổi tên nhóm thành "${newName}"`
        });
        await sysMsg.save();
        systemMessages.push(sysMsg);
      }
    }

    // 1.1 Update group description
    if (description !== undefined) {
      if (conversation.type !== 'group') {
        return res.status(400).json({
          success: false,
          message: 'Chỉ có thể cập nhật giới thiệu cho nhóm trò chuyện'
        });
      }
      const newDesc = typeof description === 'string' ? description.trim() : '';
      if (conversation.description !== newDesc) {
        conversation.description = newDesc;
        const sysMsg = new Message({
          conversationId: conversation._id,
          sender: userId,
          type: 'system',
          text: `${actorName} đã cập nhật mô tả nhóm`
        });
        await sysMsg.save();
        systemMessages.push(sysMsg);
      }
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
      const addedNames = [];
      const currentMemberStrings = conversation.members.map((m) => m.toString());
      for (const mId of toAdd) {
        if (!currentMemberStrings.includes(mId.toString())) {
          conversation.members.push(mId);
          currentMemberStrings.push(mId.toString());
          const u = existingUsers.find((x) => x._id.toString() === mId.toString());
          if (u) addedNames.push(u.displayName || u.username);
        }
      }

      if (addedNames.length > 0) {
        const sysMsg = new Message({
          conversationId: conversation._id,
          sender: userId,
          type: 'system',
          text: `${actorName} đã thêm ${addedNames.join(', ')} vào nhóm`
        });
        await sysMsg.save();
        systemMessages.push(sysMsg);
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

        if (targetIdStr === userId.toString()) {
          const sysMsg = new Message({
            conversationId: conversation._id,
            sender: userId,
            type: 'system',
            text: `${actorName} đã rời khỏi nhóm`
          });
          await sysMsg.save();
          systemMessages.push(sysMsg);
        } else {
          const removedUser = await User.findById(targetIdStr);
          const rName = removedUser ? (removedUser.displayName || removedUser.username) : 'thành viên';
          const sysMsg = new Message({
            conversationId: conversation._id,
            sender: userId,
            type: 'system',
            text: `${actorName} đã xóa ${rName} khỏi nhóm`
          });
          await sysMsg.save();
          systemMessages.push(sysMsg);
        }

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

    if (systemMessages.length > 0) {
      const lastSys = systemMessages[systemMessages.length - 1];
      conversation.lastMessage = lastSys._id;
      conversation.lastMessageAt = lastSys.createdAt;
    }

    await conversation.save();

    const updated = await Conversation.findById(conversation._id)
      .populate('members', '_id username displayName email avatar isOnline lastSeen')
      .populate('admin', '_id username displayName email avatar')
      .populate({
        path: 'pinnedMessage',
        select: '_id text type attachments sender createdAt isRecall isPinned reactions',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      })
      .populate({
        path: 'lastMessage',
        select: '_id text type attachments sender isRecall createdAt',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      });

    const convObj = updated.toObject();
    const cid = convObj._id.toString();
    convObj.id = cid;
    convObj.members = convObj.members.map((m) => (m._id ? m._id.toString() : m.toString()));
    convObj.unread = 0;
    convObj.color = '#b52740';

    if (convObj.lastMessage && convObj.lastMessage.isRecall) {
      convObj.lastMessage.text = 'Tin nhắn đã bị thu hồi';
      convObj.lastMessage.attachments = [];
    }
    if (convObj.pinnedMessage && convObj.pinnedMessage.isRecall) {
      convObj.pinnedMessage.text = 'Tin nhắn đã bị thu hồi';
      convObj.pinnedMessage.attachments = [];
    }

    const io = req.app?.get('io');
    if (io) {
      for (const sm of systemMessages) {
        const formattedSm = {
          id: sm._id.toString(),
          _id: sm._id,
          sender: userId.toString(),
          type: 'system',
          text: sm.text,
          time: sm.createdAt,
          createdAt: sm.createdAt,
          status: 'sent',
          reactions: []
        };
        io.to(cid).emit('message', {
          conversationId: cid,
          message: formattedSm
        });
        io.to(cid).emit('message:new', sm);
      }
      io.to(cid).emit('conversation', convObj);
      io.emit('conversation', convObj);
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật cuộc trò chuyện thành công',
      data: convObj
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi cập nhật cuộc trò chuyện',
      error: error.message
    });
  }
};

/**
 * @route   PATCH /api/conversations/:id/pin
 * @desc    Pin or unpin message in conversation
 * @access  Private
 */
const pinConversationMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { messageId } = req.body || {};
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'ID cuộc trò chuyện không hợp lệ'
      });
    }

    const conversation = await Conversation.findById(id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Cuộc trò chuyện không tồn tại'
      });
    }

    if (!conversation.hasMember(userId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không phải thành viên của cuộc trò chuyện này'
      });
    }

    let pinnedMsg = null;
    if (messageId) {
      if (!mongoose.Types.ObjectId.isValid(messageId)) {
        return res.status(400).json({
          success: false,
          message: 'ID tin nhắn không hợp lệ'
        });
      }

      const msg = await Message.findOne({ _id: messageId, conversationId: id });
      if (!msg) {
        return res.status(404).json({
          success: false,
          message: 'Tin nhắn không tồn tại trong cuộc trò chuyện này'
        });
      }

      // Unpin previous pinned message if any
      if (conversation.pinnedMessage) {
        await Message.findByIdAndUpdate(conversation.pinnedMessage, {
          isPinned: false,
          pinnedAt: null,
          pinnedBy: null
        });
      }

      msg.isPinned = true;
      msg.pinnedAt = new Date();
      msg.pinnedBy = userId;
      await msg.save();

      conversation.pinnedMessage = msg._id;
      await conversation.save();

      const populatedMsg = await Message.findById(msg._id).populate('sender', '_id username displayName avatar');
      pinnedMsg = populatedMsg.toClientJSON ? populatedMsg.toClientJSON() : populatedMsg;
    } else {
      // Unpin
      if (conversation.pinnedMessage) {
        await Message.findByIdAndUpdate(conversation.pinnedMessage, {
          isPinned: false,
          pinnedAt: null,
          pinnedBy: null
        });
      }
      conversation.pinnedMessage = null;
      await conversation.save();
    }

    const payload = {
      conversationId: id.toString(),
      pinnedMessage: pinnedMsg
    };

    const io = req.app?.get('io');
    if (io) {
      io.to(id.toString()).emit('conversation:pinned', payload);
    }

    res.status(200).json({
      success: true,
      message: messageId ? 'Đã ghim tin nhắn' : 'Đã bỏ ghim tin nhắn',
      data: payload
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Lỗi ghim tin nhắn: ' + error.message
    });
  }
};

module.exports = {
  getConversations,
  createOrGetDirectConversation,
  createGroupConversation,
  updateConversation,
  pinConversationMessage
};

