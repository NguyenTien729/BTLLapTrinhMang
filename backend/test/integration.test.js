const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const jwt=require('jsonwebtoken');
const {io:client}=require('socket.io-client');
const {startDatabase,stopDatabase}=require('./helpers/database');
process.env.JWT_SECRET='integration-secret-used-only-for-tests-123456789';
const app=require('../src/app');
const initSocketIO=require('../src/socket');
const User=require('../src/models/User');
const Conversation=require('../src/models/Conversation');
const Message=require('../src/models/Message');
let server,io,url,a,b,c,outsider,direct,group;const sockets=[];
const once=(socket,event)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Missing '+event)),5000);socket.once(event,value=>{clearTimeout(timer);resolve(value);});});
async function connect(token){const s=client(url,{auth:{token},transports:['websocket'],reconnection:false});sockets.push(s);await new Promise((resolve,reject)=>{s.once('connect',resolve);s.once('connect_error',reject);});return s;}
const emit=(socket,event,payload)=>new Promise((resolve,reject)=>socket.timeout(5000).emit(event,payload,(err,response)=>err?reject(err):resolve(response)));
async function api(route,{token,body,method='GET'}={}){
  const form=body instanceof FormData;
  const response=await fetch(url+'/api'+route,{method,headers:{...(!form&&body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:form?body:JSON.stringify(body)}:{})});
  return {status:response.status,body:await response.json()};
}
before(async()=>{
  await startDatabase();await Promise.all([User.init(),Conversation.init(),Message.init()]);
  server=http.createServer(app);io=initSocketIO(server);app.set('io',io);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));url='http://127.0.0.1:'+server.address().port;
  const register=async name=>(await api('/auth/register',{method:'POST',body:{username:name,email:name+'@example.com',password:'password123'}})).body;
  [a,b,c,outsider]=await Promise.all(['Alice','Bob','Carol','Outsider'].map(register));
});
after(async()=>{sockets.forEach(s=>s.close());if(io)await new Promise(resolve=>io.close(resolve));if(server?.listening)await new Promise(resolve=>server.close(resolve));await stopDatabase();});

