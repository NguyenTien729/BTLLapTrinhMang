const Message=require('../models/Message');
const service=require('../services/messageService');
const {publishMessage}=require('./events');
module.exports=(io,socket)=>{
  const bind=(event,work)=>socket.on(event,async(data={},callback)=>{
    try { const result=await work(data); if(typeof callback==='function')callback({success:true,data:result}); }
    catch(error){if(typeof callback==='function')callback({success:false,message:error.message,statusCode:error.statusCode||500});}
  });
  bind('conversation:join',async({conversationId})=>{
    const c=await service.requireMember(conversationId,socket.userId); await socket.join(String(c._id));
    return {conversationId:String(c._id)};
  });
  socket.on('conversation:leave',data=>{if(typeof data?.conversationId==='string')socket.leave(data.conversationId);});
  bind('message:send',async(data)=>{
    const message=await service.createMessage({...data,senderId:socket.userId});
    const c=await service.requireMember(message.conversationId,socket.userId);
    publishMessage(io,c,'message:new',message); return message;
  });
  for(const [event,method,out] of [['message:edit','editMessage','message:edited'],['message:revoke','recallMessage','message:revoked']]){
    bind(event,async(data)=>{
      const message=await service[method]({messageId:data.messageId,userId:socket.userId,newText:data.text});
      const c=await service.requireMember(message.conversationId,socket.userId);
      publishMessage(io,c,out,message); return message;
    });
  }
  bind('message:seen',async({conversationId,messageIds})=>{
    const c=await service.requireMember(conversationId,socket.userId),seenAt=new Date();
    const filter={conversationId:c._id,sender:{$ne:socket.userId},'readBy.user':{$ne:socket.userId},createdAt:{$lte:seenAt}};
    if(messageIds!==undefined){
      if(!Array.isArray(messageIds)||messageIds.length>100||messageIds.some(id=>!require('mongoose').isObjectIdOrHexString(id)))throw new Error('Danh sách tin nhắn không hợp lệ.');
      filter._id={$in:messageIds};
    }
    const ids=(await Message.find(filter).select('_id')).map(m=>String(m._id));
    await Message.updateMany({...filter,_id:{$in:ids}},{$push:{readBy:{user:socket.userId,readAt:seenAt}}});
    const result={conversationId:String(c._id),userId:socket.userId,seenAt,messageIds:ids};
    io.to(c.members.map(id=>'user:'+String(id))).emit('message:seen',result);
    return result;
  });
  for(const event of ['typing:start','typing:stop'])bind(event,async({conversationId})=>{
    const c=await service.requireMember(conversationId,socket.userId);
    socket.to(String(c._id)).emit(event,{conversationId:String(c._id),userId:socket.userId,displayName:socket.user.displayName||socket.user.username});
  });
};
