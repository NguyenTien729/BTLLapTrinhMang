import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {transform} from 'esbuild';
import {JSDOM} from 'jsdom';
import {io as connect} from 'socket.io-client';
const require=createRequire(import.meta.url);
const {startDatabase,stopDatabase}=require('../../backend/test/helpers/database');

test('real React + MongoDB: register/login, email search, messaging, receipts, edit/reply/revoke, group, retry and logout',async t=>{
  process.env.JWT_SECRET='frontend-integration-secret-123456789-test-only';
  let io,http,root,act,dom;const sockets=[],tempFiles=[];const nativeFetch=globalThis.fetch;
  const globals=['window','document','HTMLElement','localStorage','sessionStorage','history','location','Event','navigator'];
  const originals=new Map(globals.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  t.after(async()=>{
    if(root)await act(()=>root.unmount());sockets.forEach(s=>s.close());
    if(io)await new Promise(resolve=>io.close(resolve));if(http?.listening)await new Promise(resolve=>http.close(resolve));
    await stopDatabase();for(const file of tempFiles)await unlink(file).catch(()=>{});
    dom?.window.close();globalThis.fetch=nativeFetch;delete globalThis.IS_REACT_ACT_ENVIRONMENT;
    for(const [name,descriptor] of originals)if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];
  });
  await startDatabase();
  const User=require('../../backend/src/models/User'),Conversation=require('../../backend/src/models/Conversation'),Message=require('../../backend/src/models/Message');
  await Promise.all([User.init(),Conversation.init(),Message.init()]);
  const app=require('../../backend/src/app');http=createServer(app);io=require('../../backend/src/socket')(http);app.set('io',io);
  await new Promise(resolve=>http.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+http.address().port;
  async function register(username){const r=await nativeFetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username,email:username.toLowerCase()+'@example.com',password:'password123'})});assert.equal(r.status,201);return r.json();}
  const bob=await register('Bob'),carol=await register('Carol');
  dom=new JSDOM('<!doctype html><div id="root"></div>',{url:base+'/login',pretendToBeVisual:true});
  for(const name of globals)Object.defineProperty(globalThis,name,{value:dom.window[name],writable:true,configurable:true});
  globalThis.IS_REACT_ACT_ENVIRONMENT=true;dom.window.HTMLElement.prototype.scrollIntoView=function(){};
  const requests=[];globalThis.fetch=(url,options)=>{requests.push(String(url));return nativeFetch(new URL(url,base),options);};
  for(const file of ['components/AuthForm','pages/Login','pages/Register','App']){
    const sourceUrl=new URL('../src/'+file+'.jsx',import.meta.url),tempUrl=new URL('../src/'+file+'.test-tmp.mjs',import.meta.url);
    let source=await readFile(sourceUrl,'utf8');source=source.replaceAll("from './data'","from './data.js'").replaceAll("from './storage'","from './storage.js'");
    source=source.replaceAll("AuthForm.jsx'","AuthForm.test-tmp.mjs'").replaceAll("Login.jsx'","Login.test-tmp.mjs'").replaceAll("Register.jsx'","Register.test-tmp.mjs'");
    await writeFile(tempUrl,(await transform(source,{loader:'jsx',format:'esm'})).code);tempFiles.push(tempUrl);
  }
  const React=await import('react');act=React.act;const {createRoot}=await import('react-dom/client');const {default:App}=await import(new URL('../src/App.test-tmp.mjs',import.meta.url));
  root=createRoot(document.querySelector('#root'));await act(()=>root.render(React.createElement(App)));
  const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
  async function click(el){assert.ok(el,'Expected button');await act(async()=>el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));}
  async function fill(el,value){assert.ok(el,'Expected input');const prototype=el.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});}
  async function submit(form){assert.ok(form);await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));}
  async function until(predicate,message,timeout=7000){const end=Date.now()+timeout;while(Date.now()<end){await act(()=>new Promise(resolve=>setTimeout(resolve,40)));if(predicate())return;}assert.fail(message);}
  async function db(work){let result;await act(async()=>{result=await work();});return result;}
  const compose=()=>document.querySelector('textarea[aria-label="Nội dung tin nhắn"]');
  assert.match(document.body.textContent,/Chào mừng trở lại/);
  await fill(document.querySelector('input[aria-label="Email"]'),'bob@example.com');await fill(document.querySelector('input[aria-label="Mật khẩu"]'),'wrongpass');await submit(document.querySelector('form'));
  await until(()=>document.querySelector('[role="alert"]'),'Login error');assert.match(document.querySelector('[role="alert"]').textContent,/không đúng/);
  await click(button('Đăng ký'));await fill(document.querySelector('input[autocomplete="nickname"]'),'Alice');await fill(document.querySelector('input[aria-label="Email"]'),'alice@example.com');
  await fill(document.querySelector('input[aria-label="Mật khẩu"]'),'password123');await fill(document.querySelector('input[aria-label="Xác nhận mật khẩu"]'),'password123');await submit(document.querySelector('form'));
  await until(()=>document.querySelector('.sidebar-user')?.textContent.includes('Đã kết nối'),'Registered account should connect');
  const alice=await db(()=>User.findOne({email:'alice@example.com'}));assert.ok(alice);assert.ok(sessionStorage.getItem('ptitchat-token'));
  const sb=connect(base,{auth:{token:bob.token},transports:['websocket']});sockets.push(sb);await act(()=>new Promise((resolve,reject)=>{sb.once('connect',resolve);sb.once('connect_error',reject);}));
  const emit=(event,payload)=>new Promise((resolve,reject)=>sb.timeout(5000).emit(event,payload,(e,r)=>e?reject(e):resolve(r)));
  await click(document.querySelector('button[aria-label="Cuộc trò chuyện mới"]'));await fill(document.querySelector('input[aria-label="Tìm thành viên"]'),'bob@example.com');
  await until(()=>requests.some(url=>url.includes('/users/search?q=bob%40example.com')),'Search should call real user API');
  await click([...document.querySelectorAll('.member-choice')].find(el=>el.textContent.includes('Bob')));
  await until(()=>compose(),'Direct conversation should open');
  const direct=await db(()=>Conversation.findOne({type:'direct',members:alice._id}));assert.ok(direct);
  await fill(compose(),'UI real message');await submit(document.querySelector('.composer-area'));
  await until(()=>document.querySelector('[role="log"]')?.textContent.includes('Đã gửi'),'Send acknowledgement');
  const first=await db(()=>Message.findOne({conversationId:direct._id,text:'UI real message'}));assert.ok(first);
  await fill(compose(),'rapid one');await submit(document.querySelector('.composer-area'));
  await fill(compose(),'rapid two');await submit(document.querySelector('.composer-area'));
  await until(()=>JSON.parse(sessionStorage.getItem('ptitchat-outbox:'+alice._id)||'[]').length===0,'Rapid sends should drain the whole outbox');
  assert.equal(await db(()=>Message.countDocuments({conversationId:direct._id,text:{$in:['rapid one','rapid two']}})),2);
  await act(async()=>{assert.equal((await emit('message:seen',{conversationId:String(direct._id),messageIds:[String(first._id)]})).success,true);});
  await until(()=>document.querySelector('[role="log"]')?.textContent.includes('Đã xem'),'Real receipt should show');
  await act(async()=>{await emit('message:send',{conversationId:String(direct._id),text:'Bob inbound',clientTempId:'bob-ui-1'});});
  await until(()=>document.querySelector('[role="log"]')?.textContent.includes('Bob inbound'),'Socket.IO incoming message');
  const inbound=[...document.querySelectorAll('.message-row')].find(el=>el.textContent.includes('Bob inbound'));
  await click([...inbound.querySelectorAll('button')].find(el=>el.textContent==='Trả lời'));await fill(compose(),'UI reply');await submit(document.querySelector('.composer-area'));
  await until(()=>document.querySelectorAll('.reply-preview').length>0,'Reply preview');
  await until(()=>[...document.querySelectorAll('.message-row')].some(el=>el.textContent.includes('UI reply')&&el.textContent.includes('Đã gửi')),'Reply must be acknowledged before checking persistence');
  assert.ok((await db(()=>Message.findOne({text:'UI reply'}))).replyTo);
  const ownRow=[...document.querySelectorAll('.message-row')].find(el=>el.textContent.includes('UI real message'));
  await click([...ownRow.querySelectorAll('button')].find(el=>el.textContent==='Sửa'));await fill(compose(),'Edited via UI');await submit(document.querySelector('.composer-area'));
  await until(()=>document.querySelector('[role="log"]')?.textContent.includes('Edited via UI'),'Edit result');
  const editedRow=[...document.querySelectorAll('.message-row')].find(el=>el.textContent.includes('Edited via UI'));
  await click([...editedRow.querySelectorAll('button')].find(el=>el.textContent==='Thu hồi'));
  await until(()=>document.querySelector('[role="log"]')?.textContent.includes('Tin nhắn đã bị thu hồi'),'Soft revoke UI');assert.equal((await db(()=>Message.findById(first._id))).isRecall,true);
  await click(document.querySelector('button[aria-label="Tìm trong cuộc trò chuyện"]'));await fill(document.querySelector('input[aria-label="Tìm tin nhắn"]'),'Bob inbound');
  await until(()=>requests.some(url=>url.includes('/messages/search?')),'Search should call message API');await until(()=>document.querySelectorAll('.message-row').length===1,'Search result filter');
  await click(document.querySelector('button[aria-label="Đóng tìm kiếm tin nhắn"]'));
  // Lose one acknowledgement after the DB commit, then reconnect the sender.
  let suppress=true;
  for(const s of io.sockets.sockets.values())if(s.userId===String(alice._id))s.use((packet,next)=>{
    if(suppress&&packet[0]==='message:send'&&packet[1].text==='retry once'){
      suppress=false;packet[packet.length-1]=()=>{};s.once('disconnect',()=>{});setTimeout(()=>s.conn.close(),70);
    }next();
  });
  await fill(compose(),'retry once');await submit(document.querySelector('.composer-area'));
  await until(()=>!suppress,'Send should reach server');
  await until(()=>JSON.parse(sessionStorage.getItem('ptitchat-outbox:'+alice._id)||'[]').length===0,'Outbox should retry after reconnection',14000);
  assert.equal(await db(()=>Message.countDocuments({conversationId:direct._id,text:'retry once'})),1);
  assert.equal([...document.querySelectorAll('.message-row')].filter(el=>el.textContent.includes('retry once')).length,1);
  await click(document.querySelector('.create-group'));await fill(document.querySelector('[role="dialog"] input[placeholder^="Ví dụ"]'),'UI Group');
  for(const name of ['Bob','Carol'])await click([...document.querySelectorAll('.member-choice')].find(el=>el.textContent.includes(name)));
  await submit(document.querySelector('[role="dialog"] form'));await until(()=>document.querySelector('.chat-header h2')?.textContent.includes('UI Group'),'Group should open');
  assert.equal((await db(()=>Conversation.findOne({name:'UI Group'}))).members.length,3);
  await click(document.querySelector('button[aria-label="Hồ sơ của tôi"]'));await fill(document.querySelector('[role="dialog"] input.plain-input'),'Alice Updated');await submit(document.querySelector('[role="dialog"] form'));
  await until(()=>document.querySelector('.sidebar-user')?.textContent.includes('Alice Updated'),'Profile update');
  assert.equal((await db(()=>User.findById(alice._id))).displayName,'Alice Updated');
  await click(document.querySelector('button[aria-label="Cài đặt"]'));await click(button('Đăng xuất'));
  await until(()=>document.querySelector('input[aria-label="Email"]'),'Logout must return to auth');assert.equal(sessionStorage.getItem('ptitchat-token'),null);
  // Re-login loads the same MongoDB conversations, not demo/localStorage data.
  await fill(document.querySelector('input[aria-label="Email"]'),'alice@example.com');await fill(document.querySelector('input[aria-label="Mật khẩu"]'),'password123');await submit(document.querySelector('form'));
  await until(()=>[...document.querySelectorAll('.conversation-item')].some(el=>el.textContent.includes('UI Group')),'Stored history should return');
  await act(()=>window.dispatchEvent(new dom.window.Event('ptitchat:expired')));
  assert.ok(document.querySelector('input[aria-label="Email"]'));assert.equal(sessionStorage.getItem('ptitchat-token'),null);
});
