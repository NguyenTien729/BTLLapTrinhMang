<<<<<<< HEAD
const mongoose=require('mongoose');
const Conversation=require('../models/Conversation');
const Message=require('../models/Message');
const User=require('../models/User');
const {publishConversation}=require('../socket/events');
const {requireMember}=require('../services/messageService');
const fail=(code,message)=>{throw Object.assign(new Error(message),{statusCode:code});};
const handle=work=>async(req,res,next)=>{try{req.body ||= {};await work(req,res);}catch(e){next(e);}};
const populate=q=>q.populate('members','username displayName email avatar bio studentId isOnline lastSeen')
  .populate('admin','username displayName').populate({path:'lastMessage',populate:{path:'sender',select:'username displayName'}});
async function result(id){const c=await populate(Conversation.findById(id));const obj=c.toObject();if(obj.lastMessage?.isRecall){obj.lastMessage.text='Tin nhắn đã bị thu hồi';obj.lastMessage.attachments=[];}return obj;}
async function validMembers(ids){
  if(!Array.isArray(ids)||ids.length>100||ids.some(id=>!mongoose.isObjectIdOrHexString(id)))fail(400,'Danh sách thành viên không hợp lệ.');
  const unique=[...new Set(ids.map(String))];
  if(await User.countDocuments({_id:{$in:unique}})!==unique.length)fail(400,'Thành viên không tồn tại.');
  return unique;
}
exports.getConversations=handle(async(req,res)=>{
  const cs=await Conversation.find({members:req.user._id}).sort({lastMessageAt:-1});
  const data=await Promise.all(cs.map(async c=>({...await result(c._id),unread:await Message.countDocuments({
    conversationId:c._id,sender:{$ne:req.user._id},'readBy.user':{$ne:req.user._id},
  })})));
  res.json({success:true,data});
});
exports.createOrGetDirectConversation=handle(async(req,res)=>{
  const recipientId=req.body.recipientId;
  if(!mongoose.isObjectIdOrHexString(recipientId)||String(recipientId)===String(req.user._id))fail(400,'Người nhận không hợp lệ.');
  await validMembers([recipientId]);
  let c=await Conversation.findDirectConversation(req.user._id,recipientId);
  const created=!c;
  if(!c)c=await Conversation.create({type:'direct',members:[req.user._id,recipientId]});
  const data=await result(c._id);publishConversation(req.app.get('io'),data);
  res.status(created?201:200).json({success:true,data});
});
exports.createGroupConversation=handle(async(req,res)=>{
  const {name,avatar=''}=req.body;
  if(typeof name!=='string'||!name.trim()||name.trim().length>60)fail(400,'Tên nhóm cần có 1–60 ký tự.');
  if(avatar&&!(typeof avatar==='string'&&/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(avatar)))fail(400,'Ảnh nhóm không hợp lệ.');
  const members=await validMembers([...(Array.isArray(req.body.members)?req.body.members:[]),String(req.user._id)]);
  if(members.length<3)fail(400,'Nhóm cần ít nhất 3 thành viên.');
  const c=await Conversation.create({type:'group',name:name.trim(),avatar,members,admin:req.user._id});
  const data=await result(c._id);publishConversation(req.app.get('io'),data);
  res.status(201).json({success:true,data});
});
exports.updateConversation=handle(async(req,res)=>{
  const c=await requireMember(req.params.id,req.user._id),body=req.body||{},previous=[...c.members];
  if(c.type!=='group')fail(400,'Chỉ có thể chỉnh sửa nhóm.');
  const allowed=['name','description','avatar','addMembers','removeMembers','leave'];
  if(!Object.keys(body).length||Object.keys(body).some(k=>!allowed.includes(k)))fail(400,'Thông tin nhóm không hợp lệ.');
  const admin=String(c.admin)===String(req.user._id);
  if((body.addMembers||body.removeMembers)&&!admin)fail(403,'Chỉ quản trị viên được thay đổi thành viên.');
  if(body.name!==undefined){if(typeof body.name!=='string'||!body.name.trim()||body.name.length>60)fail(400,'Tên nhóm cần có 1–60 ký tự.');c.name=body.name.trim();}
  if(body.description!==undefined){if(typeof body.description!=='string'||body.description.length>240)fail(400,'Mô tả tối đa 240 ký tự.');c.description=body.description.trim();}
  if(body.avatar!==undefined){if(typeof body.avatar!=='string'||(body.avatar&&!/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(body.avatar)))fail(400,'Ảnh nhóm không hợp lệ.');c.avatar=body.avatar;}
  if(body.addMembers){const added=await validMembers(body.addMembers);c.members=[...new Set([...c.members.map(String),...added])];}
  let removed=body.removeMembers?await validMembers(body.removeMembers):[];
  if(body.leave===true)removed.push(String(req.user._id));
  c.members=c.members.filter(id=>!removed.includes(String(id)));
  if(c.members.length>100)fail(400,'Nhóm tối đa 100 thành viên.');
  if(!c.members.some(id=>String(id)===String(c.admin)))c.admin=c.members[0]||null;
  await c.save();const data=await result(c._id);publishConversation(req.app.get('io'),data,previous);
  res.json({success:true,data});
});
=======
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
        path: 'lastMessage',
        select: '_id text type attachments sender isRecall createdAt',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      });

    // Populate recent messages for each conversation so frontend gets full history
    const convIds = conversations.map((c) => c._id);
    const allMessages = await Message.find({ conversationId: { $in: convIds } })
      .sort({ createdAt: 1 })
      .limit(300);

    const msgsByConv = {};
    for (const m of allMessages) {
      const cid = m.conversationId.toString();
      if (!msgsByConv[cid]) msgsByConv[cid] = [];
      msgsByConv[cid].push({
        id: m._id.toString(),
        _id: m._id,
        sender: (m.sender?._id || m.sender).toString(),
        text: m.isRecall ? 'Tin nhắn đã bị thu hồi' : (m.text || ''),
        time: m.createdAt,
        createdAt: m.createdAt,
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

>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
