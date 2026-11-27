<<<<<<< HEAD
const mongoose = require('mongoose');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const fail = (statusCode, message) => { throw Object.assign(new Error(message), { statusCode }); };
const validId = value => mongoose.isObjectIdOrHexString(value);
const populated = query => query.populate('sender', '_id username displayName avatar email')
  .populate({ path: 'replyTo', select: '_id text isRecall sender', populate: { path: 'sender', select: 'username displayName' } });

async function requireMember(conversationId, userId) {
  if (!validId(conversationId)) fail(400, 'ID cuộc trò chuyện không hợp lệ.');
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) fail(404, 'Cuộc trò chuyện không tồn tại.');
  if (!conversation.hasMember(userId)) fail(403, 'Bạn không phải thành viên của cuộc trò chuyện này.');
  return conversation;
}
async function createMessage({ conversationId, senderId, text = '', attachments = [], replyTo = null, clientTempId = null }) {
  const conversation = await requireMember(conversationId, senderId);
  if (typeof text !== 'string' || text.length > 4000) fail(400, 'Tin nhắn tối đa 4000 ký tự.');
  if (!Array.isArray(attachments) || attachments.length > 10) fail(400, 'Tối đa 10 tệp đính kèm.');
  if (!text.trim() && !attachments.length) fail(400, 'Nội dung tin nhắn hoặc tệp đính kèm không được để trống.');
  if (clientTempId !== null && (typeof clientTempId !== 'string' || !clientTempId || clientTempId.length > 100)) fail(400, 'Mã gửi lại không hợp lệ.');
  const key = { conversationId, sender: senderId, clientTempId };
  if (clientTempId) {
    const existing = await populated(Message.findOne(key));
    if (existing) return existing.toClientJSON();
  }
  const files = attachments.map(file => {
    if (!file || typeof file.url !== 'string' || !/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(file.url)) fail(400, 'Tệp đính kèm phải được tải lên trước.');
    return { url: file.url, fileName: String(file.fileName || '').slice(0,255), mimeType: String(file.mimeType || ''), fileSize: Number(file.fileSize) || 0, fileType: file.fileType === 'image' ? 'image' : 'file' };
  });
  if (replyTo && (!validId(replyTo) || !await Message.exists({ _id: replyTo, conversationId }))) fail(400, 'Tin nhắn trả lời không tồn tại trong hội thoại.');
  let message;
  try {
    message = await Message.create({ ...key, text: text.trim(), attachments: files, replyTo,
      type: files.length ? (files[0].fileType === 'image' ? 'image' : 'file') : 'text' });
  } catch (error) {
    if (error.code !== 11000 || !clientTempId) throw error;
    return (await populated(Message.findOne(key))).toClientJSON();
  }
  await Conversation.updateOne({ _id: conversation._id, $or: [{ lastMessageAt: { $lte: message.createdAt } }, { lastMessage: null }] },
    { $set: { lastMessage: message._id, lastMessageAt: message.createdAt } });
  return (await populated(Message.findById(message._id))).toClientJSON();
}
async function getConversationMessages({ conversationId, userId, page = 1, limit = 30 }) {
  await requireMember(conversationId, userId);
  const pageNum = Math.max(1, parseInt(page,10)||1), limitNum = Math.min(100,Math.max(1,parseInt(limit,10)||30));
  const total = await Message.countDocuments({ conversationId });
  const messages = await populated(Message.find({ conversationId }).sort({ createdAt: -1, _id: -1 }).skip((pageNum-1)*limitNum).limit(limitNum));
  return { conversationId, total, page: pageNum, totalPages: Math.ceil(total/limitNum), messages: messages.map(m=>m.toClientJSON()).reverse() };
}
async function ownMessage(messageId, userId, allowAdmin = false) {
  if (!validId(messageId)) fail(400, 'ID tin nhắn không hợp lệ.');
  const message = await Message.findById(messageId);
  if (!message) fail(404, 'Tin nhắn không tồn tại.');
  const conversation = await requireMember(message.conversationId, userId);
  if (String(message.sender) !== String(userId) && !(allowAdmin && String(conversation.admin) === String(userId))) fail(403, 'Bạn không có quyền sửa tin nhắn của người khác.');
  return message;
}
async function editMessage({ messageId, userId, newText }) {
  if (typeof newText !== 'string' || !newText.trim() || newText.length > 4000) fail(400, 'Nội dung cần có 1–4000 ký tự.');
  const message = await ownMessage(messageId,userId);
  if (message.isRecall) fail(400, 'Không thể chỉnh sửa tin nhắn đã bị thu hồi.');
  Object.assign(message,{ text:newText.trim(), isEdited:true, editedAt:new Date() });
  await message.save();
  return (await populated(Message.findById(message._id))).toClientJSON();
}
async function recallMessage({ messageId, userId }) {
  const message = await ownMessage(messageId,userId,true);
  message.isRecall=true; message.recalledAt ||= new Date(); await message.save();
  return (await populated(Message.findById(message._id))).toClientJSON();
}
async function searchMessages({ userId, query, conversationId = null, page = 1, limit = 30 }) {
  if (typeof query !== 'string' || !query.trim() || query.length > 100) fail(400,'Từ khóa cần có 1–100 ký tự.');
  const filter = { isRecall:false, text: { $regex:query.trim().replace(/[.*+?^\u0024{}()|[\]\\]/g,'\\$&'), $options:'i' } };
  if (conversationId) { await requireMember(conversationId,userId); filter.conversationId=conversationId; }
  else filter.conversationId={ $in:(await Conversation.find({ members:userId }).select('_id')).map(c=>c._id) };
  const pageNum=Math.max(1,parseInt(page,10)||1), limitNum=Math.min(50,Math.max(1,parseInt(limit,10)||30));
  const total=await Message.countDocuments(filter);
  const messages=await populated(Message.find(filter).sort({ createdAt:-1, _id:-1 }).skip((pageNum-1)*limitNum).limit(limitNum));
  return { total, page:pageNum, totalPages:Math.ceil(total/limitNum), messages:messages.map(m=>m.toClientJSON()) };
}
module.exports = { createMessage, getConversationMessages, editMessage, recallMessage, searchMessages, requireMember };
=======
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

