const jwt=require('jsonwebtoken');
const mongoose=require('mongoose');
const User=require('../models/User');
module.exports=async(socket,next)=>{
  try {
    const token=socket.handshake.auth?.token;
    if(!token)return next(new Error('Thiếu token xác thực'));
    const decoded=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256'],issuer:'ptitchat',audience:'ptitchat-client'});
    if(!mongoose.isObjectIdOrHexString(decoded.sub))throw new Error();
    const user=await User.findById(decoded.sub);
    if(!user)throw new Error();
    socket.user=user;socket.userId=String(user._id);socket.tokenExpiresAt=decoded.exp*1000;next();
  }catch{next(new Error('Token không hợp lệ hoặc đã hết hạn'));}
};
