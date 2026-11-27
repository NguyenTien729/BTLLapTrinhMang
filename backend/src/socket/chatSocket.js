<<<<<<< HEAD
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
=======
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const messageService = require('../services/messageService');
const { notifyNewMessage } = require('./notificationSocket');

/**
 * Gắn các sự kiện chat cho một socket đã xác thực.
 * Tích hợp chặt chẽ với messageService để lưu tin nhắn dùng chung cho REST API và Socket.IO,
 * chống tạo trùng lặp với clientTempId.
 */
const initChatSocket = (io, socket) => {
  const userId = socket.userId || socket.user?._id?.toString();

  // Helper lấy cuộc trò chuyện và kiểm tra quyền thành viên
  const getConversation = async (conversationId) => {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new Error('Cuộc trò chuyện không tồn tại');
    if (!conversation.hasMember(userId)) {
      throw new Error('Bạn không phải thành viên của cuộc trò chuyện này');
    }
    return conversation;
  };

  // 1. Vào phòng chat
  const handleJoin = async (data, callback) => {
    try {
      const convId = data?.conversationId || data;
      const conversation = await getConversation(convId);
      socket.join(conversation._id.toString());
      if (typeof callback === 'function') {
        callback({ success: true, conversationId: conversation._id.toString() });
      }
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('conversation:join', handleJoin);
  socket.on('join_conversation', handleJoin);

  // 2. Rời phòng chat
  const handleLeave = (data) => {
    const convId = data?.conversationId || data;
    if (convId) socket.leave(convId.toString());
  };
  socket.on('conversation:leave', handleLeave);
  socket.on('leave_conversation', handleLeave);

  // 3. Gửi tin nhắn mới
  const handleSend = async (data, callback) => {
    try {
      const conversation = await getConversation(data?.conversationId);

      const message = await messageService.createMessage({
        conversationId: conversation._id,
        senderId: userId,
        text: data?.text,
        type: data?.type,
        attachments: data?.attachments,
        replyTo: data?.replyTo,
        clientTempId: data?.clientTempId
      });

      // Phát cho các client khác trong phòng
      socket.to(conversation._id.toString()).emit('message:new', message);
      socket.to(conversation._id.toString()).emit('receive_message', message);

      // Thông báo cho thành viên khác không mở tab hội thoại này
      notifyNewMessage(io, conversation, message, socket.id);

      if (typeof callback === 'function') callback({ success: true, data: message });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('message:send', handleSend);
  socket.on('send_message', handleSend);

  // 4. Sửa tin nhắn
  const handleEdit = async (data, callback) => {
    try {
      const message = await messageService.editMessage({
        messageId: data?.messageId || data?.id,
        userId,
        newText: data?.text || data?.content
      });
      io.to(message.conversationId.toString()).emit('message:edited', message);
      io.to(message.conversationId.toString()).emit('message_edited', message);
      if (typeof callback === 'function') callback({ success: true, data: message });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('message:edit', handleEdit);
  socket.on('edit_message', handleEdit);

  // 5. Thu hồi tin nhắn
  const handleRevoke = async (data, callback) => {
    try {
      const message = await messageService.recallMessage({
        messageId: data?.messageId || data?.id,
        userId
      });
      io.to(message.conversationId.toString()).emit('message:revoked', message);
      io.to(message.conversationId.toString()).emit('message_recalled', message);
      if (typeof callback === 'function') callback({ success: true, data: message });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  };
  socket.on('message:revoke', handleRevoke);
  socket.on('recall_message', handleRevoke);

  // 6. Đánh dấu đã xem
  socket.on('message:seen', async (data, callback) => {
    try {
      const conversation = await getConversation(data?.conversationId);
      const seenAt = new Date();

      await Message.updateMany(
        { conversationId: conversation._id, isRecall: false },
        { $addToSet: { readBy: { user: userId, readAt: seenAt } } }
      );

      socket.to(conversation._id.toString()).emit('message:seen', {
        conversationId: conversation._id.toString(),
        userId,
        seenAt
      });

      if (typeof callback === 'function') callback({ success: true });
    } catch (error) {
      if (typeof callback === 'function') callback({ success: false, message: error.message });
    }
  });

  // 7. Đang nhập / dừng nhập
  socket.on('typing:start', (data) => {
    if (!data?.conversationId) return;
    socket.to(data.conversationId.toString()).emit('typing:start', {
      conversationId: data.conversationId,
      userId,
      displayName: socket.user?.displayName || socket.user?.username
    });
  });

  socket.on('typing:stop', (data) => {
    if (!data?.conversationId) return;
    socket.to(data.conversationId.toString()).emit('typing:stop', {
      conversationId: data.conversationId,
      userId
    });
  });
};

module.exports = initChatSocket;
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
