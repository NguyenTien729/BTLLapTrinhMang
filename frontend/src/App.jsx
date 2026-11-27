<<<<<<< HEAD
import React,{useEffect,useRef,useState} from 'react';
import {MessageCircle,Users,Settings,LogOut,Search,Plus,ChevronDown,ChevronRight,ArrowRight,ArrowLeft,Send,Paperclip,Image as ImageIcon,Smile,Check,CheckCheck,X,Info,FileText,Download,MoreHorizontal,Pin,Bell,BellOff,User,Lock,Eye,EyeOff,Mail,Hash,GraduationCap,ShieldCheck,Globe,LoaderCircle,PanelRightClose,Menu,Link,Camera,CheckCircle2} from 'lucide-react';

import {initials,timeText,sizeText,normalize} from './data';
import {load} from './storage';
import {request,uploadFile} from './services/api.js';
import {idOf,toMessage,mergeMessages} from './services/chat.js';
import useSession from './hooks/useSession.js';
import useChat from './hooks/useChat.js';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';

const uid=()=>crypto.randomUUID();
function Avatar({person,group,size='',online=false,onClick}){return <span onClick={onClick} className={`avatar ${group?'group-avatar':''} ${size}`} style={{'--avatar-color':group?.color||person?.color||'#a6828f'}}>{group?<Users size={size==='large'?30:21}/>:person?.avatar?<img src={person.avatar} alt={person.name}/>:initials(person?.name)}{online&&<i className={person?.online?'presence online':'presence'}/>}</span>;}
function IconButton({children,label,onClick,className='',...props}){return <button className={`icon-btn ${className}`} title={label} aria-label={label} onClick={onClick} {...props}>{children}</button>;}
function Brand({light=false}){return <div className={`brand ${light?'light':''}`}><span className="brand-symbol"><MessageCircle size={25} strokeWidth={2.2}/><i/></span><span>PTIT<span className="brand-chat">Chat</span><small>KẾT NỐI KHÔNG KHOẢNG CÁCH</small></span></div>;}
function Modal({title,children,onClose,wide=false}){const ref=useRef();useEffect(()=>{const before=document.activeElement;const el=ref.current;const nodes=()=>el?.querySelectorAll('button,input,textarea,select,a[href]');nodes()?.[0]?.focus();function key(e){if(e.key==='Escape')onClose();if(e.key==='Tab'){const items=[...(nodes()||[])].filter(n=>!n.disabled);const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);before?.focus();};},[]);return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><section ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide?'wide':''}`}><div className="modal-title"><h2>{title}</h2><IconButton label="Đóng" onClick={onClose}><X size={21}/></IconButton></div>{children}</section></div>;}

function FileAttachment({file,onOpen}){return <button className="file-card" onClick={()=>onOpen(file)}><span className={`file-icon ${file.type?.includes('pdf')?'pdf':''}`}><FileText size={23}/><small>{file.type?.includes('pdf')?'PDF':'FILE'}</small></span><span className="file-label"><b>{file.name}</b><small>{sizeText(file.size)} · {file.type?.includes('pdf')?'Tài liệu PDF':'Tệp đính kèm'}</small></span><Download size={17}/></button>;}
function StoredImage({file,onClick,className=''}){return file?.data?<img className={className} src={file.data} alt={file.name||'Ảnh đã chia sẻ'} onClick={()=>onClick?.(file.data)}/>:<span className="image-placeholder">Không tải được ảnh</span>;}
export default function App(){
 const {session,loading:sessionLoading,login,logout,updateUser}=useSession();
 const [authRegister,setAuthRegister]=useState(()=>location.pathname==='/register');
 const [selected,setSelected]=useState(null),[tab,setTab]=useState('all'),[query,setQuery]=useState(''),[draft,setDraft]=useState(''),[modal,setModal]=useState(null),[right,setRight]=useState(()=>window.innerWidth>1050),[mobileChat,setMobileChat]=useState(false),[nav,setNav]=useState('messages'),[toast,setToast]=useState(''),[chatSearch,setChatSearch]=useState(false),[messageQuery,setMessageQuery]=useState(''),[emoji,setEmoji]=useState(false),[pending,setPending]=useState(null),[sending,setSending]=useState(false),[muted,setMuted]=useState(()=>load('ptitchat-muted',[]));
 const [groupName,setGroupName]=useState(''),[chosen,setChosen]=useState([]),[memberQuery,setMemberQuery]=useState(''),[modalError,setModalError]=useState(''),[profile,setProfile]=useState({}),[groupDescription,setGroupDescription]=useState('');
 const [replying,setReplying]=useState(null),[editing,setEditing]=useState(null),[searchResults,setSearchResults]=useState(null),[searchPage,setSearchPage]=useState(1),[searchTotalPages,setSearchTotalPages]=useState(0);
 const bottom=useRef(),fileInput=useRef(),imageInput=useRef(),textInput=useRef(),typingTimeout=useRef(),avatarInput=useRef();
 const notify=msg=>setToast(msg);
 const {data,setData,connected,typing,loading,socket,sendMessage,retry,loadHistory,upsertPerson,upsertConversation,receive}=useChat(session,selected,notify,muted);
 const me=session?.user,server=true;
 const selectedRevision=(data.conversations.find(c=>c.id===selected)?.messages||[]).map(m=>m.id+':'+m.text+':'+m.isRecall).join('|');
 useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(''),5000);return()=>clearTimeout(t);},[toast]);
 useEffect(()=>{if(!session){setAuthRegister(location.pathname==='/register');setModal(null);setSelected(null);setDraft('');setReplying(null);setEditing(null);setToast('');}},[session?.token]);
 useEffect(()=>{bottom.current?.scrollIntoView({behavior:'smooth'});},[selected,data.conversations.find(c=>c.id===selected)?.messages.length,pending]);
 useEffect(()=>{setDraft('');setPending(null);setMessageQuery('');setChatSearch(false);setEmoji(false);setReplying(null);setEditing(null);setSearchResults(null);},[selected]);
 useEffect(()=>()=>clearTimeout(typingTimeout.current),[]);
 useEffect(()=>{
   if(!session)return;
   const q=modal==='new'||modal==='group'?memberQuery:nav==='contacts'?query:'';
   if(!q.trim())return;
   const controller=new AbortController();
   const timer=setTimeout(()=>request('/users/search?q='+encodeURIComponent(q.trim()),{signal:controller.signal}).then(({users})=>users.forEach(upsertPerson)).catch(e=>{if(e.name!=='AbortError')notify(e.message);}),250);
   return()=>{clearTimeout(timer);controller.abort();};
 },[memberQuery,query,nav,modal,session?.token]);
 useEffect(()=>{
   setSearchResults(null);setSearchPage(1);setSearchTotalPages(0);
   if(!session||!selected||!messageQuery.trim())return;
   const controller=new AbortController();
   const timer=setTimeout(()=>request('/messages/search?conversationId='+selected+'&q='+encodeURIComponent(messageQuery.trim())+'&limit=30',{signal:controller.signal}).then(({data:result})=>{setSearchResults(result.messages.map(toMessage));setSearchTotalPages(result.totalPages);}).catch(e=>{if(e.name!=='AbortError')notify(e.message);}),250);
   return()=>{clearTimeout(timer);controller.abort();};
 },[messageQuery,selected,selectedRevision,session?.token]);
 async function moreSearch(){
   try{const {data:result}=await request('/messages/search?conversationId='+selected+'&q='+encodeURIComponent(messageQuery.trim())+'&limit=30&page='+(searchPage+1));setSearchResults(old=>mergeMessages(old||[],result.messages.map(toMessage)));setSearchPage(result.page);}catch(e){notify(e.message);}
 }
 const person=id=>data.people.find(p=>p.id===id)||{id,name:'Người dùng',username:'',color:'#987b8a'};
 const conversations=data.conversations.filter(c=>c.members.includes(me?.id));
 const active=conversations.find(c=>c.id===selected);
 const other=c=>person(c.members.find(id=>id!==me?.id));
 const title=c=>c?.type==='group'?c.name:other(c).name;
 const visible=conversations.filter(c=>(tab!=='unread'||c.unread>0)&&(tab!=='groups'||c.type==='group')&&normalize(title(c)).includes(normalize(query)));
 const activeMembers=active?.members.map(person)||[];
 const messages=messageQuery.trim()?(searchResults||[]):active?.messages||[];
 const files=(active?.messages||[]).filter(m=>m.file&&!m.file.type?.startsWith('image/'));
 const photos=(active?.messages||[]).filter(m=>m.file?.type?.startsWith('image/'));
 const onlinePeople=data.people.filter(p=>p.id!==me?.id&&p.online),onlineLabel='Đang hoạt động';
 function openConversation(c){setSelected(c.id);setMobileChat(true);setNav('messages');}
 function openModal(type){setModalError('');setMemberQuery('');setChosen([]);setGroupName('');setModal(type);if(type==='profile')setProfile({...me});if(type==='editgroup'){setGroupName(active?.name||'');setGroupDescription(active?.description||'');}}
 async function createConversation(type,members,name){
   setModalError('');
   try{const {data:c}=await request(type==='group'?'/conversations/group':'/conversations',{method:'POST',body:type==='group'?{members,name}:{recipientId:members[0]}});
   upsertConversation(c);setSelected(idOf(c));setMobileChat(true);setModal(null);setNav('messages');}catch(e){setModalError(e.message);notify(e.message);}
 }
 async function send(e){
   e?.preventDefault();if(!active||sending||(!draft.trim()&&!pending))return;
   setSending(true);
   try{
     if(editing){const {data:m}=await request('/messages/'+editing.id,{method:'PATCH',body:{text:draft.trim()}});receive(m);setEditing(null);}
     else {const attachments=pending?[await uploadFile(pending)]:[];sendMessage({conversationId:active.id,text:draft.trim(),attachments,replyTo:replying?.id||null});}
     setDraft('');setPending(null);setReplying(null);setEmoji(false);socket.current?.emit('typing:stop',{conversationId:active.id});textInput.current?.focus();
   }catch(e){notify(e.message);}finally{setSending(false);}
 }
 function changeDraft(value){
   setDraft(value);if(active&&connected){socket.current?.emit('typing:start',{conversationId:active.id});clearTimeout(typingTimeout.current);typingTimeout.current=setTimeout(()=>socket.current?.emit('typing:stop',{conversationId:active.id}),1800);}
 }
 function attach(e){const f=e.target.files?.[0];if(f){if(f.size>25*1024*1024)notify('Tệp tối đa 25 MB.');else setPending(f);}e.target.value='';}
 async function download(file){try{const response=await fetch(file.data);if(!response.ok)throw new Error('Không tải được tệp.');const blob=await response.blob(),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){notify(e.message);}}
 async function saveProfile(e){
   e.preventDefault();setModalError('');
   try{
     let avatar=profile.avatar||'';
     if(avatar.startsWith('data:')){const blob=await(await fetch(avatar)).blob();const file=new File([blob],'avatar.'+(blob.type.split('/')[1]||'png'),{type:blob.type});avatar=(await uploadFile(file)).url;}
     const {user}=await request('/users/me',{method:'PUT',body:{displayName:profile.name.trim(),avatar,bio:profile.bio||'',studentId:profile.studentId||''}});
     updateUser(user);upsertPerson(user);setModal(null);notify('Hồ sơ đã được cập nhật.');
   }catch(e){setModalError(e.message);}
 }
 async function updateGroup(e){
   e.preventDefault();try{const {data:c}=await request('/conversations/'+active.id,{method:'PATCH',body:{name:groupName.trim(),description:groupDescription}});upsertConversation(c);setModal(null);}catch(e){setModalError(e.message);}
 }
 async function revokeMessage(message){
   try{const {data:m}=await request('/messages/'+message.id,{method:'DELETE'});receive(m);setSearchResults(old=>old?.map(item=>item.id===m._id?toMessage(m):item));}catch(e){notify(e.message);}
 }
 function startEdit(message){setEditing(message);setReplying(null);setPending(null);setDraft(message.text);textInput.current?.focus();}
 function cancelCompose(){setEditing(null);setReplying(null);setDraft('');}
 function toggleMute(){const next=muted.includes(selected)?muted.filter(id=>id!==selected):[...muted,selected];setMuted(next);localStorage.setItem('ptitchat-muted',JSON.stringify(next));notify(next.includes(selected)?'Đã tắt thông báo cuộc trò chuyện':'Đã bật thông báo cuộc trò chuyện');}
 function switchAuth(register){setAuthRegister(register);history.replaceState(null,'',register?'/register':'/login');}
 if(sessionLoading)return <div className="loading-screen" role="status">Đang kiểm tra phiên đăng nhập...</div>;
 if(!session){const Page=authRegister?Register:Login;return <Page onLogin={login} onSwitch={switchAuth}/>;}
 return <div className={`app-shell ${mobileChat?'mobile-chat-open':''} ${right?'has-details':''}`}>
  <nav className="nav-rail" aria-label="Điều hướng chính"><button className="rail-logo" title="PTITChat" onClick={()=>{setNav('messages');setTab('all');setQuery('');setMobileChat(false);}}><MessageCircle size={30}/><i/></button><div className="rail-links"><IconButton label="Tin nhắn" className={nav==='messages'?'active':''} onClick={()=>{setNav('messages');setTab('all');setQuery('');setMobileChat(false);}}><MessageCircle size={23}/><span className="rail-notification"/></IconButton><IconButton label="Danh bạ" className={nav==='contacts'?'active':''} onClick={()=>{setNav('contacts');setMobileChat(false);}}><Users size={23}/></IconButton><IconButton label="Nhóm của tôi" className={nav==='groups'?'active':''} onClick={()=>{setNav('groups');setTab('groups');setMobileChat(false);}}><GraduationCap size={24}/></IconButton></div><div className="rail-bottom"><IconButton label="Cài đặt" onClick={()=>openModal('settings')}><Settings size={22}/></IconButton><button className="rail-profile" aria-label="Hồ sơ của tôi" onClick={()=>openModal('profile')}><Avatar person={me} size="small"/></button></div></nav>
  <aside className="conversation-panel"><header className="sidebar-brand"><Brand/><span className="beta">BETA</span></header><div className="conversations-heading"><div><span className="section-eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>{nav==='contacts'?'Danh bạ':nav==='groups'?'Nhóm của tôi':'Tin nhắn'}<span>{nav==='contacts'?data.people.length-1:conversations.length}</span></h1></div><IconButton className="new-chat" label={nav==='groups'?'Tạo nhóm':'Cuộc trò chuyện mới'} onClick={()=>openModal(nav==='groups'?'group':'new')}><Plus size={21}/></IconButton></div><div className="sidebar-search"><Search size={17}/><input aria-label="Tìm kiếm cuộc trò chuyện" placeholder={nav==='contacts'?'Tìm kiếm bạn bè...':'Tìm kiếm cuộc trò chuyện...'} value={query} onChange={e=>setQuery(e.target.value)}/>{query&&<IconButton label="Xóa tìm kiếm" onClick={()=>setQuery('')}><X size={14}/></IconButton>}</div>
  {nav==='contacts'?<div className="contact-list">{data.people.filter(p=>p.id!==me.id&&normalize(p.name+' '+p.username+' '+(p.email||'')).includes(normalize(query))).map(p=><button className="contact-row" key={p.id} onClick={()=>createConversation('direct',[p.id])}><Avatar person={p} online/><span><b>{p.name}</b><small>@{p.username} · {p.online?'Online':'Offline'}</small></span><MessageCircle size={18}/></button>)}</div>:<><div className="conversation-tabs">{[['all','Tất cả'],['unread','Chưa đọc'],['groups','Nhóm']].map(([key,label])=><button key={key} className={tab===key?'active':''} onClick={()=>setTab(key)}>{label}{key==='unread'&&<span>{conversations.filter(c=>c.unread>0).length}</span>}</button>)}</div><div className="conversation-scroll">{visible.some(c=>c.pinned)&&<div className="list-label"><Pin size={12}/> ĐÃ GHIM</div>}{[...visible.filter(c=>c.pinned),...visible.filter(c=>!c.pinned)].map((c,i)=><React.Fragment key={c.id}>{!c.pinned&&(i===0||visible.filter(x=>x.pinned).length===i)&&<div className="list-label">CUỘC TRÒ CHUYỆN</div>}<button className={`conversation-item ${c.id===selected?'selected':''}`} onClick={()=>openConversation(c)}><Avatar person={c.type==='direct'?other(c):null} group={c.type==='group'?c:null} online={c.type==='direct'}/><span className="conversation-text"><span className="conversation-name"><b>{title(c)}{c.emoji&&<em>{c.emoji}</em>}</b><time>{c.messages.length?timeText(c.messages.at(-1).time):'Mới'}</time></span><span className="conversation-preview"><span>{c.messages.at(-1)?.sender===me.id?'Bạn: ':''}{c.messages.at(-1)?.text||c.messages.at(-1)?.file?.name||'Bắt đầu cuộc trò chuyện'}</span>{c.unread>0?<b className="unread-badge">{c.unread}</b>:c.pinned?<Pin size={12}/>:null}</span></span></button></React.Fragment>)}{!visible.length&&<div className="empty-small"><Search size={28}/><p>{tab==='unread'?'Bạn đã đọc tất cả tin nhắn!':'Không tìm thấy cuộc trò chuyện'}</p><button onClick={()=>openModal('new')}>Bắt đầu trò chuyện mới</button></div>}</div></>}
  <div className="online-section"><div className="online-title"><span><i/> ĐANG HOẠT ĐỘNG</span><span>{onlinePeople.length}</span></div><div className="online-avatars">{onlinePeople.slice(0,5).map(p=><button key={p.id} onClick={()=>createConversation('direct',[p.id])} title={p.name}><Avatar person={p} online size="small"/><span>{p.name.split(' ').at(-1)}</span></button>)}</div></div><button className="create-group" onClick={()=>openModal('group')}><span><Users size={19}/></span><div><b>Cùng nhau kết nối</b><small>Tạo nhóm, chia sẻ nhiều hơn</small></div><Plus size={18}/></button><button className="sidebar-user" onClick={()=>openModal('profile')}><Avatar person={{...me,online:server?connected:true}} size="small" online/><span><b>{me.name}</b><small><i/>{server?(connected?'Đã kết nối':'Đang kết nối...'):'Chế độ trải nghiệm'}</small></span><MoreHorizontal size={20}/></button></aside>
  <main className="chat-panel">{!active?<div className="welcome-chat"><span className="welcome-icon"><MessageCircle size={38}/></span><span className="section-eyebrow">PTITCHAT · KẾT NỐI KHÔNG KHOẢNG CÁCH</span><h2>Một lời chào, một kết nối mới.</h2><p>Chọn một cuộc trò chuyện hoặc tìm bạn bè<br/>để bắt đầu chia sẻ những điều thú vị.</p><button className="primary" onClick={()=>openModal('new')}><Plus size={18}/>Bắt đầu trò chuyện</button></div>:<><header className="chat-header"><IconButton label="Quay lại danh sách" className="mobile-back" onClick={()=>setMobileChat(false)}><ArrowLeft size={21}/></IconButton><Avatar person={active.type==='direct'?other(active):null} group={active.type==='group'?active:null} online={active.type==='direct'}/><div className="chat-header-title"><h2>{title(active)} {active.emoji}<ChevronDown size={16} onClick={()=>setRight(!right)}/></h2><p>{active.type==='group'?<><span className="status-dot"/>{active.members.length} thành viên<span className="dot-separator">·</span>{activeMembers.filter(p=>p.online).length} đang hoạt động</>:<><span className={`status-dot ${other(active).online?'':'offline'}`}/>{other(active).online?onlineLabel:'Offline'}</>}</p></div><div className="chat-header-actions"><IconButton label="Tìm trong cuộc trò chuyện" className={chatSearch?'tinted':''} onClick={()=>{setChatSearch(!chatSearch);setMessageQuery('');}}><Search size={21}/></IconButton><span className="header-divider"/><IconButton label={right?'Ẩn thông tin cuộc trò chuyện':'Thông tin cuộc trò chuyện'} className={right?'tinted':''} onClick={()=>setRight(!right)}><Info size={21}/></IconButton></div></header>
  {chatSearch&&<div className="message-search"><Search size={18}/><input autoFocus placeholder="Tìm nội dung tin nhắn hoặc tên tệp..." aria-label="Tìm tin nhắn" value={messageQuery} onChange={e=>setMessageQuery(e.target.value)}/><small>{messages.length} kết quả</small><IconButton label="Đóng tìm kiếm tin nhắn" onClick={()=>{setChatSearch(false);setMessageQuery('');}}><X size={18}/></IconButton></div>}
  <div className="pinned-note"><span><Pin size={15}/></span><p><b>Một nhóm nhỏ, những ý tưởng lớn</b><span> Cùng chia sẻ và giữ kết nối mỗi ngày nhé! ✨</span></p><ChevronRight size={16}/></div>
  <div className="messages" role="log" aria-label="Tin nhắn" aria-live="polite"><div className="chat-start">{loading&&<span role="status">Đang tải tin nhắn...</span>}{!messageQuery&&active.page>0&&active.page<active.totalPages&&<button className="load-history" onClick={()=>loadHistory(active.id,active.page+1).catch(e=>notify(e.message))}>Tải tin nhắn cũ hơn</button>}{messageQuery&&searchPage<searchTotalPages&&<button className="load-history" onClick={moreSearch}>Tải thêm kết quả tìm kiếm</button>}<span><ShieldCheck size={12}/> Cuộc trò chuyện riêng tư của bạn</span></div>{messages.map((m,index)=>{const own=m.sender===me.id;const previous=messages[index-1];const newDay=!previous||new Date(previous.time).toDateString()!==new Date(m.time).toDateString();return <React.Fragment key={m.id}>{newDay&&<div className="date-divider"><span>{new Date(m.time).toDateString()===new Date().toDateString()?'Hôm nay':new Date(m.time).toLocaleDateString('vi-VN',{day:'numeric',month:'long',year:'numeric'})}</span></div>}<article className={`message-row ${own?'own':''}`}>
  {!own&&<Avatar person={person(m.sender)} size="message-avatar"/>}<div className="message-content">{!own&&active.type==='group'&&<div className="sender-name">{person(m.sender).name}</div>}<div className={`bubble ${m.file?'has-file':''} ${m.isRecall?'recalled':''}`}>{m.replyTo&&<blockquote className="reply-preview">{m.replyTo.isRecall?'Tin nhắn đã bị thu hồi':m.replyTo.text||'Tệp đính kèm'}</blockquote>}{m.text&&<p>{m.text}</p>}{m.files?.slice(1).map(file=><FileAttachment key={file.url} file={file} onOpen={download}/>)}{m.file&&(m.file.type?.startsWith('image/')?<StoredImage className="message-image" file={m.file} onClick={src=>setModal({type:'image',src,name:m.file.name})}/>:<FileAttachment file={m.file} onOpen={download}/>)}{m.image&&<img className="message-image" src={m.image} alt="Khoảnh khắc sân trường, chia sẻ bởi Hoàng Nam" onClick={()=>setModal({type:'image',src:m.image,name:'Khoảnh khắc sân trường'})}/>}</div><div className="message-time">{timeText(m.time)}{m.isEdited&&<span> · Đã sửa</span>}{own&&(m.pending?<span> · Chờ gửi</span>:m.readBy?.some(r=>idOf(r.user)!==me.id)?<span title="Đã xem"><CheckCheck size={14}/> Đã xem</span>:<span title="Đã gửi"><Check size={14}/> Đã gửi</span>)}</div>{!m.isRecall&&!m.pending&&<div className="message-actions"><button onClick={()=>{setReplying(m);setEditing(null);textInput.current?.focus();}}>Trả lời</button>{own&&<><button onClick={()=>startEdit(m)}>Sửa</button><button onClick={()=>revokeMessage(m)}>Thu hồi</button></>}</div>}{m.pending&&<button className="retry-send" onClick={retry}>Thử gửi lại</button>}</div></article></React.Fragment>;})}{!messages.length&&<div className="empty-messages"><MessageCircle size={35}/><h3>{messageQuery?'Chưa tìm thấy tin nhắn':'Câu chuyện bắt đầu từ bạn'}</h3><p>{messageQuery?'Thử tìm với một từ khóa khác nhé.':'Gửi một lời chào để bắt đầu cuộc trò chuyện 👋'}</p></div>}{typing.some(t=>t.conversationId===selected&&t.userId!==me.id)&&<div className="typing-indicator">{typing.filter(t=>t.conversationId===selected&&t.userId!==me.id).map(t=>person(t.userId).name.split(' ').at(-1)).join(', ')} đang nhập<span>•••</span></div>}<div ref={bottom}/></div>
  <form className="composer-area" onSubmit={send}>{(replying||editing)&&<div className="compose-reference"><span>{editing?'Sửa tin nhắn: ':'Trả lời: '}{(editing||replying).text||'Tệp đính kèm'}</span><button type="button" aria-label="Hủy sửa hoặc trả lời" onClick={cancelCompose}><X size={16}/></button></div>}{pending&&<div className="attachment-preview"><Paperclip size={18}/><div><b>{pending.name}</b><small>{sizeText(pending.size)}</small></div><IconButton label="Bỏ tệp đính kèm" onClick={()=>setPending(null)} type="button"><X size={17}/></IconButton></div>}<div className="composer"><div className="composer-tools"><IconButton type="button" label="Đính kèm tệp" onClick={()=>fileInput.current.click()}><Paperclip size={20}/></IconButton><IconButton type="button" label="Gửi ảnh" onClick={()=>imageInput.current.click()}><ImageIcon size={20}/></IconButton></div><textarea ref={textInput} aria-label="Nội dung tin nhắn" placeholder={`Nhắn tin ${active.type==='group'?'cho nhóm':'cho '+other(active).name.split(' ').at(-1)}...`} value={draft} rows={1} maxLength={4000} onChange={e=>changeDraft(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}/><div className="emoji-container"><IconButton type="button" label="Chọn biểu tượng cảm xúc" onClick={()=>setEmoji(!emoji)}><Smile size={21}/></IconButton>{emoji&&<div className="emoji-picker">{['😊','❤️','👍','🎉','😂','✨','🙌','🔥','👋','🚀','💯','🎓','🥰','😎','✅','🤔'].map(s=><button key={s} type="button" onClick={()=>{setDraft(d=>d+s);setEmoji(false);textInput.current?.focus();}}>{s}</button>)}</div>}</div><button className="send-button" type="submit" title="Gửi tin nhắn" aria-label="Gửi tin nhắn" disabled={sending||(!draft.trim()&&!pending)}>{sending?<LoaderCircle className="spin" size={18}/>:<Send size={19}/>}</button></div><div className="composer-footer"><span><ShieldCheck size={12}/>{server?(connected?'Đã kết nối Socket.IO':'Đang kết nối lại máy chủ...'):'Không gian trò chuyện dành cho sinh viên PTIT'}</span><span><b>Enter</b> để gửi · <b>Shift + Enter</b> để xuống dòng</span></div></form></>}
  <input hidden type="file" ref={fileInput} onChange={attach}/><input hidden type="file" accept="image/*" ref={imageInput} onChange={attach}/></main>
  {active&&right&&<aside className="details-panel"><div className="details-title"><h3>Thông tin {active.type==='group'?'nhóm':'cuộc trò chuyện'}</h3><IconButton label="Ẩn thông tin" onClick={()=>setRight(false)}><PanelRightClose size={18}/></IconButton></div><div className="group-profile"><div className="profile-avatar-wrap"><Avatar person={active.type==='direct'?other(active):null} group={active.type==='group'?active:null} size="large"/><span>{active.type==='group'?'🎓':'✨'}</span></div><h2>{title(active)}</h2><p>{active.type==='group'?`${active.members.length} thành viên · Nhóm học tập`:`@${other(active).username}`}</p><div className="group-actions"><button onClick={toggleMute}><span>{muted.includes(selected)?<BellOff size={18}/>:<Bell size={18}/>}</span>{muted.includes(selected)?'Bật thông báo':'Thông báo'}</button><button onClick={()=>{setChatSearch(true);setMessageQuery('');}}><span><Search size={18}/></span>Tìm kiếm</button><button onClick={()=>active.type==='group'?openModal('editgroup'):setModal({type:'person',person:other(active)})}><span>{active.type==='group'?<Settings size={18}/>:<User size={18}/>}</span>{active.type==='group'?'Chỉnh sửa':'Hồ sơ'}</button></div></div><div className="detail-section about"><h4>Giới thiệu</h4><p>{active.type==='group'?active.description||'Chia sẻ ý tưởng, giữ kết nối và cùng nhau tiến xa.':other(active).bio||'Xin chào, mình đang sử dụng PTITChat!'}</p></div>{active.type==='group'&&<div className="detail-section"><div className="detail-heading"><h4>Thành viên <span>{active.members.length}</span></h4><button onClick={()=>openModal('members')}>Xem tất cả<ChevronRight size={12}/></button></div><div className="member-preview">{activeMembers.slice(0,5).map(p=><button key={p.id} title={p.name} onClick={()=>p.id===me.id?openModal('profile'):setModal({type:'person',person:p})}><Avatar person={p} online size="small"/><small>{p.name.split(' ').at(-1)}</small></button>)}</div></div>}<div className="detail-section"><div className="detail-heading"><h4>Ảnh & video <span>{photos.length}</span></h4><button onClick={()=>openModal('media')}>Xem tất cả<ChevronRight size={12}/></button></div><div className="media-grid">{photos.slice(-3).map(m=><div key={m.id}>{m.image?<img src={m.image} alt="Ảnh trong cuộc trò chuyện" onClick={()=>setModal({type:'image',src:m.image,name:'Ảnh đã chia sẻ'})}/>:<StoredImage file={m.file} onClick={src=>setModal({type:'image',src,name:m.file.name})}/>}</div>)}{!photos.length&&<p className="detail-empty">Ảnh được chia sẻ sẽ hiện ở đây.</p>}</div></div><div className="detail-section shared-files"><div className="detail-heading"><h4>Tệp đã chia sẻ <span>{files.length}</span></h4><button onClick={()=>openModal('files')}>Tất cả<ChevronRight size={12}/></button></div>{files.slice(-2).map(m=><FileAttachment key={m.id} file={m.file} onOpen={download}/>)}{!files.length&&<p className="detail-empty">Chưa có tệp đính kèm.</p>}</div><div className="details-bottom"><div className="ptit-seal"><GraduationCap size={24}/></div><p>Gắn kết hôm nay.<br/><b>Vững bước ngày mai.</b></p><span>MADE WITH <b>♡</b> AT PTIT</span></div></aside>}
  {modal&&<Modal title={typeof modal==='object'?modal.type==='image'?modal.name:'Hồ sơ người dùng':({group:'Tạo nhóm mới',new:'Cuộc trò chuyện mới',profile:'Hồ sơ của tôi',members:'Thành viên nhóm',media:'Ảnh đã chia sẻ',files:'Tệp đã chia sẻ',settings:'Cài đặt',editgroup:'Chỉnh sửa nhóm'})[modal]} onClose={()=>setModal(null)} wide={modal?.type==='image'}>
  {modal?.type==='image'&&<img className="lightbox-image" src={modal.src} alt={modal.name}/>}
  {modal?.type==='person'&&<div className="person-profile"><Avatar person={modal.person} size="large" online/><h2>{modal.person.name}</h2><p>@{modal.person.username}</p><span className="profile-status"><i className={`status-dot ${modal.person.online?'':'offline'}`}/>{modal.person.online?onlineLabel:'Offline'}</span><p>{modal.person.bio||'Xin chào, mình đang sử dụng PTITChat!'}</p>{modal.person.studentId&&<div className="profile-detail"><GraduationCap size={18}/>{modal.person.studentId}</div>}<button className="primary" onClick={()=>createConversation('direct',[modal.person.id])}><MessageCircle size={18}/>Nhắn tin</button></div>}
  {(modal==='new'||modal==='group')&&<form onSubmit={e=>{e.preventDefault();if(modal==='group'){if(!groupName.trim())return setModalError('Vui lòng nhập tên nhóm.');if(chosen.length<2)return setModalError('Chọn ít nhất 2 thành viên để tạo nhóm.');createConversation('group',chosen,groupName.trim());}}}>{modal==='group'&&<label>Tên nhóm<div className="input-wrap"><Users size={18}/><input autoFocus maxLength={60} required placeholder="Ví dụ: Nhóm đồ án PTIT" value={groupName} onChange={e=>setGroupName(e.target.value)}/></div></label>}<p className="modal-description">{modal==='group'?'Chọn những người bạn muốn kết nối cùng.':'Tìm một người bạn và bắt đầu cuộc trò chuyện.'}</p><div className="input-wrap"><Search size={17}/><input aria-label="Tìm thành viên" placeholder="Tìm theo tên hoặc email..." value={memberQuery} onChange={e=>setMemberQuery(e.target.value)}/></div><div className="member-select-list">{data.people.filter(p=>p.id!==me.id&&normalize(p.name+' '+p.username+' '+(p.email||'')).includes(normalize(memberQuery))).map(p=><button type="button" className={`member-choice ${chosen.includes(p.id)?'checked':''}`} key={p.id} onClick={()=>modal==='new'?createConversation('direct',[p.id]):setChosen(c=>c.includes(p.id)?c.filter(id=>id!==p.id):[...c,p.id])}><Avatar person={p} online/><span><b>{p.name}</b><small>@{p.username}</small></span>{modal==='group'?<i>{chosen.includes(p.id)&&<Check size={13}/>}</i>:<MessageCircle size={18}/>}</button>)}</div>{modalError&&<p className="form-error" role="alert">{modalError}</p>}{modal==='group'&&<div className="modal-footer"><span>Đã chọn {chosen.length} thành viên</span><button className="primary" type="submit"><Plus size={17}/>Tạo nhóm</button></div>}</form>}
  {modal==='profile'&&<form onSubmit={saveProfile}><div className="edit-avatar"><Avatar person={profile} size="large"/><button type="button" className="icon-btn" aria-label="Đổi ảnh đại diện" onClick={()=>avatarInput.current.click()}><Camera size={18}/></button><input hidden ref={avatarInput} accept="image/*" type="file" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('image/'))return setModalError('Vui lòng chọn một tệp ảnh.');if(file.size>1024*1024)return setModalError('Ảnh đại diện tối đa 1 MB.');const r=new FileReader();r.onload=()=>setProfile(p=>({...p,avatar:r.result}));r.readAsDataURL(file);}}/></div><p className="profile-username">@{me.username}</p><label>Họ và tên<input className="plain-input" maxLength={60} required value={profile.name||''} onChange={e=>setProfile(p=>({...p,name:e.target.value}))}/></label><div className="form-two-col"><label>Mã sinh viên<input className="plain-input" maxLength={30} placeholder="B21DCCN001" value={profile.studentId||''} onChange={e=>setProfile(p=>({...p,studentId:e.target.value}))}/></label><label>Email<input className="plain-input" type="email" readOnly maxLength={254} placeholder="ban@ptit.edu.vn" value={profile.email||''} onChange={e=>setProfile(p=>({...p,email:e.target.value}))}/></label></div><label>Giới thiệu<textarea className="plain-input" rows={3} maxLength={160} placeholder="Chia sẻ một chút về bạn..." value={profile.bio||''} onChange={e=>setProfile(p=>({...p,bio:e.target.value}))}/></label>{modalError&&<p role="alert" className="form-error">{modalError}</p>}<div className="modal-footer"><button type="button" className="text-danger" onClick={logout}><LogOut size={16}/>Đăng xuất</button><button className="primary" type="submit">Lưu thay đổi<Check size={17}/></button></div></form>}
  {modal==='members'&&<div className="member-select-list">{activeMembers.map(p=><button className="member-choice" key={p.id} onClick={()=>p.id===me.id?openModal('profile'):setModal({type:'person',person:p})}><Avatar person={p} online/><span><b>{p.name}{p.id===me.id?' (Bạn)':''}</b><small>{p.online?onlineLabel:'Offline'}</small></span><ChevronRight size={16}/></button>)}</div>}
  {modal==='media'&&<div className="gallery">{photos.map(m=>m.image?<img key={m.id} src={m.image} alt="Ảnh đã chia sẻ" onClick={()=>setModal({type:'image',src:m.image,name:'Ảnh đã chia sẻ'})}/>:<StoredImage key={m.id} file={m.file} onClick={src=>setModal({type:'image',src,name:m.file.name})}/>)}{!photos.length&&<p>Chưa có ảnh trong cuộc trò chuyện này.</p>}</div>}
  {modal==='files'&&<div className="all-files">{files.map(m=><FileAttachment key={m.id} file={m.file} onOpen={download}/>)}{!files.length&&<p>Chưa có tệp trong cuộc trò chuyện này.</p>}</div>}
  {modal==='settings'&&<div className="settings-content"><div className="settings-account"><Avatar person={me}/><span><b>{me.name}</b><small>@{me.username}</small></span><button onClick={()=>openModal('profile')}>Chỉnh sửa</button></div><div className="settings-info"><Globe size={20}/><div><b>Ngôn ngữ</b><small>Tiếng Việt</small></div><Check size={17}/></div><div className="settings-info"><ShieldCheck size={20}/><div><b>{server?'Chế độ máy chủ':'Chế độ trải nghiệm'}</b><small>{server?'REST API & Socket.IO · '+(connected?'Đã kết nối':'Mất kết nối'):'Dữ liệu được lưu trên trình duyệt này'}</small></div></div><p className="modal-description">{server?'Trạng thái trực tuyến và tin nhắn được đồng bộ giữa các tài khoản qua máy chủ.':'Để nhắn tin giữa nhiều thiết bị, chạy máy chủ Node.js, sau đó chọn “Kết nối máy chủ Node.js” ở màn hình đăng nhập. Trạng thái Online trong demo là dữ liệu minh họa.'}</p><button className="settings-logout" onClick={logout}><LogOut size={18}/>Đăng xuất</button><p className="version">PTITChat 1.0 · Kết nối không khoảng cách</p></div>}
  {modal==='editgroup'&&<form onSubmit={updateGroup}><label>Tên nhóm<input className="plain-input" required maxLength={60} value={groupName} onChange={e=>setGroupName(e.target.value)}/></label><label>Giới thiệu<textarea className="plain-input" rows={3} maxLength={240} value={groupDescription} onChange={e=>setGroupDescription(e.target.value)}/></label>{modalError&&<p className="form-error">{modalError}</p>}<div className="modal-footer"><span/><button className="primary" type="submit">Lưu thay đổi<Check size={17}/></button></div></form>}
  </Modal>}{toast&&<div className="toast" role="status"><CheckCircle2 size={18}/>{toast}<button aria-label="Đóng thông báo" onClick={()=>setToast('')}><X size={15}/></button></div>}
 </div>;
}
=======
import React, { useState, useEffect, useRef } from 'react';
import { request, authenticate, getToken, logout } from './services/api';
import {
  connect,
  disconnect,
  getSocket,
  joinConversation,
  leaveConversation,
  sendMessage,
  editMessage,
  revokeMessage,
  startTyping,
  stopTyping
} from './services/socket';

const PRESET_ACCOUNTS = [
  { username: 'ngotung05', label: 'Tùng (Nhóm trưởng)', role: 'Backend Leader' },
  { username: 'nguyentien05', label: 'Tiến', role: 'Auth / Frontend API' },
  { username: 'hoangson05', label: 'Sơn', role: 'Frontend UI' },
  { username: 'tranninh05', label: 'Ninh', role: 'Socket.IO Realtime' }
];

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('password123');
  const [authError, setAuthError] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Chat states
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showNewDirectModal, setShowNewDirectModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Check saved session on load
  useEffect(() => {
    const token = getToken();
    if (token) {
      request('/users/me')
        .then((res) => {
          const user = res.user || res.data;
          setCurrentUser(user);
          initSocket(token);
        })
        .catch(() => {
          logout();
          setCurrentUser(null);
        });
    }
  }, []);

  // Fetch initial conversations and users list once logged in
  useEffect(() => {
    if (currentUser) {
      loadConversations();
      loadUsers();
    }
  }, [currentUser]);

  // Handle active conversation change
  useEffect(() => {
    if (!activeConv) return;
    joinConversation(activeConv._id);
    loadMessages(activeConv._id);

    return () => {
      leaveConversation(activeConv._id);
    };
  }, [activeConv?._id]);

  // Scroll to bottom on messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Setup Socket Listeners
  const initSocket = (token) => {
    const s = connect(token);
    if (!s) return;

    s.off('message:new');
    s.off('message:edited');
    s.off('message:revoked');
    s.off('typing:update');
    s.off('conversation:created');

    s.on('message:new', (newMsg) => {
      setMessages((prev) => {
        // Tránh trùng nếu tin nhắn đã có
        if (prev.some((m) => m._id === newMsg._id || (m.clientTempId && m.clientTempId === newMsg.clientTempId))) {
          return prev.map((m) => (m.clientTempId && m.clientTempId === newMsg.clientTempId ? newMsg : m));
        }
        return [...prev, newMsg];
      });

      // Cập nhật lastMessage ở danh sách cuộc trò chuyện
      setConversations((prev) =>
        prev.map((c) =>
          c._id === newMsg.conversation
            ? { ...c, lastMessage: newMsg, updatedAt: new Date().toISOString() }
            : c
        )
      );
    });

    s.on('message:edited', (editedMsg) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === editedMsg._id ? { ...m, ...editedMsg } : m))
      );
    });

    s.on('message:revoked', (revokedMsg) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === revokedMsg._id ? { ...m, ...revokedMsg, isRecall: true, text: 'Tin nhắn đã bị thu hồi' } : m))
      );
    });

    s.on('typing:update', ({ conversationId, userId, isTyping }) => {
      setTypingUsers((prev) => {
        const copy = { ...prev };
        if (!copy[conversationId]) copy[conversationId] = {};
        if (isTyping) {
          copy[conversationId][userId] = true;
        } else {
          delete copy[conversationId][userId];
        }
        return copy;
      });
    });

    s.on('conversation:created', (newConv) => {
      setConversations((prev) => [newConv, ...prev.filter((c) => c._id !== newConv._id)]);
    });
  };

  const handleLogin = async (username, password) => {
    try {
      setLoadingAuth(true);
      setAuthError('');
      const user = await authenticate('login', { username, password });
      setCurrentUser(user);
      const token = getToken();
      initSocket(token);
    } catch (err) {
      setAuthError(err.message || 'Đăng nhập thất bại');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleLogout = () => {
    disconnect();
    logout();
    setCurrentUser(null);
    setActiveConv(null);
    setConversations([]);
    setMessages([]);
  };

  const loadConversations = async () => {
    try {
      const res = await request('/conversations');
      const list = res.data || [];
      setConversations(list);
      if (list.length > 0 && !activeConv) {
        setActiveConv(list[0]);
      }
    } catch (err) {
      console.error('Lỗi tải cuộc trò chuyện:', err);
    }
  };

  const loadUsers = async () => {
    try {
      const res = await request('/users');
      setAllUsers(res.users || res.data || []);
    } catch (err) {
      console.error('Lỗi tải người dùng:', err);
    }
  };

  const loadMessages = async (convId) => {
    try {
      const res = await request(`/messages/${convId}`);
      const data = res.data?.messages || res.data || [];
      // Sắp xếp tin nhắn theo thời gian tăng dần
      setMessages([...data].reverse());
    } catch (err) {
      console.error('Lỗi tải tin nhắn:', err);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputMessage.trim() || !activeConv) return;

    const textToSend = inputMessage.trim();
    setInputMessage('');
    stopTyping(activeConv._id);

    try {
      // Gửi qua socket service
      await sendMessage({
        conversationId: activeConv._id,
        text: textToSend
      });
    } catch (err) {
      console.error('Lỗi gửi tin nhắn qua socket, fallback REST:', err);
      // Fallback gửi qua REST API của Tùng
      try {
        const res = await request('/messages', {
          method: 'POST',
          body: {
            conversationId: activeConv._id,
            text: textToSend
          }
        });
        if (res.data) {
          setMessages((prev) => [...prev, res.data]);
        }
      } catch (restErr) {
        alert('Gửi tin nhắn thất bại: ' + restErr.message);
      }
    }
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    if (!activeConv) return;

    startTyping(activeConv._id);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(activeConv._id);
    }, 2000);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append('files', file);

      const token = getToken();
      const res = await fetch('/api/uploads', {
        method: 'POST',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Tải tệp lên thất bại');

      const uploadedFiles = data.data || [];
      if (uploadedFiles.length > 0) {
        // Gửi tin nhắn chứa attachment qua REST API
        await request('/messages', {
          method: 'POST',
          body: {
            conversationId: activeConv._id,
            text: `Đã gửi tệp đính kèm: ${file.name}`,
            attachments: uploadedFiles
          }
        });
        loadMessages(activeConv._id);
      }
    } catch (err) {
      alert('Tải tệp thất bại: ' + err.message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRevoke = async (msgId) => {
    if (!confirm('Bạn có chắc muốn thu hồi tin nhắn này?')) return;
    try {
      await revokeMessage(msgId);
    } catch (err) {
      // Fallback REST
      try {
        await request(`/messages/${msgId}`, { method: 'DELETE' });
        loadMessages(activeConv._id);
      } catch (e) {
        alert('Không thể thu hồi: ' + e.message);
      }
    }
  };

  const handleEdit = async (msg) => {
    const newText = prompt('Nhập nội dung mới:', msg.text);
    if (!newText || newText === msg.text) return;
    try {
      await editMessage(msg._id, newText);
    } catch (err) {
      try {
        await request(`/messages/${msg._id}`, {
          method: 'PATCH',
          body: { text: newText }
        });
        loadMessages(activeConv._id);
      } catch (e) {
        alert('Không thể sửa tin nhắn: ' + e.message);
      }
    }
  };

  const handleCreateDirectChat = async (targetUser) => {
    try {
      const res = await request('/conversations', {
        method: 'POST',
        body: { participantId: targetUser._id }
      });
      const conv = res.data;
      await loadConversations();
      setActiveConv(conv);
      setShowNewDirectModal(false);
    } catch (err) {
      alert('Lỗi tạo hội thoại: ' + err.message);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      alert('Vui lòng nhập tên nhóm');
      return;
    }
    if (selectedMembers.length === 0) {
      alert('Vui lòng chọn ít nhất 1 thành viên');
      return;
    }
    try {
      const res = await request('/conversations/group', {
        method: 'POST',
        body: {
          name: groupName.trim(),
          members: selectedMembers
        }
      });
      const conv = res.data;
      await loadConversations();
      setActiveConv(conv);
      setShowNewGroupModal(false);
      setGroupName('');
      setSelectedMembers([]);
    } catch (err) {
      alert('Lỗi tạo nhóm: ' + err.message);
    }
  };

  // Helper tìm tên hiển thị của conversation
  const getConvTitle = (conv) => {
    if (!conv) return '';
    if (conv.type === 'group' || conv.isGroup) return conv.name || 'Nhóm học tập';
    const other = conv.members?.find((m) => (m._id || m) !== currentUser?._id);
    return other?.displayName || other?.username || 'Tin nhắn riêng';
  };

  // ===================== RENDER LOGIN =====================
  if (!currentUser) {
    return (
      <div style={styles.loginContainer}>
        <div style={styles.loginCard}>
          <div style={styles.logoHeader}>
            <div style={styles.logoBadge}>PTIT</div>
            <h1 style={styles.logoTitle}>PTITChat</h1>
          </div>
          <p style={styles.logoSubtitle}>KẾT NỐI KHÔNG KHOẢNG CÁCH • HỌC VIỆN CÔNG NGHỆ BƯU CHÍNH VIỄN THÔNG</p>

          <div style={styles.quickLoginBox}>
            <p style={{ fontWeight: '600', marginBottom: '8px', fontSize: '13px', color: '#8B1528' }}>
              ⚡ Đăng nhập nhanh để test Local (Click 1 chạm):
            </p>
            <div style={styles.quickGrid}>
              {PRESET_ACCOUNTS.map((acc) => (
                <button
                  key={acc.username}
                  onClick={() => handleLogin(acc.username, 'password123')}
                  style={styles.quickBtn}
                  disabled={loadingAuth}
                >
                  <div style={{ fontWeight: '600' }}>{acc.label}</div>
                  <div style={{ fontSize: '11px', color: '#666' }}>@{acc.username}</div>
                  <div style={{ fontSize: '10px', color: '#8B1528', marginTop: '2px' }}>{acc.role}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ textAlign: 'center', margin: '14px 0', color: '#999', fontSize: '12px' }}>— HOẶC ĐĂNG NHẬP THỦ CÔNG —</div>

          {authError && <div style={styles.errorBox}>{authError}</div>}

          <form onSubmit={(e) => { e.preventDefault(); handleLogin(usernameInput, passwordInput); }}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Tên đăng nhập</label>
              <input
                style={styles.input}
                type="text"
                placeholder="VD: ngotung05"
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.label}>Mật khẩu</label>
              <input
                style={styles.input}
                type="password"
                placeholder="Mật khẩu"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loadingAuth}
              style={{ ...styles.submitBtn, opacity: loadingAuth ? 0.7 : 1 }}
            >
              {loadingAuth ? 'Đang xác thực...' : 'Đăng nhập PTITChat'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ===================== RENDER 3-COLUMN CHAT INTERFACE =====================
  const currentTypingUsers = typingUsers[activeConv?._id] || {};
  const isSomeoneTyping = Object.keys(currentTypingUsers).length > 0;

  return (
    <div style={styles.appContainer}>
      {/* TOP HEADER */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoBadge}>PTIT</div>
          <span style={styles.brandTitle}>PTITChat</span>
          <span style={styles.tagline}>KẾT NỐI KHÔNG KHOẢNG CÁCH</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.userBadge}>
            <div style={styles.userAvatarSmall}>
              {currentUser.displayName?.[0] || currentUser.username?.[0] || 'U'}
            </div>
            <div>
              <div style={{ fontWeight: '600', fontSize: '13px' }}>{currentUser.displayName || currentUser.username}</div>
              <div style={{ fontSize: '11px', color: '#4ade80' }}>● Đang trực tuyến</div>
            </div>
          </div>
          <button onClick={handleLogout} style={styles.logoutBtn}>Đăng xuất</button>
        </div>
      </header>

      {/* 3-COLUMN BODY */}
      <div style={styles.mainLayout}>
        {/* COLUMN 1: CONVERSATIONS LIST */}
        <aside style={styles.colLeft}>
          <div style={styles.colHeader}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '700', fontSize: '15px' }}>Tin nhắn</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => setShowNewDirectModal(true)}
                  style={styles.iconBtn}
                  title="Nhắn tin người mới"
                >
                  👤+
                </button>
                <button
                  onClick={() => setShowNewGroupModal(true)}
                  style={styles.iconBtn}
                  title="Tạo nhóm mới"
                >
                  👥+
                </button>
              </div>
            </div>
          </div>

          <div style={styles.convListScroll}>
            {conversations.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontSize: '13px' }}>
                Chưa có cuộc trò chuyện nào.<br />Hãy bấm 👤+ hoặc 👥+ để bắt đầu!
              </div>
            ) : (
              conversations.map((c) => {
                const isActive = activeConv?._id === c._id;
                const isGroup = c.type === 'group' || c.isGroup;
                const title = getConvTitle(c);
                const lastMsg = c.lastMessage?.isRecall
                  ? 'Tin nhắn đã bị thu hồi'
                  : c.lastMessage?.text || 'Bắt đầu cuộc trò chuyện';

                return (
                  <div
                    key={c._id}
                    onClick={() => setActiveConv(c)}
                    style={{
                      ...styles.convItem,
                      backgroundColor: isActive ? '#FBE8EC' : 'transparent',
                      borderLeft: isActive ? '4px solid #8B1528' : '4px solid transparent'
                    }}
                  >
                    <div style={isGroup ? styles.convAvatarGroup : styles.convAvatarUser}>
                      {isGroup ? '👥' : title[0]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: '600', fontSize: '14px', color: '#1F2937' }}>{title}</span>
                      </div>
                      <div style={styles.lastMsgText}>{lastMsg}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* COLUMN 2: ACTIVE CHAT FEED */}
        <main style={styles.colCenter}>
          {activeConv ? (
            <>
              <div style={styles.chatTopBar}>
                <div>
                  <div style={{ fontWeight: '700', fontSize: '16px', color: '#1F2937' }}>
                    {getConvTitle(activeConv)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280' }}>
                    {(activeConv.type === 'group' || activeConv.isGroup)
                      ? `${activeConv.members?.length || 0} thành viên • Phòng nhóm`
                      : 'Cuộc trò chuyện 1-1 riêng tư'}
                  </div>
                </div>
              </div>

              {/* MESSAGES THREAD */}
              <div style={styles.messagesContainer}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#9CA3AF', marginTop: '40px' }}>
                    Chưa có tin nhắn nào trong hội thoại này.<br />Hãy gửi lời chào đầu tiên! 👋
                  </div>
                ) : (
                  messages.map((m) => {
                    const senderId = m.sender?._id || m.sender;
                    const isMe = senderId === currentUser._id;
                    const senderName = m.sender?.displayName || m.sender?.username || (isMe ? 'Bạn' : 'Thành viên');

                    return (
                      <div
                        key={m._id || m.clientTempId}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isMe ? 'flex-end' : 'flex-start',
                          marginBottom: '12px'
                        }}
                      >
                        {!isMe && (
                          <span style={{ fontSize: '11px', color: '#6B7280', marginBottom: '2px', marginLeft: '8px' }}>
                            {senderName}
                          </span>
                        )}

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isMe && !m.isRecall && (
                            <div style={styles.msgActions}>
                              <button onClick={() => handleEdit(m)} style={styles.actionLink}>Sửa</button>
                              <button onClick={() => handleRevoke(m._id)} style={styles.actionLink}>Thu hồi</button>
                            </div>
                          )}

                          <div
                            style={{
                              ...styles.bubble,
                              backgroundColor: m.isRecall ? '#E5E7EB' : isMe ? '#8B1528' : '#F3F4F6',
                              color: m.isRecall ? '#6B7280' : isMe ? '#FFFFFF' : '#1F2937',
                              fontStyle: m.isRecall ? 'italic' : 'normal'
                            }}
                          >
                            <div>{m.text}</div>

                            {/* Render attachments */}
                            {m.attachments?.map((att, i) => (
                              <div key={i} style={styles.attachmentBox}>
                                📄 <a
                                  href={`http://localhost:5000${att.path || att.url}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ color: isMe ? '#FFFFFF' : '#8B1528', textDecoration: 'underline' }}
                                >
                                  {att.originalname || att.filename || 'Tệp đính kèm'}
                                </a>
                              </div>
                            ))}

                            <div
                              style={{
                                fontSize: '10px',
                                textAlign: 'right',
                                marginTop: '4px',
                                color: isMe && !m.isRecall ? '#F9D5DB' : '#9CA3AF'
                              }}
                            >
                              {m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                              {m.isEdited && !m.isRecall && ' (đã sửa)'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                {isSomeoneTyping && (
                  <div style={{ fontSize: '12px', color: '#8B1528', fontStyle: 'italic', padding: '4px 8px' }}>
                    ✍️ Ai đó đang soạn tin nhắn...
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* INPUT BAR */}
              <div style={styles.inputArea}>
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={styles.attachBtn}
                  disabled={isUploading}
                  title="Đính kèm tệp / ảnh"
                >
                  {isUploading ? '⏳' : '📎'}
                </button>

                <form onSubmit={handleSendMessage} style={{ display: 'flex', flex: 1, gap: '8px' }}>
                  <input
                    type="text"
                    placeholder="Nhắn tin cho cuộc trò chuyện..."
                    value={inputMessage}
                    onChange={handleInputChange}
                    style={styles.chatInput}
                  />
                  <button type="submit" style={styles.sendBtn}>Gửi</button>
                </form>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#9CA3AF' }}>
              Chọn một cuộc trò chuyện từ cột trái để bắt đầu
            </div>
          )}
        </main>

        {/* COLUMN 3: DETAILS PANEL */}
        {activeConv && (
          <aside style={styles.colRight}>
            <div style={{ textAlign: 'center', padding: '20px 10px', borderBottom: '1px solid #E5E7EB' }}>
              <div style={styles.detailsAvatar}>
                {(activeConv.type === 'group' || activeConv.isGroup) ? '👥' : '👤'}
              </div>
              <h3 style={{ margin: '10px 0 4px', fontSize: '16px' }}>{getConvTitle(activeConv)}</h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#6B7280' }}>
                {(activeConv.type === 'group' || activeConv.isGroup) ? 'Nhóm trao đổi bài tập PTIT' : 'Trò chuyện cá nhân'}
              </p>
            </div>

            <div style={{ padding: '16px' }}>
              <h4 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#8B1528', marginBottom: '10px' }}>
                Thành viên ({activeConv.members?.length || 0})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activeConv.members?.map((m) => {
                  const memId = m._id || m;
                  const u = allUsers.find((usr) => usr._id === memId) || m;
                  const isCurrent = memId === currentUser._id;
                  return (
                    <div key={memId} style={styles.memberRow}>
                      <div style={styles.memberAvatar}>
                        {(u.displayName || u.username || 'U')[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '500' }}>
                          {u.displayName || u.username} {isCurrent && '(Bạn)'}
                        </div>
                        <div style={{ fontSize: '11px', color: '#4ade80' }}>● Trực tuyến</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* MODAL: CHAT 1-1 */}
      {showNewDirectModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ margin: '0 0 12px', color: '#8B1528' }}>Chọn bạn để nhắn tin 1-1</h3>
            <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
              {allUsers.map((u) => (
                <div
                  key={u._id}
                  onClick={() => handleCreateDirectChat(u)}
                  style={styles.modalUserRow}
                >
                  <div style={styles.memberAvatar}>{u.displayName?.[0] || u.username?.[0]}</div>
                  <div>
                    <div style={{ fontWeight: '600' }}>{u.displayName}</div>
                    <div style={{ fontSize: '12px', color: '#666' }}>@{u.username}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setShowNewDirectModal(false)} style={styles.closeBtn}>Đóng</button>
          </div>
        </div>
      )}

      {/* MODAL: CREATE GROUP */}
      {showNewGroupModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ margin: '0 0 12px', color: '#8B1528' }}>Tạo nhóm học tập mới</h3>
            <input
              type="text"
              placeholder="VD: Nhóm Đồ án PTIT - Lớp D21"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              style={{ ...styles.input, marginBottom: '12px' }}
            />
            <p style={{ fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Chọn thành viên vào nhóm:</p>
            <div style={{ maxHeight: '200px', overflowY: 'auto', marginBottom: '12px' }}>
              {allUsers.map((u) => {
                const checked = selectedMembers.includes(u._id);
                return (
                  <label key={u._id} style={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedMembers([...selectedMembers, u._id]);
                        else setSelectedMembers(selectedMembers.filter((id) => id !== u._id));
                      }}
                    />
                    <span>{u.displayName || u.username} (@{u.username})</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowNewGroupModal(false)} style={styles.closeBtn}>Hủy</button>
              <button onClick={handleCreateGroup} style={styles.submitBtnSmall}>Tạo nhóm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===================== STYLES OBJECT =====================
const styles = {
  loginContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  loginCard: {
    width: '460px',
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
    border: '1px solid #E5E7EB'
  },
  logoHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    marginBottom: '6px'
  },
  logoBadge: {
    backgroundColor: '#8B1528',
    color: '#FFF',
    fontWeight: '900',
    fontSize: '14px',
    padding: '4px 8px',
    borderRadius: '6px'
  },
  logoTitle: {
    fontSize: '26px',
    color: '#8B1528',
    margin: 0,
    fontWeight: '800'
  },
  logoSubtitle: {
    textAlign: 'center',
    fontSize: '11px',
    color: '#6B7280',
    margin: '0 0 20px',
    letterSpacing: '0.5px'
  },
  quickLoginBox: {
    backgroundColor: '#FFF5F6',
    border: '1px solid #FBCED4',
    borderRadius: '8px',
    padding: '12px',
    marginBottom: '16px'
  },
  quickGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px'
  },
  quickBtn: {
    padding: '8px',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s'
  },
  formGroup: {
    marginBottom: '14px'
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    marginBottom: '4px',
    color: '#374151'
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '6px',
    border: '1px solid #D1D5DB',
    fontSize: '14px',
    boxSizing: 'border-box',
    outline: 'none'
  },
  submitBtn: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '6px'
  },
  submitBtnSmall: {
    padding: '8px 16px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  errorBox: {
    padding: '8px 12px',
    backgroundColor: '#FEE2E2',
    color: '#B91C1C',
    borderRadius: '6px',
    fontSize: '13px',
    marginBottom: '12px'
  },

  // App Layout Styles
  appContainer: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    backgroundColor: '#F9FAFB'
  },
  header: {
    height: '56px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  brandTitle: {
    fontSize: '20px',
    fontWeight: '800'
  },
  tagline: {
    fontSize: '11px',
    opacity: 0.8,
    borderLeft: '1px solid rgba(255,255,255,0.3)',
    paddingLeft: '10px',
    letterSpacing: '0.5px'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px'
  },
  userBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  userAvatarSmall: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#FFF',
    color: '#8B1528',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '14px'
  },
  logoutBtn: {
    padding: '6px 12px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#FFF',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '12px'
  },
  mainLayout: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden'
  },

  // Col Left
  colLeft: {
    width: '320px',
    backgroundColor: '#FFF',
    borderRight: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column'
  },
  colHeader: {
    padding: '14px 16px',
    borderBottom: '1px solid #E5E7EB'
  },
  iconBtn: {
    padding: '4px 8px',
    backgroundColor: '#F3F4F6',
    border: '1px solid #E5E7EB',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px'
  },
  convListScroll: {
    flex: 1,
    overflowY: 'auto'
  },
  convItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid #F3F4F6',
    transition: 'background-color 0.15s'
  },
  convAvatarGroup: {
    width: '40px',
    height: '40px',
    borderRadius: '8px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px'
  },
  convAvatarUser: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#E5E7EB',
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '700',
    fontSize: '16px'
  },
  lastMsgText: {
    fontSize: '12px',
    color: '#6B7280',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: '2px'
  },

  // Col Center
  colCenter: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#F9FAFB'
  },
  chatTopBar: {
    height: '56px',
    backgroundColor: '#FFF',
    borderBottom: '1px solid #E5E7EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px'
  },
  messagesContainer: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  bubble: {
    maxWidth: '65%',
    padding: '10px 14px',
    borderRadius: '12px',
    fontSize: '14px',
    lineHeight: '1.4',
    wordBreak: 'break-word',
    boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
  },
  attachmentBox: {
    marginTop: '6px',
    padding: '6px 8px',
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: '6px',
    fontSize: '12px'
  },
  msgActions: {
    display: 'flex',
    gap: '4px',
    fontSize: '11px'
  },
  actionLink: {
    background: 'none',
    border: 'none',
    color: '#6B7280',
    cursor: 'pointer',
    textDecoration: 'underline',
    padding: '0 2px'
  },
  inputArea: {
    padding: '12px 20px',
    backgroundColor: '#FFF',
    borderTop: '1px solid #E5E7EB',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  attachBtn: {
    padding: '10px 14px',
    backgroundColor: '#F3F4F6',
    border: '1px solid #D1D5DB',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '16px'
  },
  chatInput: {
    flex: 1,
    padding: '10px 14px',
    borderRadius: '8px',
    border: '1px solid #D1D5DB',
    fontSize: '14px',
    outline: 'none'
  },
  sendBtn: {
    padding: '10px 20px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    border: 'none',
    borderRadius: '8px',
    fontWeight: '600',
    cursor: 'pointer'
  },

  // Col Right
  colRight: {
    width: '280px',
    backgroundColor: '#FFF',
    borderLeft: '1px solid #E5E7EB',
    display: 'flex',
    flexDirection: 'column'
  },
  detailsAvatar: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    backgroundColor: '#8B1528',
    color: '#FFF',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '32px',
    margin: '0 auto'
  },
  memberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 0'
  },
  memberAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#E5E7EB',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    fontSize: '13px',
    color: '#374151'
  },

  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modalCard: {
    width: '400px',
    backgroundColor: '#FFF',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
  },
  modalUserRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px',
    borderRadius: '6px',
    cursor: 'pointer',
    borderBottom: '1px solid #F3F4F6'
  },
  checkboxRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 0',
    fontSize: '14px',
    cursor: 'pointer'
  },
  closeBtn: {
    padding: '8px 14px',
    backgroundColor: '#F3F4F6',
    border: '1px solid #D1D5DB',
    borderRadius: '6px',
    cursor: 'pointer'
  }
};
>>>>>>> 5e92e1bc351b7c2b8b675b3eb00ae45c91e81034
