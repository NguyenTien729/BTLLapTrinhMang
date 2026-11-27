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