/**
 * Shared service function to create and save a new message.
 * Used by both REST API controllers and Socket.IO event handlers.
 * Includes deduplication via clientTempId to prevent double creation.
 *
 * @param {Object} params
 * @param {string} params.conversationId - Conversation ObjectId
 * @param {string} params.senderId - Sender User ObjectId
 * @param {string} [params.text] - Message text content
 * @param {string} [params.type] - 'text' | 'image' | 'file'
 * @param {Array}  [params.attachments] - Array of attachment metadata objects
 * @param {string} [params.replyTo] - ID of message being replied to
 * @param {string} [params.clientTempId] - Temporary client ID for deduplication
 * @returns {Promise<Object>} Populated message document formatted for client
 */
const createMessage = async ({
  conversationId,
  senderId,
  text = '',
  type = 'text',
  attachments = [],
  replyTo = null,
  clientTempId = null
}) => {
  // 1. Deduplication check: If clientTempId is provided, check if already created
  if (clientTempId) {
    const existing = await Message.findOne({
      conversationId,
      clientTempId
    })
      .populate('sender', '_id username displayName avatar email')
      .populate({
        path: 'replyTo',
        select: '_id text type isRecall attachments sender',
        populate: { path: 'sender', select: '_id username displayName avatar' }
      });

    if (existing) {
      return existing.toClientJSON();
    }
  }

  // 2. Validate content
  const trimmedText = typeof text === 'string' ? text.trim() : '';
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  if (!trimmedText && !hasAttachments) {
    const err = new Error('Nội dung tin nhắn hoặc tệp đính kèm không được để trống');
    err.statusCode = 400;
    throw err;
  }

  // 3. Verify conversation existence and membership
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const err = new Error('Cuộc trò chuyện không tồn tại');
    err.statusCode = 404;
    throw err;
  }

  const isMember = conversation.hasMember(senderId);
  if (!isMember) {
    const err = new Error('Người gửi không phải là thành viên của cuộc trò chuyện này');
    err.statusCode = 403;
    throw err;
  }

  // 4. Validate replyTo if provided
  let validReplyTo = null;
  if (replyTo) {
    const replyTarget = await Message.findOne({
      _id: replyTo,
      conversationId
    });
    if (!replyTarget) {
      const err = new Error('Tin nhắn được trả lời không tồn tại trong cuộc trò chuyện này');
      err.statusCode = 400;
      throw err;
    }
    validReplyTo = replyTarget._id;
  }

  // 5. Determine type if default
  let messageType = type;
  if (messageType === 'text' && hasAttachments) {
    const firstAtt = attachments[0];
    if (firstAtt.fileType === 'image' || (firstAtt.mimeType && firstAtt.mimeType.startsWith('image/'))) {
      messageType = 'image';
    } else {
      messageType = 'file';
    }
  }

  // 6. Create message
  const newMessage = new Message({
    conversationId,
    sender: senderId,
    type: messageType,
    text: trimmedText,
    attachments: attachments || [],
    replyTo: validReplyTo,
    clientTempId: clientTempId || null
  });

  await newMessage.save();

  // 7. Update conversation's lastMessage and lastMessageAt
  conversation.lastMessage = newMessage._id;
  conversation.lastMessageAt = newMessage.createdAt;
  await conversation.save();

  // 8. Populate message details
  const populatedMessage = await Message.findById(newMessage._id)
    .populate('sender', '_id username displayName avatar email')
    .populate({
      path: 'replyTo',
      select: '_id text type isRecall attachments sender',
      populate: { path: 'sender', select: '_id username displayName avatar' }
    });

  return populatedMessage.toClientJSON();
};

/**
 * Get paginated message history for a conversation
 */
