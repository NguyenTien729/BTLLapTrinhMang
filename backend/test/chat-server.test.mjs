import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {io as connect} from 'socket.io-client';
import {createChatServer} from '../demo-server/index.js';

test('REST authentication, membership protection, attachments and real-time delivery',async t=>{
 const dir=mkdtempSync(path.join(os.tmpdir(),'ptitchat-test-'));const server=createChatServer({dataDir:dir});await new Promise(resolve=>server.http.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.http.address().port}`;
 const sockets=[];t.after(async()=>{sockets.forEach(s=>s.disconnect());await server.close();rmSync(dir,{recursive:true,force:true});});
 async function request(route,{token,body,method='GET'}={}){const response=await fetch(url+'/api'+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
 assert.equal((await request('/users')).status,401);
 assert.equal((await request('/auth/login',{method:'POST',body:{username:'minhanh',password:'wrong'}})).status,401);
 const a=(await request('/auth/login',{method:'POST',body:{username:'minhanh',password:'ptitchat123'}})).data;
 const b=(await request('/auth/register',{method:'POST',body:{username:'testuser',password:'secret123',name:'Người kiểm thử'}})).data;
 assert.ok(b.token);assert.equal(b.user.username,'testuser');assert.equal(b.user.passwordHash,undefined);
 assert.equal((await request('/conversations/project/messages',{token:b.token,method:'POST',body:{text:'forbidden'}})).status,404);
 const conversation=await request('/conversations',{token:a.token,method:'POST',body:{type:'direct',members:[b.user.id]}});assert.equal(conversation.status,201);
 const c=conversation.data;assert.equal((await request('/conversations',{token:a.token,method:'POST',body:{type:'direct',members:[b.user.id]}})).data.id,c.id);
 const socket=connect(url,{auth:{token:b.token},transports:['websocket']});sockets.push(socket);await new Promise((resolve,reject)=>{socket.once('connect',resolve);socket.once('connect_error',reject);});
 const incoming=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('No Socket.IO message received')),4000);socket.once('message',m=>{clearTimeout(timer);resolve(m);});});
 const sent=await request(`/conversations/${c.id}/messages`,{token:a.token,method:'POST',body:{text:'Xin chào qua Socket.IO'}});assert.equal(sent.status,201);const received=await incoming;assert.equal(received.message.id,sent.data.id);assert.equal(received.message.text,'Xin chào qua Socket.IO');
 assert.equal((await request(`/conversations/${c.id}/messages`,{token:a.token,method:'POST',body:{text:' '}})).status,400);
 const attached=await request(`/conversations/${c.id}/messages`,{token:b.token,method:'POST',body:{file:{name:'hello.txt',type:'text/plain',data:'data:text/plain;base64,aGVsbG8='}}});assert.equal(attached.status,201);assert.equal(attached.data.file.size,5);
 const group=await request('/conversations',{token:a.token,method:'POST',body:{type:'group',name:'Nhóm kiểm thử',members:[b.user.id,'hoangnam']}});assert.equal(group.status,201);assert.equal(group.data.members.length,3);
 const changed=await request('/me',{token:b.token,method:'PATCH',body:{name:'Tên mới',bio:'Chào PTIT'}});assert.equal(changed.data.name,'Tên mới');
 assert.equal((await request('/users',{token:a.token})).data.some(p=>p.passwordHash),false);
 const saved=(await request('/conversations',{token:b.token})).data.find(x=>x.id===c.id);assert.equal(saved.messages.length,2);
});
