require('dotenv').config();
const mongoose=require('mongoose');
const bcrypt=require('bcrypt');
const User=require('../models/User');
const Conversation=require('../models/Conversation');
const {createMessage}=require('../services/messageService');
async function seed(){
  await require('../config/db')();
  await Promise.all([User.init(),Conversation.init(),require('../models/Message').init()]);
  const passwordHash=await bcrypt.hash('password123',12);
  const users=[];
  for(const [username,email] of [['Tùng','tung@ptit.edu.vn'],['Tiến','tien@ptit.edu.vn'],['Sơn','son@ptit.edu.vn'],['Ninh','ninh@ptit.edu.vn']]){
    users.push(await User.findOneAndUpdate({email},{$setOnInsert:{username,email,passwordHash}},{upsert:true,new:true,setDefaultsOnInsert:true}));
  }
  const members=users.map(user=>user._id);
  let group=await Conversation.findOne({type:'group',name:'Nhóm 13 PTITChat',members:{$all:members,$size:members.length}});
  if(!group)group=await Conversation.create({type:'group',name:'Nhóm 13 PTITChat',members,admin:members[0]});
  await createMessage({conversationId:group._id,senderId:members[0],text:'Chào mừng nhóm 13 đến với PTITChat!',clientTempId:'seed-welcome-v1'});
  console.log('Đã bổ sung tài khoản mẫu và nhóm. Không xóa dữ liệu hiện có.');
  console.log('Email mẫu: tung@ptit.edu.vn, tien@ptit.edu.vn, son@ptit.edu.vn, ninh@ptit.edu.vn. Mật khẩu tài khoản mới: password123.');
}
seed().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>mongoose.disconnect());
