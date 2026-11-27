require('dotenv').config();
const {randomUUID}=require('node:crypto');
const {io}=require('socket.io-client');
const base=process.env.DEMO_URL||'http://127.0.0.1:5000',sockets=[];
async function request(path,body,token){
  const response=await fetch(base+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  const data=await response.json();if(!response.ok)throw new Error(data.message);return data;
}
const emit=(socket,event,data)=>new Promise((resolve,reject)=>socket.timeout(5000).emit(event,data,(error,response)=>{if(error||!response?.success)reject(error||new Error(response?.message));else resolve(response.data);}));
async function connect(token){
  const socket=io(base,{auth:{token},transports:['websocket'],reconnection:false});sockets.push(socket);
  await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});return socket;
}
async function demo(){
  const run=randomUUID().slice(0,8),users=[];
  for(const username of ['An','Bình','Cường'])users.push(await request('/auth/register',{username,email:'demo-'+users.length+'-'+run+'@example.com',password:'password123'}));
  const {data:group}=await request('/conversations/group',{name:'Demo '+run,members:users.slice(1).map(user=>user.user._id)},users[0].token);
  const clients=await Promise.all(users.map(user=>connect(user.token)));
  for(const socket of clients)await emit(socket,'conversation:join',{conversationId:group._id});
  clients[1].on('message:new',message=>console.log('Bình nhận:',message.text));
  const payload={conversationId:group._id,text:'Xin chào cả nhóm!',clientTempId:randomUUID()};
  const first=await emit(clients[0],'message:send',payload),retry=await emit(clients[0],'message:send',payload);
  if(String(first._id)!==String(retry._id))throw new Error('Mã chống trùng không hoạt động.');
  const reply=await emit(clients[1],'message:send',{conversationId:group._id,text:'Đã nhận!',replyTo:first._id,clientTempId:randomUUID()});
  await emit(clients[1],'message:edit',{messageId:reply._id,text:'Đã nhận qua Socket.IO!'});
  await emit(clients[2],'message:seen',{conversationId:group._id,messageIds:[first._id,reply._id]});
  await emit(clients[0],'message:revoke',{messageId:first._id});
  console.log('Demo thành công: gửi, chống trùng, trả lời, sửa, đã xem, thu hồi. Nhóm demo được giữ trong ứng dụng.');
}
demo().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(()=>sockets.forEach(socket=>socket.close()));