const getConversationMessages = async ({
  conversationId,
  userId,
  page = 1,
  limit = 20,
  before = null
}) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) {
    const err = new Error('Cuộc trò chuyện không tồn tại');
    err.statusCode = 404;
    throw err;
  }

  if (!conversation.hasMember(userId)) {
    const err = new Error('Bạn không có quyền truy cập cuộc trò chuyện này');
    err.statusCode = 403;
    throw err;
  }

  const query = { conversationId };

  if (before) {
    const beforeDate = new Date(before);
    if (!isNaN(beforeDate.getTime())) {
      query.createdAt = { $lt: beforeDate };
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const total = await Message.countDocuments({ conversationId });

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .skip(before ? 0 : skip)
    .limit(limitNum)
    .populate('sender', '_id username displayName avatar email')
    .populate({
      path: 'replyTo',
      select: '_id text type isRecall attachments sender',
      populate: { path: 'sender', select: '_id username displayName avatar' }
    });

  // Client gets chronological order (oldest to newest) for rendered chat window,
  // with masked content for recalled messages
  const formattedMessages = messages
    .map((msg) => msg.toClientJSON())
    .reverse();

  return {
    conversationId,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    messages: formattedMessages
  };
};

/**
 * Edit sender's own message
 */
const editMessage = async ({ messageId, userId, newText }) => {
  const trimmed = typeof newText === 'string' ? newText.trim() : '';
  if (!trimmed) {
    const err = new Error('Nội dung tin nhắn không được để trống');
    err.statusCode = 400;
    throw err;
  }

  const message = await Message.findById(messageId);
  if (!message) {
    const err = new Error('Tin nhắn không tồn tại');
    err.statusCode = 404;
    throw err;
  }

  if (message.sender.toString() !== userId.toString()) {
    const err = new Error('Bạn chỉ có quyền sửa tin nhắn của chính mình');
    err.statusCode = 403;
    throw err;
  }

  if (message.isRecall) {
    const err = new Error('Không thể chỉnh sửa tin nhắn đã bị thu hồi');
    err.statusCode = 400;
    throw err;
  }

  message.text = trimmed;
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();

  const updatedMessage = await Message.findById(message._id)
    .populate('sender', '_id username displayName avatar email')
    .populate({
      path: 'replyTo',
      select: '_id text type isRecall attachments sender',
      populate: { path: 'sender', select: '_id username displayName avatar' }
    });

  return updatedMessage.toClientJSON();
};

/**
 * Soft recall message (DELETE /api/messages/:id)
 * Preserves database record while marking isRecall: true and masking output.
 */
const recallMessage = async ({ messageId, userId }) => {
  const message = await Message.findById(messageId);
  if (!message) {
    const err = new Error('Tin nhắn không tồn tại');
    err.statusCode = 404;
    throw err;
  }

  // Check if sender or group admin
  const isSender = message.sender.toString() === userId.toString();
  if (!isSender) {
    // Check if group admin
    const conversation = await Conversation.findById(message.conversationId);
    const isAdmin =
      conversation &&
      conversation.admin &&
      conversation.admin.toString() === userId.toString();

    if (!isAdmin) {
      const err = new Error('Bạn không có quyền thu hồi tin nhắn này');
      err.statusCode = 403;
      throw err;
    }
  }

  if (message.isRecall) {
    return message.toClientJSON();
  }

  message.isRecall = true;
  message.recalledAt = new Date();
  await message.save();

  const recalledMessage = await Message.findById(message._id)
    .populate('sender', '_id username displayName avatar email')
    .populate({
      path: 'replyTo',
      select: '_id text type isRecall attachments sender',
      populate: { path: 'sender', select: '_id username displayName avatar' }
    });

  return recalledMessage.toClientJSON();
};

/**
 * Search messages in conversation or across all user conversations
 */
const searchMessages = async ({
  userId,
  query,
  conversationId = null,
  page = 1,
  limit = 20
}) => {
  const trimmed = typeof query === 'string' ? query.trim() : '';
  if (!trimmed) {
    const err = new Error('Vui lòng nhập từ khóa tìm kiếm');
    err.statusCode = 400;
    throw err;
  }

  // Escape special regex characters
  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(escaped, 'i');

  const filter = {
    isRecall: false,
    text: regex
  };

  if (conversationId) {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      const err = new Error('Cuộc trò chuyện không tồn tại');
      err.statusCode = 404;
      throw err;
    }

    if (!conversation.hasMember(userId)) {
      const err = new Error('Bạn không có quyền tìm kiếm trong cuộc trò chuyện này');
      err.statusCode = 403;
      throw err;
    }

    filter.conversationId = conversationId;
  } else {
    // Search in all conversations where user is a member
    const userConversations = await Conversation.find(
      { members: userId },
      '_id'
    );
    const convIds = userConversations.map((c) => c._id);
    filter.conversationId = { $in: convIds };
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (pageNum - 1) * limitNum;

  const total = await Message.countDocuments(filter);

  const messages = await Message.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .populate('sender', '_id username displayName avatar email')
    .populate('conversationId', '_id name type avatar')
    .populate({
      path: 'replyTo',
      select: '_id text type isRecall attachments sender',
      populate: { path: 'sender', select: '_id username displayName avatar' }
    });

  return {
    query: trimmed,
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    messages: messages.map((m) => m.toClientJSON())
  };
};

module.exports = {
  createMessage,
  getConversationMessages,
  editMessage,
  recallMessage,
  searchMessages
};

>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
