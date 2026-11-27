import {useCallback,useEffect,useRef,useState} from 'react';
import {request,expireSession} from '../services/api.js';
import {createSocket,emitAck} from '../services/socket.js';
import {idOf,toUser,toMessage,toConversation,mergeMessages} from '../services/chat.js';

export default function useChat(session,selected,notify,muted){
  const [data,setData]=useState({people:[],conversations:[]}),[connected,setConnected]=useState(false),[typing,setTyping]=useState([]),[loading,setLoading]=useState(false);
  const socket=useRef(null),selectedRef=useRef(selected),notifyRef=useRef(notify),mutedRef=useRef(muted),dataRef=useRef(data),busy=useRef(false),onlineRef=useRef(null),flushRef=useRef(null);
  selectedRef.current=selected;notifyRef.current=notify;mutedRef.current=muted;dataRef.current=data;
  const userId=session?.user.id,outboxKey='ptitchat-outbox:'+userId;
  function readOutbox(){try{return JSON.parse(sessionStorage.getItem(outboxKey))||[];}catch{return [];}}
  function storeOutbox(items){sessionStorage.setItem(outboxKey,JSON.stringify(items));}
  const upsertPerson=useCallback(user=>setData(d=>({ ...d,people:[...d.people.filter(p=>p.id!==idOf(user)),toUser(onlineRef.current?{...user,isOnline:onlineRef.current.has(idOf(user))}:user)] })),[]);
  const receive=useCallback(raw=>{
    const message=toMessage(raw),conversationId=idOf(raw.conversationId);
    if(typeof raw.sender==='object')upsertPerson(raw.sender);
    setData(d=>({...d,conversations:d.conversations.map(c=>{
      if(c.id!==conversationId)return c;
      const known=c.messages.some(m=>m.id===message.id || m.clientTempId && m.clientTempId===message.clientTempId);
      return {...c,messages:mergeMessages(c.messages,[message]),unread:c.unread+(!known&&message.sender!==userId&&(selectedRef.current!==c.id||document.hidden)?1:0)};
    }).sort((a,b)=>new Date(b.messages.at(-1)?.time||b.createdAt)-new Date(a.messages.at(-1)?.time||a.createdAt))}));
  },[userId,upsertPerson]);
  async function flush(){
    if(busy.current||!socket.current?.connected)return;
    busy.current=true;
    const sendingSocket=socket.current,sendingSocketId=sendingSocket.id;
    try {
      while(sendingSocket===socket.current&&sendingSocket.connected&&readOutbox().length){
        const payload=readOutbox()[0];
        try {
          const message=await emitAck(sendingSocket,'message:send',payload);receive(message);
          storeOutbox(readOutbox().filter(item=>item.clientTempId!==payload.clientTempId));
        }catch(error){
          if(![400,403,404].includes(error.status))throw error;
          storeOutbox(readOutbox().filter(item=>item.clientTempId!==payload.clientTempId));
          setData(d=>({...d,conversations:d.conversations.map(c=>({...c,messages:c.messages.filter(m=>!m.pending||m.clientTempId!==payload.clientTempId)}))}));
          notifyRef.current(error.message);
        }
      }
    }catch(error){notifyRef.current(error.message+' Tin chưa gửi được vẫn được giữ để thử lại.');}
    finally{busy.current=false;if(socket.current?.connected&&socket.current.id!==sendingSocketId)flushRef.current();}
  }
  flushRef.current=flush;
  const loadHistory=useCallback(async(conversationId,page=1)=>{
    const {data:history}=await request('/messages/'+conversationId+'?page='+page+'&limit=30');
    for(const m of history.messages)if(typeof m.sender==='object')upsertPerson(m.sender);
    setData(d=>({...d,conversations:d.conversations.map(c=>c.id===conversationId?{
      ...c,messages:mergeMessages(page===1?c.messages.filter(m=>m.pending):c.messages,history.messages.map(toMessage)),page,totalPages:history.totalPages,
    }:c)}));
  },[upsertPerson]);
  const refresh=useCallback(async()=>{
    const [users,conversations]=await Promise.all([request('/users'),request('/conversations')]);
    setData(d=>({people:[...new Map([...d.people,...users.data.map(toUser),session.user].map(p=>[p.id,onlineRef.current?{...p,online:onlineRef.current.has(p.id)}:p])).values()],conversations:conversations.data.map(c=>toConversation(c,d.conversations.find(old=>old.id===idOf(c))))}));
    if(selectedRef.current)await loadHistory(selectedRef.current);
  },[session?.token,loadHistory]);
  const upsertConversation=useCallback(raw=>{
    for(const member of raw.members)if(typeof member==='object')upsertPerson(member);
    setData(d=>{
      const previous=d.conversations.find(c=>c.id===idOf(raw)),conversation=toConversation(raw,previous);
      return {...d,conversations:previous?d.conversations.map(c=>c.id===conversation.id?conversation:c):[conversation,...d.conversations]};
    });
  },[upsertPerson]);
  useEffect(()=>{
    if(!session){setData({people:[],conversations:[]});return;}
    let active=true;const s=createSocket(session.token);socket.current=s;
    const notified=new Set(),typingTimers=new Map();
    const updatePresence=({userId,isOnline,lastSeen})=>{if(onlineRef.current){if(isOnline)onlineRef.current.add(userId);else onlineRef.current.delete(userId);}setData(d=>({...d,people:d.people.map(p=>p.id===userId?{...p,online:isOnline,isOnline,lastSeen:lastSeen||p.lastSeen}:p)}));};
    s.on('connect',async()=>{
      setConnected(true);setLoading(true);
      try{await refresh();if(!active)return;if(selectedRef.current)await emitAck(s,'conversation:join',{conversationId:selectedRef.current});await flush();}
      catch(e){if(active)notifyRef.current(e.message);}finally{if(active)setLoading(false);}
    });
    s.on('disconnect',()=>{setConnected(false);setTyping([]);});
    s.on('connect_error',error=>{setConnected(false);if(/token|tài khoản/i.test(error.message))expireSession();});
    s.on('auth:expired',expireSession);
    for(const event of ['message:new','message:edited','message:revoked'])s.on(event,raw=>{
      receive(raw);
      if(event==='message:revoked')setData(d=>({...d,conversations:d.conversations.map(c=>({...c,messages:c.messages.map(m=>m.replyTo?.id===idOf(raw)?{...m,replyTo:{...m.replyTo,text:'Tin nhắn đã bị thu hồi',isRecall:true}}:m)}))}));
    });
    s.on('notification:new',({conversationId,message})=>{
      if(notified.has(idOf(message)))return;notified.add(idOf(message));
      if(notified.size>500)notified.delete(notified.values().next().value);
      if((selectedRef.current!==conversationId||document.hidden)&&!mutedRef.current.includes(conversationId))notifyRef.current((message.sender?.displayName||message.sender?.username||'Bạn bè')+': '+(message.isRecall?'Tin nhắn đã thu hồi':message.text||'Đã gửi tệp đính kèm'));
      if(!dataRef.current.conversations.some(c=>c.id===conversationId))refresh().catch(e=>notifyRef.current(e.message));
    });
    s.on('conversation:updated',upsertConversation);
    s.on('conversation:removed',({conversationId})=>setData(d=>({...d,conversations:d.conversations.filter(c=>c.id!==conversationId)})));
    s.on('profile:updated',upsertPerson);s.on('user:new',upsertPerson);
    s.on('user:online',data=>updatePresence({...data,isOnline:true}));
    s.on('user:offline',data=>updatePresence({...data,isOnline:false}));
    s.on('presence:list',({onlineUserIds})=>{onlineRef.current=new Set(onlineUserIds);setData(d=>({...d,people:d.people.map(p=>({...p,online:onlineUserIds.includes(p.id),isOnline:onlineUserIds.includes(p.id)}))}));});
    s.on('message:seen',({conversationId,userId:reader,seenAt,messageIds=[]})=>setData(d=>({...d,conversations:d.conversations.map(c=>c.id!==conversationId?c:{...c,unread:reader===userId?Math.max(0,c.unread-messageIds.length):c.unread,messages:c.messages.map(m=>messageIds.includes(m.id)&&!m.readBy?.some(r=>idOf(r.user)===reader)?{...m,readBy:[...(m.readBy||[]),{user:reader,readAt:seenAt}]}:m)})})));
    s.on('typing:start',value=>{
      clearTimeout(typingTimers.get(value.userId));setTyping(old=>[...old.filter(t=>t.userId!==value.userId),value]);
      typingTimers.set(value.userId,setTimeout(()=>setTyping(old=>old.filter(t=>t.userId!==value.userId)),4000));
    });
    s.on('typing:stop',value=>setTyping(old=>old.filter(t=>t.userId!==value.userId)));
    s.connect();
    return()=>{active=false;s.disconnect();socket.current=null;setConnected(false);for(const timer of typingTimers.values())clearTimeout(timer);};
  },[session?.token]);
  useEffect(()=>{
    if(!session||!selected)return;
    let active=true;setLoading(true);
    loadHistory(selected).catch(e=>{if(active)notifyRef.current(e.message);}).finally(()=>{if(active)setLoading(false);});
    if(socket.current?.connected)emitAck(socket.current,'conversation:join',{conversationId:selected}).catch(e=>notifyRef.current(e.message));
    return()=>{active=false;socket.current?.emit('conversation:leave',{conversationId:selected});};
  },[selected,session?.token]);
  const activeConversation=data.conversations.find(c=>c.id===selected);
  const unseen=(activeConversation?.page?activeConversation.messages:[]).filter(m=>!m.pending&&m.sender!==userId&&!m.readBy?.some(r=>idOf(r.user)===userId)).map(m=>m.id).slice(0,100).join(',');
  useEffect(()=>{
    const seen=()=>{if(!document.hidden&&connected&&unseen)emitAck(socket.current,'message:seen',{conversationId:selected,messageIds:unseen.split(',')}).catch(e=>notifyRef.current(e.message));};
    seen();document.addEventListener('visibilitychange',seen);return()=>document.removeEventListener('visibilitychange',seen);
  },[selected,unseen,connected]);
  function sendMessage(payload){
    const item={...payload,clientTempId:crypto.randomUUID(),createdAt:new Date().toISOString()};storeOutbox([...readOutbox(),item]);
    const message=toMessage({...item,_id:item.clientTempId,sender:userId,createdAt:new Date().toISOString(),pending:true});
    setData(d=>({...d,conversations:d.conversations.map(c=>c.id===payload.conversationId?{...c,messages:mergeMessages(c.messages,[message])}:c)}));
    flush();
  }
  useEffect(()=>{
    if(!userId||!data.conversations.length)return;
    const queued=readOutbox().map(p=>toMessage({...p,_id:p.clientTempId,sender:userId,createdAt:p.createdAt||new Date().toISOString(),pending:true}));
    if(queued.length)setData(d=>({...d,conversations:d.conversations.map(c=>({...c,messages:mergeMessages(c.messages,queued.filter(m=>m.conversationId===c.id))}))}));
  },[userId,data.conversations.length]);
  return {data,setData,connected,typing,loading,socket,sendMessage,retry:flush,loadHistory,upsertPerson,upsertConversation,receive,refresh};
}
