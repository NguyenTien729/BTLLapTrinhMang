const service = require('../services/messageService');
const { publishMessage } = require('../socket/events');
const handle = work => async (req,res,next) => { try { await work(req,res); } catch(error) { next(error); } };
exports.getMessages = handle(async (req,res) => res.json({ success:true, data:await service.getConversationMessages({
  ...req.query, conversationId:req.params.conversationId, userId:req.user._id,
}) }));
exports.searchMessages = handle(async (req,res) => res.json({ success:true, data:await service.searchMessages({
  ...req.query, userId:req.user._id, query:req.query.q,
}) }));
exports.sendMessage = handle(async (req,res) => {
  const message = await service.createMessage({ ...req.body, senderId:req.user._id });
  const conversation = await service.requireMember(message.conversationId,req.user._id);
  publishMessage(req.app.get('io'),conversation,'message:new',message);
  res.status(201).json({ success:true, data:message });
});
exports.editMessage = handle(async (req,res) => {
  const message=await service.editMessage({ messageId:req.params.id,userId:req.user._id,newText:req.body.text });
  const conversation=await service.requireMember(message.conversationId,req.user._id);
  publishMessage(req.app.get('io'),conversation,'message:edited',message);
  res.json({ success:true,data:message });
});
exports.recallMessage = handle(async (req,res) => {
  const message=await service.recallMessage({ messageId:req.params.id,userId:req.user._id });
  const conversation=await service.requireMember(message.conversationId,req.user._id);
  publishMessage(req.app.get('io'),conversation,'message:revoked',message);
  res.json({ success:true,data:message });
});
