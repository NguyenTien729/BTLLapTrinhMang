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