test('real MongoDB auth, profile, email search and strict REST/socket JWT contract',async()=>{
  assert.ok(a.token);assert.equal(a.user.passwordHash,undefined);
  assert.equal((await api('/auth/register',{method:'POST',body:{username:'Other',email:a.user.email,password:'password123'}})).status,409);
  assert.equal((await api('/auth/login',{method:'POST',body:{email:a.user.email,password:'bad'}})).status,401);
  assert.equal((await api('/auth/login',{method:'POST',body:{email:a.user.email,password:'password123'}})).status,200);
  assert.equal((await api('/users/me')).status,401);
  const invalid=jwt.sign({sub:a.user._id},process.env.JWT_SECRET,{expiresIn:'1h',issuer:'other',audience:'ptitchat-client'});
  assert.equal((await api('/users/me',{token:invalid})).status,401);
  await assert.rejects(connect(invalid),/Token/);
  const profile=await api('/users/me',{token:a.token,method:'PUT',body:{displayName:'Alice Updated',bio:'Hello',studentId:'B21'}});
  assert.equal(profile.body.user.displayName,'Alice Updated');
  const search=await api('/users/search?q='+encodeURIComponent(b.user.email),{token:a.token});assert.equal(search.body.users[0]._id,b.user._id);
});
test('create direct/group conversations and notify members; outsiders cannot read, search, send or join',async()=>{
  const sb=await connect(b.token),created=once(sb,'conversation:updated');
  direct=(await api('/conversations',{token:a.token,method:'POST',body:{recipientId:b.user._id}})).body.data;
  assert.equal((await created)._id,direct._id);
  group=(await api('/conversations/group',{token:a.token,method:'POST',body:{name:'Group',members:[b.user._id,c.user._id]}})).body.data;
  assert.equal(group.members.length,3);
  assert.equal((await api('/messages/'+group._id,{token:outsider.token})).status,403);
  assert.equal((await api('/messages/search?conversationId='+group._id+'&q=hi',{token:outsider.token})).status,403);
  assert.equal((await api('/messages',{token:outsider.token,method:'POST',body:{conversationId:group._id,text:'intrude'}})).status,403);
  const so=await connect(outsider.token);assert.equal((await emit(so,'conversation:join',{conversationId:group._id})).success,false);
  assert.equal((await emit(so,'typing:start',{conversationId:group._id})).success,false);
});
test('REST and Socket.IO share history, notifications and a database-enforced retry key under concurrent sends',async()=>{
  const sa=await connect(a.token),sb=await connect(b.token);
  const messageEvent=once(sb,'message:new'),notification=once(sb,'notification:new');
  const sent=await api('/messages',{token:a.token,method:'POST',body:{conversationId:direct._id,text:'hello REST',clientTempId:'rest-1'}});
  assert.equal(sent.status,201);assert.equal((await messageEvent)._id,sent.body.data._id);assert.equal((await notification).message._id,sent.body.data._id);
  const payload={conversationId:direct._id,text:'one concurrent message',clientTempId:'concurrent-key'};
  const results=await Promise.all([api('/messages',{token:a.token,method:'POST',body:payload}),...Array.from({length:6},()=>emit(sa,'message:send',payload))]);
  const ids=results.map(r=>r.body?.data?._id||r.data?._id);assert.equal(new Set(ids).size,1);
  assert.equal(await Message.countDocuments({conversationId:direct._id,clientTempId:payload.clientTempId}),1);
  const other=await emit(sb,'message:send',payload);assert.equal(other.success,true);assert.notEqual(other.data._id,ids[0]);
  const history=(await api('/messages/'+direct._id,{token:a.token})).body.data;assert.equal(history.total,3);
  assert.ok((await api('/conversations',{token:b.token})).body.data.find(conv=>conv._id===direct._id).unread>=2);
});
test('edit, reply, soft revoke and search are persisted and broadcast with recalled replies masked',async()=>{
  const sb=await connect(b.token),sa=await connect(a.token);
  const original=(await emit(sa,'message:send',{conversationId:group._id,text:'original',clientTempId:'edit-1'})).data;
  const editEvent=once(sb,'message:edited');
  const edited=await api('/messages/'+original._id,{token:a.token,method:'PATCH',body:{text:'updated content'}});assert.equal(edited.status,200);assert.equal((await editEvent).isEdited,true);
  assert.equal((await api('/messages/'+original._id,{token:b.token,method:'PATCH',body:{text:'not mine'}})).status,403);
  await emit(sb,'message:send',{conversationId:group._id,text:'reply',replyTo:original._id,clientTempId:'reply-1'});
  assert.equal((await api('/messages/search?conversationId='+group._id+'&q=updated',{token:b.token})).body.data.total,1);
  const revokeEvent=once(sb,'message:revoked');assert.equal((await api('/messages/'+original._id,{token:a.token,method:'DELETE'})).status,200);assert.equal((await revokeEvent).isRecall,true);
  assert.ok(await Message.exists({_id:original._id}));
  const history=(await api('/messages/'+group._id,{token:b.token})).body.data.messages;
  assert.equal(history.find(m=>m.replyTo).replyTo.text,'Tin nhắn đã bị thu hồi');
  assert.equal((await api('/messages/search?conversationId='+group._id+'&q=updated',{token:b.token})).body.data.total,0);
});
test('read receipts only mark rendered messages once, and restore after reloading history',async()=>{
  const sb=await connect(b.token),sa=await connect(a.token);
  const message=(await emit(sa,'message:send',{conversationId:direct._id,text:'read me',clientTempId:'seen-1'})).data;
  const seenEvent=once(sa,'message:seen');
  for(let i=0;i<2;i++)assert.equal((await emit(sb,'message:seen',{conversationId:direct._id,messageIds:[message._id]})).success,true);
  assert.ok((await seenEvent).messageIds.includes(message._id));
  assert.equal((await Message.findById(message._id)).readBy.length,1);
  const stored=(await api('/messages/'+direct._id,{token:a.token})).body.data.messages.find(m=>m._id===message._id);assert.equal(stored.readBy[0].user,b.user._id);
  assert.equal((await api('/messages/not-an-id',{token:a.token})).status,400);
});
test('Multer upload is used for message files and avatar; message history keeps file metadata',async()=>{
  const body=new FormData();body.append('file',new Blob(['hello'],{type:'text/plain'}),'hello.txt');
  assert.equal((await api('/uploads',{method:'POST',body})).status,401);
  const upload=await api('/uploads',{token:a.token,method:'POST',body});assert.equal(upload.status,201);
  const file=upload.body.data;
  const sent=await api('/messages',{token:a.token,method:'POST',body:{conversationId:direct._id,text:'file',attachments:[{url:file.url,fileName:file.originalName,mimeType:file.mimeType,fileSize:file.size,fileType:file.type}],clientTempId:'file-1'}});
  assert.equal(sent.status,201);assert.equal(sent.body.data.attachments[0].fileSize,5);
  assert.equal(await (await fetch(url+file.url)).text(),'hello');
  assert.equal((await api('/messages',{token:a.token,method:'POST',body:{conversationId:direct._id,text:'bad',attachments:[{url:'javascript:alert(1)'}]}})).status,400);
  assert.equal((await api('/users/me',{token:a.token,method:'PUT',body:{avatar:file.url}})).status,400);
  const imageBody=new FormData();imageBody.append('file',new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a+akAAAAASUVORK5CYII=','base64')],{type:'image/png'}),'avatar.png');
  const image=(await api('/uploads',{token:a.token,method:'POST',body:imageBody})).body.data;
  assert.equal((await api('/users/me',{token:a.token,method:'PUT',body:{avatar:image.url}})).status,200);
  const fs=require('node:fs');const path=require('node:path');fs.unlinkSync(path.join(require('../src/middleware/uploadMiddleware').uploadDir,path.basename(file.url)));
  fs.unlinkSync(path.join(require('../src/middleware/uploadMiddleware').uploadDir,path.basename(image.url)));
});
test('removed members lose API access and stop receiving personal-room message broadcasts',async()=>{
  const sc=await connect(c.token),sa=await connect(a.token),removed=once(sc,'conversation:removed');
  assert.equal((await api('/conversations/'+group._id,{token:a.token,method:'PATCH',body:{removeMembers:[c.user._id]}})).status,200);
  assert.equal((await removed).conversationId,group._id);
  assert.equal((await api('/messages/'+group._id,{token:c.token})).status,403);
  let leaked=false;sc.on('message:new',()=>{leaked=true;});
  await emit(sa,'message:send',{conversationId:group._id,text:'members only',clientTempId:'private-1'});
  await new Promise(resolve=>setTimeout(resolve,80));assert.equal(leaked,false);
});

test('history and search paginate across persisted messages and treat regex characters literally',async()=>{
  await Message.insertMany(Array.from({length:35},(_,i)=>({conversationId:direct._id,sender:a.user._id,text:i===0?'needle.*literal':'older '+i,createdAt:new Date(Date.now()-100000+i*1000)})));
  const page1=(await api('/messages/'+direct._id+'?page=1&limit=10',{token:b.token})).body.data;
  const page2=(await api('/messages/'+direct._id+'?page=2&limit=10',{token:b.token})).body.data;
  assert.equal(page1.messages.length,10);assert.equal(page2.messages.length,10);assert.ok(page1.totalPages>=4);
  assert.equal(new Set([...page1.messages,...page2.messages].map(m=>m._id)).size,20);
  const literal=(await api('/messages/search?conversationId='+direct._id+'&q='+encodeURIComponent('.*'),{token:b.token})).body.data;
  assert.equal(literal.total,1);assert.equal(literal.messages[0].text,'needle.*literal');
  const privateSearch=(await api('/messages/search?q=needle',{token:outsider.token})).body.data;
  assert.equal(privateSearch.total,0);
  assert.equal((await api('/conversations/group',{token:a.token,method:'POST'})).status,400);
});

test('a connected Socket.IO session expires with the same JWT lifetime as HTTP',async()=>{
  const token=jwt.sign({},process.env.JWT_SECRET,{subject:a.user._id,expiresIn:1,issuer:'ptitchat',audience:'ptitchat-client'});
  const socket=await connect(token),expired=once(socket,'auth:expired');await expired;
  await new Promise(resolve=>setTimeout(resolve,30));assert.equal(socket.connected,false);
  assert.equal((await api('/users/me',{token})).status,401);
});
