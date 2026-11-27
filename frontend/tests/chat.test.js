import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mergeMessages,toMessage,toUser} from '../src/services/chat.js';

test('server DTOs use MongoDB IDs, attachments, reply masking and real read receipts',()=>{
  assert.equal(toUser({_id:'u1',username:'alice',displayName:'Alice',isOnline:true}).online,true);
  const message=toMessage({_id:'m1',sender:{_id:'u1'},createdAt:'2026-01-01',readBy:[{user:'u2'}],attachments:[{url:'/uploads/a.txt',fileName:'a.txt',mimeType:'text/plain',fileSize:5}],replyTo:{_id:'m0',text:'secret',isRecall:true}});
  assert.equal(message.sender,'u1');assert.equal(message.file.data,'/uploads/a.txt');assert.equal(message.replyTo.text,'Tin nhắn đã bị thu hồi');assert.equal(message.readBy[0].user,'u2');
});
test('delivery, acknowledgement, history reload and queued retries never duplicate a visible message',()=>{
  const pending={id:'temp',clientTempId:'key',sender:'u1',time:'2026-01-01',pending:true};
  const persisted={id:'m1',clientTempId:'key',sender:'u1',time:'2026-01-01'};
  let messages=mergeMessages([pending],[persisted]);assert.equal(messages.length,1);assert.equal(messages[0].id,'m1');
  messages=mergeMessages(messages,[persisted,pending]);assert.equal(messages.length,1);
  const other={...persisted,id:'m2',sender:'u2'};assert.equal(mergeMessages(messages,[other]).length,2);
});
