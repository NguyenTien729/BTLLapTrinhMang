import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,unlink} from 'node:fs/promises';
import {transform} from 'esbuild';
import {JSDOM} from 'jsdom';

test('React UI: login errors, demo, direct message, search, group creation, profile and logout',async t=>{
 const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'http://localhost:5173'});
 globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.HTMLElement=dom.window.HTMLElement;globalThis.localStorage=dom.window.localStorage;globalThis.IS_REACT_ACT_ENVIRONMENT=true;
 Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
 dom.window.HTMLElement.prototype.scrollIntoView=function(){};
 const source=(await readFile(new URL('../src/App.jsx',import.meta.url),'utf8')).replace("from './data'","from './data.js'").replace("from './storage'","from './storage.js'");
 const compiled=await transform(source,{loader:'jsx',format:'esm'});const temp=new URL('../src/.App.test-tmp.mjs',import.meta.url);await writeFile(temp,compiled.code);
 const React=await import('react'),{act}=React,{createRoot}=await import('react-dom/client');const {default:App}=await import(temp.href);const root=createRoot(document.querySelector('#root'));
 t.after(async()=>{await act(()=>root.unmount());await unlink(temp);dom.window.close();delete globalThis.IS_REACT_ACT_ENVIRONMENT;});
 const click=async el=>{assert.ok(el,'Expected clickable element');await act(async()=>el.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));};
 const button=text=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 async function fill(el,value){assert.ok(el,'Expected input');const prototype=el.tagName==='TEXTAREA'?dom.window.HTMLTextAreaElement.prototype:dom.window.HTMLInputElement.prototype;await act(async()=>{Object.getOwnPropertyDescriptor(prototype,'value').set.call(el,value);el.dispatchEvent(new dom.window.Event('input',{bubbles:true}));});}
 const submit=async form=>{await act(async()=>form.dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));};
 await act(()=>root.render(React.createElement(App)));
 assert.match(document.body.textContent,/Chào mừng trở lại/);
 await fill(document.querySelector('input[autocomplete="username"]'),'unknown');await fill(document.querySelector('input[autocomplete="current-password"]'),'wrongpassword');await submit(document.querySelector('form'));assert.match(document.querySelector('[role="alert"]').textContent,/không chính xác/);
 await click(button('Trải nghiệm bản demo'));assert.equal(document.querySelector('.chat-header h2').textContent.trim(),'Đồ án tốt nghiệp 🎓');
 await click([...document.querySelectorAll('.conversation-item')].find(b=>b.textContent.includes('Trần Hoàng Nam')));assert.match(document.querySelector('.chat-header h2').textContent,/Trần Hoàng Nam/);
 await fill(document.querySelector('textarea[aria-label="Nội dung tin nhắn"]'),'Tin nhắn kiểm thử UI');await submit(document.querySelector('.composer-area'));assert.match(document.querySelector('[role="log"]').textContent,/Tin nhắn kiểm thử UI/);assert.match(localStorage.getItem('ptit-state'),/Tin nhắn kiểm thử UI/);
 const search=document.querySelector('input[aria-label="Tìm kiếm cuộc trò chuyện"]');await fill(search,'không tồn tại 123');assert.equal(document.querySelectorAll('.conversation-item').length,0);await fill(search,'');
 await click(document.querySelector('button[aria-label="Tìm trong cuộc trò chuyện"]'));await fill(document.querySelector('input[aria-label="Tìm tin nhắn"]'),'kiểm thử');assert.equal(document.querySelectorAll('.message-row').length,1);
 await click(document.querySelector('.create-group'));await fill(document.querySelector('[role="dialog"] input[placeholder^="Ví dụ"]'),'Nhóm thử nghiệm');const memberButtons=document.querySelectorAll('.member-choice');await click(memberButtons[0]);await click(document.querySelectorAll('.member-choice')[1]);await submit(document.querySelector('[role="dialog"] form'));assert.match(document.querySelector('.chat-header h2').textContent,/Nhóm thử nghiệm/);assert.equal(document.querySelector('[role="dialog"]'),null);
 await fill(document.querySelector('textarea[aria-label="Nội dung tin nhắn"]'),'Xin chào nhóm');await submit(document.querySelector('.composer-area'));assert.match(document.querySelector('[role="log"]').textContent,/Xin chào nhóm/);
 await click(document.querySelector('button[aria-label="Hồ sơ của tôi"]'));await fill(document.querySelector('[role="dialog"] form input.plain-input'),'Tên đã cập nhật');await submit(document.querySelector('[role="dialog"] form'));assert.match(document.querySelector('.sidebar-user').textContent,/Tên đã cập nhật/);assert.equal(JSON.parse(localStorage.getItem('ptit-session')).user.name,'Tên đã cập nhật');
 await click(document.querySelector('button[aria-label="Cài đặt"]'));await click(button('Đăng xuất'));assert.match(document.body.textContent,/Chào mừng trở lại/);assert.equal(localStorage.getItem('ptit-session'),null);
 await click(button('Đăng ký'));await fill(document.querySelector('input[autocomplete="name"]'),'Sinh viên thử nghiệm');await fill(document.querySelector('input[autocomplete="username"]'),'newstudent');const passwords=document.querySelectorAll('input[autocomplete="new-password"]');await fill(passwords[0],'newpass123');await fill(passwords[1],'different');await submit(document.querySelector('form'));assert.match(document.querySelector('[role="alert"]').textContent,/chưa khớp/);await fill(passwords[1],'newpass123');await act(async()=>{document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setTimeout(resolve,50));});assert.match(document.querySelector('.sidebar-user').textContent,/Sinh viên thử nghiệm/);const storedAccount=JSON.parse(localStorage.getItem('ptit-accounts'))[0];assert.ok(storedAccount.passwordHash);assert.equal(storedAccount.password,undefined);
});
