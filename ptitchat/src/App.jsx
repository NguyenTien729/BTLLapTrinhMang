import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Users, Settings, LogOut, Search, Plus, ChevronDown, ChevronRight, ArrowRight, ArrowLeft, Send, Paperclip, Image as ImageIcon, Smile, Check, CheckCheck, X, Info, FileText, Download, MoreHorizontal, Pin, Bell, BellOff, User, Lock, Eye, EyeOff, Mail, Hash, GraduationCap, ShieldCheck, Globe, LoaderCircle, PanelRightClose, Menu, Link, Camera, CheckCircle2, Moon, Sun, Phone, PhoneOff, Video, VideoOff, Mic, MicOff, Wifi, WifiOff, Clock, Reply, ScreenShare } from 'lucide-react';
import { io } from 'socket.io-client';
import { initialState, people, initials, timeText, sizeText, normalize } from './data';
import { load, api, saveFile, readFile, hashPassword } from './storage';

const uid = () => crypto.randomUUID();
function Avatar({ person, group, size = '', online = false, onClick }) { return <span onClick={onClick} className={`avatar ${group ? 'group-avatar' : ''} ${size}`} style={{ '--avatar-color': group?.color || person?.color || '#a6828f' }}>{group ? <Users size={size === 'large' ? 30 : 21} /> : person?.avatar ? <img src={person.avatar} alt={person.name} /> : initials(person?.name)}{online && <i className={person?.online ? 'presence online' : 'presence'} />}</span>; }
function IconButton({ children, label, onClick, className = '', ...props }) { return <button className={`icon-btn ${className}`} title={label} aria-label={label} onClick={onClick} {...props}>{children}</button>; }
function Brand({ light = false }) { return <div className={`brand ${light ? 'light' : ''}`}><span className="brand-symbol"><MessageCircle size={25} strokeWidth={2.2} /><i /></span><span>PTIT<span className="brand-chat">Chat</span><small>KẾT NỐI KHÔNG KHOẢNG CÁCH</small></span></div>; }
function Modal({ title, children, onClose, wide = false }) { const ref = useRef(); useEffect(() => { const before = document.activeElement; const el = ref.current; const nodes = () => el?.querySelectorAll('button,input,textarea,select,a[href]'); nodes()?.[0]?.focus(); function key(e) { if (e.key === 'Escape') onClose(); if (e.key === 'Tab') { const items = [...(nodes() || [])].filter(n => !n.disabled); const first = items[0], last = items.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } } document.addEventListener('keydown', key); return () => { document.removeEventListener('keydown', key); before?.focus(); }; }, []); return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}><section ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`modal ${wide ? 'wide' : ''}`}><div className="modal-title"><h2>{title}</h2><IconButton label="Đóng" onClick={onClose}><X size={21} /></IconButton></div>{children}</section></div>; }

function Auth({ onLogin, notify }) {
  const [register, setRegister] = useState(false), [username, setUsername] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState(''), [confirm, setConfirm] = useState(''), [show, setShow] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false), [server, setServer] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(''); const user = username.trim().toLowerCase(); if (!/^[a-z0-9_]{3,24}$/.test(user)) { setError('Username gồm 3–24 ký tự: chữ không dấu, số hoặc dấu gạch dưới.'); return; } if (password.length < 6) { setError('Mật khẩu cần có ít nhất 6 ký tự.'); return; } if (register && password !== confirm) { setError('Mật khẩu xác nhận chưa khớp.'); return; } if (register && !name.trim()) { setError('Vui lòng nhập họ và tên.'); return; } setBusy(true); try {
      if (server) { const result = await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: { username: user, password, name: name.trim() } }); onLogin({ ...result, mode: 'server' }); }
      else { const accounts = load('ptit-accounts', []); if (register) { if (accounts.some(a => a.username === user) || user === 'minhanh') throw new Error('Username này đã được sử dụng.'); const salt = uid(); const profile = { id: uid(), username: user, name: name.trim(), color: '#b52740', online: true, bio: 'Xin chào, mình đang sử dụng PTITChat!' }; accounts.push({ ...profile, salt, passwordHash: await hashPassword(password, salt) }); localStorage.setItem('ptit-accounts', JSON.stringify(accounts)); onLogin({ user: profile, mode: 'demo' }); } else if (user === 'minhanh' && password === 'ptitchat123') { onLogin({ user: people[0], mode: 'demo' }); } else { const found = accounts.find(a => a.username === user); if (!found || await hashPassword(password, found.salt) !== found.passwordHash) throw new Error('Username hoặc mật khẩu không chính xác.'); const { passwordHash, salt, ...profile } = found; onLogin({ user: profile, mode: 'demo' }); } }
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  }
  return <div className="auth-page"><div className="auth-art"><Brand light /><div className="art-dots" /><div className="auth-story"><span className="eyebrow">KHÔNG GIAN KẾT NỐI CỦA SINH VIÊN PTIT</span><h1>Gần nhau hơn.<br />Đi xa cùng nhau<span>.</span></h1><p>Từ một lời chào, đến những ý tưởng lớn.<br />Mọi cuộc trò chuyện đều bắt đầu tại đây.</p><div className="art-chat"><div className="art-message"><Avatar person={people[1]} /><div><small>Hoàng Nam</small><p>Team mình sẵn sàng chưa? 🚀</p></div></div><div className="art-message reply"><span>Sẵn sàng tạo nên điều tuyệt vời! ✨</span><CheckCheck size={15} /></div><div className="art-files"><span><FileText size={23} /></span><div><b>Đồ án tốt nghiệp.pdf</b><small>Chia sẻ ý tưởng, cùng nhau phát triển</small></div><CheckCircle2 size={19} /></div></div><div className="auth-community"><div className="avatar-stack">{people.slice(1, 5).map(p => <Avatar key={p.id} person={p} size="small" />)}</div><p><b>Một cộng đồng. Vô vàn kết nối.</b><small>Dành riêng cho những người trẻ PTIT.</small></p></div></div><div className="auth-footer"><span>© 2026 PTITChat</span><span>Được tạo nên từ những kết nối <span>♡</span></span></div></div><main className="auth-main"><div className="auth-top"><span>Sinh viên PTIT, kết nối ngay</span><GraduationCap size={21} /></div><div className="auth-form-wrap"><span className="welcome-icon"><MessageCircle size={27} /></span><h2>{register ? 'Bắt đầu kết nối' : 'Chào mừng trở lại!'}<span> {register ? '✨' : '👋'}</span></h2><p>{register ? 'Tạo tài khoản để cùng nhau chia sẻ và khám phá.' : 'Đăng nhập để tiếp tục những cuộc trò chuyện của bạn.'}</p><div className="auth-tabs"><button className={!register ? 'selected' : ''} onClick={() => { setRegister(false); setError(''); }}>Đăng nhập</button><button className={register ? 'selected' : ''} onClick={() => { setRegister(true); setError(''); }}>Đăng ký</button></div>{!register && <div className="quick-accounts"><p className="quick-accounts-title">⚡ Chọn tài khoản MongoDB Atlas (1-Click):</p><div className="quick-accounts-grid">{[{ u: 'ngotung05', n: 'Tùng (Trưởng nhóm)' }, { u: 'nguyentien05', n: 'Tiến' }, { u: 'hoangson05', n: 'Sơn' }, { u: 'tranninh05', n: 'Ninh' }].map(m => <button key={m.u} type="button" className="quick-account-btn" onClick={() => { setUsername(m.u); setPassword('password123'); setServer(true); }}><b>{m.n}</b><small>@{m.u}</small></button>)}</div></div>}<form onSubmit={submit}>{register && <label>Họ và tên<div className="input-wrap"><User size={18} /><input required maxLength={60} placeholder="Nguyễn Minh Anh" autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></div></label>}<label>Username<div className="input-wrap"><User size={18} /><input required placeholder="Nhập username của bạn" autoComplete="username" value={username} onChange={e => setUsername(e.target.value)} /></div></label><label>Mật khẩu<div className="input-wrap"><Lock size={18} /><input required placeholder="Nhập mật khẩu" type={show ? 'text' : 'password'} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /><IconButton label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onClick={() => setShow(!show)} type="button">{show ? <EyeOff size={18} /> : <Eye size={18} />}</IconButton></div></label>{register && <label>Xác nhận mật khẩu<div className="input-wrap"><Lock size={18} /><input required type={show ? 'text' : 'password'} autoComplete="new-password" placeholder="Nhập lại mật khẩu" value={confirm} onChange={e => setConfirm(e.target.value)} /></div></label>}<div className="auth-options"><label className="checkbox-label"><input type="checkbox" checked={server} onChange={e => setServer(e.target.checked)} /> Kết nối máy chủ Node.js</label><span className="secure"><ShieldCheck size={14} /> Riêng tư</span></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary auth-submit" disabled={busy} type="submit">{busy ? <LoaderCircle className="spin" size={19} /> : <>{register ? 'Tạo tài khoản' : 'Đăng nhập'}<ArrowRight size={19} /></>}</button></form><div className="auth-divider"><span>hoặc khám phá trước</span></div><button className="demo-button" onClick={() => onLogin({ user: people[0], mode: 'demo' })}>Trải nghiệm bản demo <ArrowRight size={17} /></button><p className="demo-note">Bản demo lưu dữ liệu trên trình duyệt của bạn.<br />Tài khoản mẫu: <b>minhanh</b> / <b>ptitchat123</b></p></div><div className="auth-bottom"><ShieldCheck size={15} /> Không gian riêng tư cho mọi cuộc trò chuyện</div></main></div>;
}

function FileAttachment({ file, onOpen }) { return <button className="file-card" onClick={() => onOpen(file)}><span className={`file-icon ${file.type?.includes('pdf') ? 'pdf' : ''}`}><FileText size={23} /><small>{file.type?.includes('pdf') ? 'PDF' : 'FILE'}</small></span><span className="file-label"><b>{file.name}</b><small>{sizeText(file.size)} · {file.type?.includes('pdf') ? 'Tài liệu PDF' : 'Tệp đính kèm'}</small></span><Download size={17} /></button>; }
function StoredImage({ file, onClick, className = '' }) { const [src, setSrc] = useState(file?.data || ''); useEffect(() => { let url, cancel = false; if (file?.id && !file.data) readFile(file.id).then(blob => { if (blob && !cancel) { url = URL.createObjectURL(blob); setSrc(url); } }).catch(() => { }); return () => { cancel = true; if (url) URL.revokeObjectURL(url); }; }, [file?.id, file?.data]); return src ? <img className={className} src={src} alt={file.name || 'Ảnh đã chia sẻ'} onClick={() => onClick?.(src)} /> : <span className="image-placeholder">Không tải được ảnh</span>; }
function RemoteVideoTile({ peer }) {
  const videoRef = useRef(null);
  useEffect(() => {
    if (videoRef.current && peer.stream) {
      videoRef.current.srcObject = peer.stream;
    }
  }, [peer.stream]);
  const hasVideo = peer.isVideo && peer.stream && peer.stream.getVideoTracks().some(t => t.enabled);
  return (
    <div className="group-call-tile">
      {hasVideo ? (
        <video ref={videoRef} autoPlay playsInline />
      ) : (
        <div className="group-call-placeholder">
          <Avatar person={peer.user || { name: peer.name, avatar: peer.avatar }} size="large" />
          <div className="call-peer-name" style={{ fontSize: 16 }}>{peer.user?.name || peer.name || 'Thành viên'}</div>
        </div>
      )}
      <div className="tile-name-tag">
        <Mic size={14} />
        <span>{peer.user?.name || peer.name || 'Thành viên'}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [theme, setTheme] = useState(() => { try { const s = localStorage.getItem('ptit-theme'); if (s === 'dark' || s === '"dark"') return 'dark'; if (s === 'light' || s === '"light"') return 'light'; return load('ptit-theme', 'light'); } catch { return 'light'; } });
  const [session, setSession] = useState(() => load('ptit-session', null));
  const [data, setData] = useState(() => load('ptit-state', initialState()));
  const [selected, setSelected] = useState('project'), [tab, setTab] = useState('all'), [query, setQuery] = useState(''), [draft, setDraft] = useState(''), [modal, setModal] = useState(null), [right, setRight] = useState(() => typeof window !== 'undefined' && window.innerWidth > 1050), [mobileChat, setMobileChat] = useState(false), [nav, setNav] = useState('messages'), [toast, setToast] = useState(''), [chatSearch, setChatSearch] = useState(false), [messageQuery, setMessageQuery] = useState(''), [emoji, setEmoji] = useState(false), [pending, setPending] = useState(null), [sending, setSending] = useState(false), [connected, setConnected] = useState(false), [typing, setTyping] = useState([]), [muted, setMuted] = useState(() => load('ptit-muted', []));
  const [groupName, setGroupName] = useState(''), [chosen, setChosen] = useState([]), [memberQuery, setMemberQuery] = useState(''), [modalError, setModalError] = useState(''), [profile, setProfile] = useState({}), [groupDescription, setGroupDescription] = useState('');
  const [isOnline, setIsOnline] = useState(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const outboxRef = useRef([]);

  // Group 2: Reactions, Pin Message & Change Password States
  const [reactingMsgId, setReactingMsgId] = useState(null);
  const [showChangePass, setShowChangePass] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changePassLoading, setChangePassLoading] = useState(false);
  const [changePassError, setChangePassError] = useState('');

  // WebRTC Audio/Video Call States & Refs
  const [callState, setCallState] = useState('idle'); // 'idle' | 'calling' | 'incoming' | 'connected'
  const [callData, setCallData] = useState(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const localVideoEl = useRef(null);
  const remoteVideoEl = useRef(null);
  const callTimerRef = useRef(null);

  // Group WebRTC Mesh Call States & Refs
  const [groupCallState, setGroupCallState] = useState('idle'); // 'idle' | 'in-call'
  const [groupCallData, setGroupCallData] = useState(null);
  const [groupPeers, setGroupPeers] = useState([]);
  const [activeGroupCallInfo, setActiveGroupCallInfo] = useState(null);
  const groupPeersRef = useRef(new Map());
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const screenStreamRef = useRef(null);
  const [replyingTo, setReplyingTo] = useState(null);

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const cleanupCall = () => {
    if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (remoteStreamRef.current) { remoteStreamRef.current.getTracks().forEach(t => t.stop()); remoteStreamRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    setCallState('idle'); setCallData(null); setCallSeconds(0); setIsMuted(false); setIsVideoOff(false); setIsScreenSharing(false);
  };

  const bottom = useRef(), fileInput = useRef(), imageInput = useRef(), textInput = useRef(), socket = useRef(), typingTimeout = useRef(), avatarInput = useRef(), selectedRef = useRef(selected);
  selectedRef.current = selected;
  const me = session?.user, server = session?.mode === 'server';
  const isMe = id => {
    if (!id || !me) return false;
    const target = String(id._id || id.id || id);
    const myId = String(me._id || me.id || '');
    return (Boolean(myId) && target === myId) || (Boolean(me.username) && (target === me.username || id?.username === me.username));
  };
  const notify = msg => setToast(msg);

  const flushOutbox = async () => {
    if (!outboxRef.current.length || !session) return;
    const queue = [...outboxRef.current];
    outboxRef.current = [];
    for (const item of queue) {
      try {
        if (server) {
          const msg = await api(`/conversations/${item.conversationId}/messages`, {
            token: session.token,
            method: 'POST',
            body: { text: item.text, file: item.file, clientTempId: item.clientTempId, replyTo: item.replyTo }
          });
          setData(d => ({
            ...d,
            conversations: d.conversations.map(c =>
              (c.id || c._id) === item.conversationId
                ? {
                    ...c,
                    messages: c.messages.map(m =>
                      (m.clientTempId && m.clientTempId === item.clientTempId) || m.id === item.clientTempId
                        ? { ...m, ...msg, id: msg._id || msg.id, pending: false, status: 'sent' }
                        : m
                    )
                  }
                : c
            )
          }));
        }
      } catch (err) {
        console.error('Lỗi gửi lại outbox:', err);
        outboxRef.current.push(item);
      }
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      notify('Đã kết nối Internet trở lại!');
      flushOutbox();
    };
    const handleOffline = () => {
      setIsOnline(false);
      notify('Mất kết nối Internet. Tin nhắn đang được lưu vào hàng đợi.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [session, server]);

  useEffect(() => {
    if (localVideoEl.current && localStreamRef.current) {
      localVideoEl.current.srcObject = localStreamRef.current;
    }
    if (remoteVideoEl.current && remoteStreamRef.current) {
      remoteVideoEl.current.srcObject = remoteStreamRef.current;
    }
  }, [callState, isVideoOff, callData]);

  const startCall = async (isVideo) => {
    if (!active || active.type !== 'direct') {
      notify('Cuộc gọi đa phương tiện chỉ hỗ trợ trò chuyện 1-1');
      return;
    }
    const recipient = other(active);
    const recipientId = recipient.id || recipient._id;
    const convId = active.id || active._id;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          if (remoteVideoEl.current) {
            remoteVideoEl.current.srcObject = event.streams[0];
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket.current) {
          socket.current.emit('call:ice-candidate', {
            targetUserId: recipientId,
            candidate: event.candidate
          });
        }
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      socket.current?.emit('call:start', {
        recipientId,
        conversationId: convId,
        offer,
        isVideo,
        callerName: me.name || me.displayName,
        callerAvatar: me.avatar
      });

      setCallData({
        recipient,
        targetUserId: recipientId,
        isVideo,
        isCaller: true
      });
      setCallState('calling');
    } catch (err) {
      notify('Không thể mở thiết bị Camera/Micro: ' + err.message);
      cleanupCall();
    }
  };

  const acceptIncomingCall = async () => {
    if (!callData || !callData.offer) return;
    const isVideo = callData.isVideo;
    const callerId = callData.callerId;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      localStreamRef.current = stream;

      const pc = new RTCPeerConnection(rtcConfig);
      pcRef.current = pc;

      stream.getTracks().forEach(track => pc.addTrack(track, stream));

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          remoteStreamRef.current = event.streams[0];
          if (remoteVideoEl.current) {
            remoteVideoEl.current.srcObject = event.streams[0];
          }
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket.current) {
          socket.current.emit('call:ice-candidate', {
            targetUserId: callerId,
            candidate: event.candidate
          });
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(callData.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socket.current?.emit('call:accept', {
        callerId,
        answer
      });

      setCallData(d => ({ ...d, targetUserId: callerId }));
      setCallState('connected');
      setCallSeconds(0);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
    } catch (err) {
      notify('Không thể mở Camera/Micro: ' + err.message);
      rejectIncomingCall();
    }
  };

  const rejectIncomingCall = () => {
    if (callData?.callerId) {
      socket.current?.emit('call:reject', { callerId: callData.callerId });
    }
    cleanupCall();
  };

  const endCurrentCall = () => {
    if (callData?.targetUserId) {
      socket.current?.emit('call:end', { targetUserId: callData.targetUserId });
    }
    cleanupCall();
  };

  const toggleAudioMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideoOff = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const stopScreenShare = async () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    setIsScreenSharing(false);
    const cameraTrack = localStreamRef.current ? localStreamRef.current.getVideoTracks()[0] : null;
    if (pcRef.current && cameraTrack) {
      const senders = pcRef.current.getSenders();
      const videoSender = senders.find(s => s.track && s.track.kind === 'video');
      if (videoSender) await videoSender.replaceTrack(cameraTrack).catch(() => {});
    }
    for (const [, peer] of groupPeersRef.current.entries()) {
      if (peer.pc && cameraTrack) {
        const senders = peer.pc.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) await videoSender.replaceTrack(cameraTrack).catch(() => {});
      }
    }
    if (localVideoEl.current && localStreamRef.current) {
      localVideoEl.current.srcObject = localStreamRef.current;
    }
  };

  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        notify('Trình duyệt không hỗ trợ chia sẻ màn hình');
        return;
      }
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' }, audio: false });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      screenStreamRef.current = screenStream;
      setIsScreenSharing(true);

      if (pcRef.current) {
        const senders = pcRef.current.getSenders();
        const videoSender = senders.find(s => s.track && s.track.kind === 'video');
        if (videoSender) await videoSender.replaceTrack(screenTrack).catch(() => {});
      }

      for (const [, peer] of groupPeersRef.current.entries()) {
        if (peer.pc) {
          const senders = peer.pc.getSenders();
          const videoSender = senders.find(s => s.track && s.track.kind === 'video');
          if (videoSender) await videoSender.replaceTrack(screenTrack).catch(() => {});
        }
      }

      if (localVideoEl.current) {
        localVideoEl.current.srcObject = screenStream;
      }

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        notify('Không thể chia sẻ màn hình: ' + err.message);
      }
    }
  };

  const formatCallTime = (sec) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const createGroupPeerConnection = async (targetUserId, targetUser, isInitiator, isVideo, convId) => {
    try {
      const pc = new RTCPeerConnection(rtcConfig);

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const remoteStream = event.streams[0];
          setGroupPeers(prev => {
            const filtered = prev.filter(p => String(p.userId) !== String(targetUserId));
            return [...filtered, { userId: targetUserId, user: targetUser, stream: remoteStream, isVideo }];
          });
          const peerObj = groupPeersRef.current.get(String(targetUserId));
          if (peerObj) peerObj.stream = remoteStream;
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && socket.current) {
          socket.current.emit('group-call:signal', {
            conversationId: convId,
            toUserId: targetUserId,
            signal: { type: 'ice-candidate', candidate: event.candidate }
          });
        }
      };

      groupPeersRef.current.set(String(targetUserId), { pc, user: targetUser });

      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.current?.emit('group-call:signal', {
          conversationId: convId,
          toUserId: targetUserId,
          signal: { type: 'offer', sdp: offer }
        });
      }

      return pc;
    } catch (err) {
      console.error('Lỗi khởi tạo peer connection nhóm:', err);
    }
  };

  const startGroupCall = async (isVideo = false, targetConv = active) => {
    if (!targetConv || targetConv.type !== 'group') return;
    const convId = String(targetConv.id || targetConv._id);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      localStreamRef.current = stream;

      setGroupCallState('in-call');
      setGroupCallData({ conversationId: convId, groupName: targetConv.name, isVideo });
      setCallSeconds(0);
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      callTimerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);

      socket.current?.emit('group-call:join', {
        conversationId: convId,
        isVideo,
        groupName: targetConv.name
      });
      setActiveGroupCallInfo(null);
    } catch (err) {
      notify('Không thể truy cập Microphone/Camera: ' + err.message);
      leaveGroupCall();
    }
  };

  const leaveGroupCall = () => {
    if (groupCallData?.conversationId && socket.current) {
      socket.current.emit('group-call:leave', {
        conversationId: groupCallData.conversationId
      });
    }
    for (const [, p] of groupPeersRef.current.entries()) {
      if (p.pc) p.pc.close();
    }
    groupPeersRef.current.clear();
    setGroupPeers([]);
    setGroupCallState('idle');
    setGroupCallData(null);
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
    }
    setIsMuted(false);
    setIsVideoOff(false);
    setIsScreenSharing(false);
  };
  useEffect(() => {
    try { localStorage.setItem('ptit-theme', theme); } catch { }
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.body.classList.toggle('dark', theme === 'dark');
      document.documentElement.setAttribute('data-theme', theme);
    }
  }, [theme]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(''), 3800); return () => clearTimeout(t); }, [toast]);
  useEffect(() => { if (session) { try { localStorage.setItem('ptit-session', JSON.stringify(session)); } catch { notify('Không thể lưu phiên đăng nhập trên trình duyệt.'); } } }, [session]);
  useEffect(() => { if (session?.mode === 'demo') { try { localStorage.setItem('ptit-state', JSON.stringify(data)); } catch { notify('Không thể lưu dữ liệu: bộ nhớ trình duyệt đã đầy.'); } } }, [data, session?.mode]);
  useEffect(() => { function sync(e) { if (e.key === 'ptit-state' && e.newValue && !server) { try { setData(JSON.parse(e.newValue)); } catch { } } } window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync); }, [server]);
  useEffect(() => {
    if (!session) return; if (!server) { const meP = { ...me, id: String(me.id || me._id), online: true }; setData(d => ({ ...d, people: d.people.some(p => isMe(p)) ? d.people.map(p => isMe(p) ? { ...p, ...meP } : p) : [meP, ...d.people] })); return; }
    let active = true; async function refresh() { try { const [users, conversations] = await Promise.all([api('/users?all=true', { token: session.token }), api('/conversations', { token: session.token })]); if (active) { const convList = Array.isArray(conversations) ? conversations : (conversations?.data || []); const userList = Array.isArray(users) ? users : (users?.users || users?.data || []); const mePerson = me ? { ...me, id: String(me._id || me.id), _id: me._id || me.id, name: me.displayName || me.name || me.username || 'Tôi', displayName: me.displayName || me.name || me.username || 'Tôi', online: true, color: me.color || '#b52740' } : null; const mergedPeople = mePerson ? [mePerson, ...userList.filter(u => !isMe(u))] : userList; setData({ people: mergedPeople, conversations: convList }); if (convList.length > 0 && (!selectedRef.current || selectedRef.current === 'project' || !convList.some(c => (c.id || c._id) === selectedRef.current))) { setSelected(convList[0].id || convList[0]._id); } } } catch (e) { if (active) notify(e.message); } }
    refresh(); const s = io({ auth: { token: session.token } }); socket.current = s;
    s.on('connect', () => { setConnected(true); refresh(); flushOutbox(); });
    s.on('disconnect', () => { setConnected(false); setTyping([]); cleanupCall(); });
    s.on('connect_error', () => setConnected(false));

    const handleIncomingMessage = ({ conversationId, message }) => {
      const cid = String(conversationId || message.conversationId);
      setData(d => ({
        ...d,
        conversations: d.conversations.map(c =>
          (c.id || c._id) === cid
            ? {
                ...c,
                messages: c.messages.some(m => (m.id || m._id) === (message.id || message._id) || (m.clientTempId && m.clientTempId === message.clientTempId))
                  ? c.messages.map(m => (m.clientTempId && m.clientTempId === message.clientTempId) ? { ...m, ...message, pending: false } : m)
                  : [...c.messages, message],
                unread: cid === selectedRef.current ? 0 : isMe(message.sender) ? c.unread : (c.unread || 0) + 1
              }
            : c
        )
      }));
      if (message?._id || message?.id) {
        s.emit('message:delivered', { messageId: message._id || message.id, conversationId: cid });
      }
      if (cid === selectedRef.current && !isMe(message.sender)) {
        s.emit('message:seen', { conversationId: cid });
      }
    };
    s.on('message', handleIncomingMessage);
    s.on('message:new', (msg) => handleIncomingMessage({ conversationId: msg.conversationId, message: msg }));

    s.on('message:delivered', ({ messageId, conversationId }) => {
      setData(d => ({
        ...d,
        conversations: d.conversations.map(c =>
          (c.id || c._id) === String(conversationId)
            ? {
                ...c,
                messages: c.messages.map(m =>
                  (m.id || m._id) === String(messageId) && m.status !== 'seen'
                    ? { ...m, status: 'delivered' }
                    : m
                )
              }
            : c
        )
      }));
    });

    s.on('message:seen', ({ conversationId }) => {
      setData(d => ({
        ...d,
        conversations: d.conversations.map(c =>
          (c.id || c._id) === String(conversationId)
            ? {
                ...c,
                messages: c.messages.map(m =>
                  isMe(m.sender) ? { ...m, status: 'seen' } : m
                )
              }
            : c
        )
      }));
    });

    s.on('message:reaction', ({ messageId, conversationId, reactions }) => {
      setData(d => ({
        ...d,
        conversations: d.conversations.map(c =>
          (c.id || c._id) === String(conversationId)
            ? {
                ...c,
                messages: c.messages.map(m =>
                  (m.id || m._id) === String(messageId)
                    ? { ...m, reactions }
                    : m
                )
              }
            : c
        )
      }));
    });

    s.on('conversation:pinned', ({ conversationId, pinnedMessage }) => {
      setData(d => ({
        ...d,
        conversations: d.conversations.map(c =>
          (c.id || c._id) === String(conversationId)
            ? {
                ...c,
                pinnedMessage,
                messages: c.messages.map(m => ({
                  ...m,
                  isPinned: pinnedMessage ? ((m.id || m._id) === (pinnedMessage._id || pinnedMessage.id)) : false
                }))
              }
            : c
        )
      }));
    });

    // WebRTC Call events
    s.on('call:incoming', ({ callerId, callerName, callerAvatar, conversationId, offer, isVideo }) => {
      setCallData({ callerId, callerName, callerAvatar, conversationId, offer, isVideo, isCaller: false });
      setCallState('incoming');
    });

    s.on('call:accepted', async ({ calleeId, answer }) => {
      try {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription(answer));
          setCallState('connected');
          setCallSeconds(0);
          if (callTimerRef.current) clearInterval(callTimerRef.current);
          callTimerRef.current = setInterval(() => setCallSeconds(sec => sec + 1), 1000);
          notify('Cuộc gọi đã được kết nối');
        }
      } catch (err) {
        console.error('Lỗi nhận answer:', err);
      }
    });

    s.on('call:ice-candidate', async ({ senderId, candidate }) => {
      try {
        if (pcRef.current && candidate) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        }
      } catch (err) {
        console.error('Lỗi add ICE candidate:', err);
      }
    });

    s.on('call:rejected', ({ reason }) => {
      notify(reason || 'Cuộc gọi đã bị từ chối');
      cleanupCall();
    });

    s.on('call:ended', () => {
      notify('Cuộc gọi đã kết thúc');
      cleanupCall();
    });

    // Group WebRTC Mesh Call events
    s.on('group-call:ring', (info) => {
      if (groupCallState !== 'in-call') {
        setActiveGroupCallInfo(info);
      }
    });

    s.on('group-call:existing-users', async ({ conversationId, participants }) => {
      for (const p of participants) {
        await createGroupPeerConnection(p.userId, p, true, p.isVideo, conversationId);
      }
    });

    s.on('group-call:user-joined', ({ user }) => {
      notify(`${user.name} đã tham gia cuộc gọi nhóm`);
    });

    s.on('group-call:signal', async ({ conversationId, fromUserId, signal }) => {
      try {
        if (signal.type === 'offer') {
          const incomingUser = person(fromUserId);
          const pc = await createGroupPeerConnection(fromUserId, incomingUser, false, true, conversationId);
          if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            s.emit('group-call:signal', {
              conversationId,
              toUserId: fromUserId,
              signal: { type: 'answer', sdp: answer }
            });
          }
        } else if (signal.type === 'answer') {
          const peerObj = groupPeersRef.current.get(String(fromUserId));
          if (peerObj?.pc) {
            await peerObj.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          }
        } else if (signal.type === 'ice-candidate') {
          const peerObj = groupPeersRef.current.get(String(fromUserId));
          if (peerObj?.pc && signal.candidate) {
            await peerObj.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          }
        }
      } catch (err) {
        console.error('Lỗi xử lý signal nhóm:', err);
      }
    });

    s.on('group-call:user-left', ({ userId }) => {
      const peerObj = groupPeersRef.current.get(String(userId));
      if (peerObj?.pc) peerObj.pc.close();
      groupPeersRef.current.delete(String(userId));
      setGroupPeers(prev => prev.filter(p => String(p.userId) !== String(userId)));
      notify(`${person(userId).name} đã rời cuộc gọi nhóm`);
    });

    s.on('group-call:updated', ({ conversationId, participantCount }) => {
      setActiveGroupCallInfo(prev => prev && prev.conversationId === conversationId ? { ...prev, participantCount } : prev);
    });

    s.on('group-call:ended', ({ conversationId }) => {
      setActiveGroupCallInfo(prev => prev && prev.conversationId === conversationId ? null : prev);
      if (groupCallData?.conversationId === conversationId) {
        leaveGroupCall();
        notify('Cuộc gọi nhóm đã kết thúc');
      }
    });

    s.on('conversation', conversation => setData(d => ({ ...d, conversations: d.conversations.some(c => (c.id || c._id) === (conversation.id || conversation._id)) ? d.conversations.map(c => (c.id || c._id) === (conversation.id || conversation._id) ? { ...c, ...conversation, messages: (c.messages && c.messages.length) ? c.messages : (conversation.messages || []) } : c) : [conversation, ...d.conversations] }))); s.on('presence:list', ({ onlineUserIds }) => { if (Array.isArray(onlineUserIds)) { const set = new Set(onlineUserIds.map(String)); setData(d => ({ ...d, people: d.people.map(p => ({ ...p, online: isMe(p) ? true : set.has(String(p._id || p.id)) })) })); } }); s.on('user:online', ({ userId }) => setData(d => ({ ...d, people: d.people.map(p => String(p._id || p.id) === String(userId) ? { ...p, online: true } : p) }))); s.on('user:offline', ({ userId }) => setData(d => ({ ...d, people: d.people.map(p => (String(p._id || p.id) === String(userId) && !isMe(p)) ? { ...p, online: false } : p) }))); s.on('presence', ({ id, userId, online }) => { const target = String(id || userId); setData(d => ({ ...d, people: d.people.map(p => (String(p._id || p.id) === target && !isMe(p)) ? { ...p, online: !!online } : p) })); }); const updatePerson = user => { const targetId = String(user.id || user._id); const targetName = user.displayName || user.name || user.username; const formatted = { ...user, id: targetId, _id: user._id || targetId, name: targetName, displayName: targetName }; setData(d => ({ ...d, people: d.people.some(p => String(p.id || p._id) === targetId) ? d.people.map(p => String(p.id || p._id) === targetId ? { ...p, ...formatted } : p) : [...d.people, formatted] })); if (isMe(user)) { setSession(s => s ? ({ ...s, user: { ...s.user, ...formatted } }) : s); } }; s.on('profile', updatePerson); s.on('user', updatePerson); s.on('typing', ({ conversationId, userId, isTyping }) => setTyping(prev => [...prev.filter(t => t.userId !== userId), ...(isTyping ? [{ conversationId, userId }] : [])])); return () => { active = false; cleanupCall(); leaveGroupCall(); s.disconnect(); socket.current = null; };
  }, [session?.user?.id, session?.user?._id, session?.token]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [selected, data.conversations.find(c => c.id === selected)?.messages.length, pending]);
  useEffect(() => { setDraft(''); setPending(null); setMessageQuery(''); setChatSearch(false); setEmoji(false); }, [selected]);
  useEffect(() => {
    if (selected) {
      setData(d => ({ ...d, conversations: d.conversations.map(c => c.id === selected ? { ...c, unread: 0 } : c) }));
      if (server) {
        socket.current?.emit('message:seen', { conversationId: selected });
        api(`/messages/${selected}/seen`, { token: session.token, method: 'PATCH' }).catch(() => {});
      }
    }
  }, [selected, session?.user?.id, session?.user?._id, server]);
  useEffect(() => () => clearTimeout(typingTimeout.current), []);
  function login(s) { if (s.mode === 'demo') setData(load('ptit-state', initialState())); else setData({ people: [], conversations: [] }); setSession(s); setSelected(s.user.id === 'minhanh' ? 'project' : null); setQuery(''); setTab('all'); setNav('messages'); }
  function logout() { cleanupCall(); leaveGroupCall(); socket.current?.disconnect(); setSession(null); localStorage.removeItem('ptit-session'); setModal(null); setConnected(false); }
  const person = id => {
    if (isMe(id)) {
      return {
        ...me,
        id: String(me._id || me.id),
        _id: me._id || me.id,
        name: me.displayName || me.name || me.username || 'Bạn',
        displayName: me.displayName || me.name || me.username || 'Bạn',
        online: true,
        color: me.color || '#b52740'
      };
    }
    const idStr = String(id?._id || id?.id || id);
    return data.people.find(p => String(p._id || p.id) === idStr) || { id: idStr, name: 'Người dùng', color: '#987b8a' };
  };
  const conversations = (data.conversations || []).filter(c => c.members && (c.members.some(m => isMe(m))));
  const active = conversations.find(c => (c.id || c._id) === selected);
  const other = c => person(c?.members?.find(id => !isMe(id)));
  const title = c => c?.type === 'group' ? c.name : (other(c)?.name || other(c)?.displayName || 'Cuộc trò chuyện');
  const visible = conversations.filter(c => (tab !== 'unread' || c.unread > 0) && (tab !== 'groups' || c.type === 'group') && normalize(title(c)).includes(normalize(query)));
  const activeMembers = active?.members.map(person) || [];
  const messages = (active?.messages || []).filter(m => normalize(`${m.text} ${m.file?.name || ''}`).includes(normalize(messageQuery)));
  const files = (active?.messages || []).filter(m => m.file && !m.file.type?.startsWith('image/'));
  const photos = (active?.messages || []).filter(m => m.image || m.file?.type?.startsWith('image/'));
  const onlinePeople = data.people.filter(p => !isMe(p) && p.online);
  const onlineLabel = server ? 'Đang hoạt động' : 'Online · dữ liệu mẫu';
  function openConversation(c) { setSelected(c.id); setMobileChat(true); setNav('messages'); setData(d => ({ ...d, conversations: d.conversations.map(x => x.id === c.id ? { ...x, unread: 0 } : x) })); }
  function openModal(type) { setModalError(''); setMemberQuery(''); setChosen([]); setGroupName(''); setModal(type); if (type === 'profile') setProfile({ ...me, name: me?.displayName || me?.name || me?.username || '', studentId: me?.studentId || '', email: me?.email || '', bio: me?.bio || '' }); if (type === 'editgroup') { setGroupName(active?.name || ''); setGroupDescription(active?.description || ''); } }
  async function createConversation(type, members, name) { setModalError(''); try { let c; if (server) c = await api('/conversations', { token: session.token, method: 'POST', body: { type, members, name } }); else { const existing = type === 'direct' && conversations.find(c => c.type === 'direct' && c.members.includes(members[0])); c = existing || { id: uid(), type, name, members: [me.id, ...members], messages: [], createdAt: new Date().toISOString(), color: '#b52740', description: '' }; } setData(d => ({ ...d, conversations: d.conversations.some(x => x.id === c.id) ? d.conversations : [c, ...d.conversations] })); setSelected(c.id); setMobileChat(true); setModal(null); setNav('messages'); notify(type === 'group' ? 'Đã tạo nhóm thành công' : 'Cuộc trò chuyện đã sẵn sàng'); } catch (e) { setModalError(e.message); } }
  async function send(e) {
    e?.preventDefault(); if (!active || sending || (!draft.trim() && !pending)) return;
    const text = draft.trim();
    const conversationId = active.id || active._id;
    const clientTempId = uid();
    const replyTarget = replyingTo ? {
      id: replyingTo.id || replyingTo._id,
      _id: replyingTo._id || replyingTo.id,
      text: replyingTo.text,
      sender: replyingTo.sender,
      attachments: replyingTo.attachments || (replyingTo.file ? [replyingTo.file] : [])
    } : null;

    // Offline Resilience: enqueue to outbox if offline or disconnected from server
    if (!isOnline || (server && !connected)) {
      let file;
      if (pending) {
        file = { id: clientTempId, name: pending.name, size: pending.size, type: pending.type || 'application/octet-stream' };
      }
      const queuedMessage = {
        id: clientTempId,
        clientTempId,
        sender: me.id,
        text,
        time: new Date().toISOString(),
        pending: true,
        status: 'pending',
        ...(file ? { file } : {}),
        ...(replyTarget ? { replyTo: replyTarget } : {})
      };
      outboxRef.current.push({ conversationId, text, file, clientTempId, replyTo: replyTarget ? replyTarget.id : undefined });
      setData(d => ({
        ...d,
        conversations: d.conversations.map(c =>
          (c.id || c._id) === conversationId
            ? { ...c, messages: [...c.messages, queuedMessage] }
            : c
        )
      }));
      setDraft('');
      setPending(null);
      setReplyingTo(null);
      notify('Mất kết nối mạng: Tin nhắn đã được lưu vào hàng đợi gửi');
      return;
    }

    setSending(true);
    try {
      let file;
      if (pending) {
        const id = uid();
        if (server) {
          const data = await new Promise((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(r.result);
            r.onerror = reject;
            r.readAsDataURL(pending);
          });
          file = { name: pending.name, size: pending.size, type: pending.type || 'application/octet-stream', data };
        } else {
          await saveFile(id, pending);
          file = { id, name: pending.name, size: pending.size, type: pending.type || 'application/octet-stream' };
        }
      }
      let message = { id: clientTempId, clientTempId, sender: me.id, text, time: new Date().toISOString(), status: 'sent', ...(file ? { file } : {}), ...(replyTarget ? { replyTo: replyTarget } : {}) };
      if (server) {
        message = await api(`/conversations/${conversationId}/messages`, {
          token: session.token,
          method: 'POST',
          body: { text, file, clientTempId, ...(replyTarget ? { replyTo: replyTarget.id } : {}) }
        });
      }
      setData(d => ({
        ...d,
        conversations: d.conversations.map(c =>
          (c.id || c._id) === conversationId
            ? {
                ...c,
                messages: c.messages.some(m => (m.id || m._id) === (message.id || message._id) || (m.clientTempId && m.clientTempId === clientTempId))
                  ? c.messages.map(m => (m.clientTempId === clientTempId || m.id === clientTempId) ? { ...m, ...message, id: message._id || message.id, pending: false, status: 'sent' } : m)
                  : [...c.messages, message]
              }
            : c
        )
      }));
      setDraft('');
      setPending(null);
      setReplyingTo(null);
      setEmoji(false);
      socket.current?.emit('typing', { conversationId, isTyping: false });
      textInput.current?.focus();
    } catch (e) {
      notify(`Chưa gửi được tin nhắn: ${e.message}`);
    } finally {
      setSending(false);
    }
  }
  function changeDraft(value) { setDraft(value); if (server && active) { const conversationId = active.id || active._id; socket.current?.emit('typing', { conversationId, isTyping: true }); clearTimeout(typingTimeout.current); typingTimeout.current = setTimeout(() => socket.current?.emit('typing', { conversationId, isTyping: false }), 1800); } }
  function attach(e) { const f = e.target.files?.[0]; if (f) { if (f.size > 5 * 1024 * 1024) notify('Vui lòng chọn tệp không quá 5 MB.'); else setPending(f); } e.target.value = ''; }
  async function download(file) {
    try {
      if (file.sample) { const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 91>>stream\nBT /F1 18 Tf 60 720 Td (PTITChat - API Documentation) Tj 0 -30 Td (Demo document) Tj ET\nendstream\nendobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'; const a = document.createElement('a'), url = URL.createObjectURL(new Blob([pdf], { type: 'application/pdf' })); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return; }
      if (file.url) { window.open(file.url.startsWith('http') ? file.url : 'http://localhost:5000' + file.url, '_blank'); return; }
      const blob = file.data ? await (await fetch(file.data)).blob() : await readFile(file.id); if (!blob) throw new Error('Tệp không có trên trình duyệt này.'); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { notify(e.message); }
  }
  async function saveProfile(e) {
    e.preventDefault(); setModalError(''); const trimmedName = profile.name?.trim();
    if (!trimmedName) { setModalError('Họ và tên không được để trống.'); return; }
    try {
      const payload = { name: trimmedName, displayName: trimmedName, email: (profile.email || '').trim(), bio: (profile.bio || '').trim(), studentId: (profile.studentId || '').trim(), avatar: profile.avatar || me.avatar || '' };
      let updated = { ...me, ...payload };
      if (server) {
        const res = await api('/me', { token: session.token, method: 'PATCH', body: payload });
        const serverUser = res?.user || res?.data || res;
        updated = { ...me, ...serverUser, id: String(serverUser.id || serverUser._id || me.id || me._id), _id: serverUser._id || me._id, name: serverUser.name || serverUser.displayName || trimmedName, displayName: serverUser.displayName || serverUser.name || trimmedName, studentId: serverUser.studentId !== undefined ? serverUser.studentId : payload.studentId, email: serverUser.email || payload.email, bio: serverUser.bio !== undefined ? serverUser.bio : payload.bio };
      } else {
        const accounts = load('ptit-accounts', []).map(a => a.id === me.id ? { ...a, ...updated } : a);
        localStorage.setItem('ptit-accounts', JSON.stringify(accounts));
      }
      setSession(s => ({ ...s, user: updated }));
      setData(d => ({ ...d, people: d.people.map(p => (String(p.id || p._id) === String(updated.id || updated._id) || p.username === updated.username) ? { ...p, ...updated } : p) }));
      setModal(null);
      notify('Hồ sơ của bạn đã được cập nhật');
    } catch (e) { setModalError(e.message); }
  }
  async function updateGroup(e) {
    e.preventDefault();
    try {
      if (!groupName.trim()) throw new Error('Vui lòng nhập tên nhóm.');
      const convId = active?.id || active?._id;
      if (!convId) throw new Error('Không xác định được ID nhóm.');
      const payload = { name: groupName.trim(), description: groupDescription ? groupDescription.trim() : '' };
      let updated = { ...active, ...payload };
      if (server) {
        const res = await api(`/conversations/${convId}`, { token: session.token, method: 'PATCH', body: payload });
        const serverConv = res?.data || res;
        updated = { ...active, ...serverConv, id: convId, _id: active._id || convId, name: payload.name, description: payload.description, messages: active.messages || [], members: active.members || [] };
      }
      setData(d => ({ ...d, conversations: d.conversations.map(c => ((c.id || c._id) === convId) ? { ...c, ...updated } : c) }));
      setModal(null);
      notify('Đã cập nhật thông tin nhóm');
    } catch (e) { setModalError(e.message); }
  }
  const toggleReaction = async (messageId, emojiChar) => {
    if (!messageId || !emojiChar) return;
    const cid = String(active?.id || active?._id);
    const myId = String(me?._id || me?.id);

    setData(d => ({
      ...d,
      conversations: d.conversations.map(c => {
        if ((c.id || c._id) !== cid) return c;
        return {
          ...c,
          messages: c.messages.map(m => {
            if ((m.id || m._id) !== messageId) return m;
            const reactions = [...(m.reactions || [])];
            const idx = reactions.findIndex(r => String(r.user?._id || r.user?.id || r.user) === myId);
            if (idx > -1) {
              if (reactions[idx].emoji === emojiChar) {
                reactions.splice(idx, 1);
              } else {
                reactions[idx] = { ...reactions[idx], emoji: emojiChar };
              }
            } else {
              reactions.push({ user: myId, emoji: emojiChar });
            }
            return { ...m, reactions };
          })
        };
      })
    }));

    if (server) {
      if (socket.current) {
        socket.current.emit('message:react', { messageId, emoji: emojiChar, conversationId: cid });
      }
      try {
        await api(`/messages/${messageId}/react`, {
          token: session.token,
          method: 'PATCH',
          body: { emoji: emojiChar }
        });
      } catch (err) {
        console.error('Lỗi lưu cảm xúc:', err);
      }
    }
  };

  const togglePinMessage = async (m) => {
    const cid = String(active?.id || active?._id);
    const targetId = m.id || m._id;
    const isCurrentlyPinned = Boolean(m.isPinned || (active?.pinnedMessage && (active.pinnedMessage._id || active.pinnedMessage.id) === targetId));
    const newPinnedMessageId = isCurrentlyPinned ? null : targetId;

    setData(d => ({
      ...d,
      conversations: d.conversations.map(c => {
        if ((c.id || c._id) !== cid) return c;
        return {
          ...c,
          pinnedMessage: isCurrentlyPinned ? null : m,
          messages: c.messages.map(msg => ({
            ...msg,
            isPinned: newPinnedMessageId ? ((msg.id || msg._id) === newPinnedMessageId) : false
          }))
        };
      })
    }));

    notify(isCurrentlyPinned ? 'Đã bỏ ghim tin nhắn' : 'Đã ghim tin nhắn lên đầu hội thoại');

    if (server) {
      if (socket.current) {
        socket.current.emit('message:pin', { conversationId: cid, messageId: newPinnedMessageId });
      }
      try {
        await api(`/conversations/${cid}/pin`, {
          token: session.token,
          method: 'PATCH',
          body: { messageId: newPinnedMessageId }
        });
      } catch (err) {
        console.error('Lỗi ghim tin nhắn:', err);
      }
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setChangePassError('');
    if (!currentPassword) {
      setChangePassError('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }
    if (newPassword.length < 6) {
      setChangePassError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setChangePassError('Mật khẩu xác nhận không khớp.');
      return;
    }

    setChangePassLoading(true);
    try {
      if (server) {
        await api('/auth/change-password', {
          token: session.token,
          method: 'POST',
          body: { currentPassword, newPassword }
        });
        notify('Đổi mật khẩu thành công!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setShowChangePass(false);
      } else {
        notify('Chế độ demo: Mật khẩu đã được ghi nhận.');
        setShowChangePass(false);
      }
    } catch (err) {
      setChangePassError(err.message || 'Lỗi đổi mật khẩu.');
    } finally {
      setChangePassLoading(false);
    }
  };

  function toggleMute() { const next = muted.includes(selected) ? muted.filter(id => id !== selected) : [...muted, selected]; setMuted(next); localStorage.setItem('ptit-muted', JSON.stringify(next)); notify(next.includes(selected) ? 'Đã tắt thông báo cuộc trò chuyện' : 'Đã bật thông báo cuộc trò chuyện'); }
  if (!session) return <><Auth onLogin={login} notify={notify} />{toast && <div role="status" className="toast">{toast}</div>}</>;
  return <div className={`app-shell ${theme === 'dark' ? 'dark' : ''} ${mobileChat ? 'mobile-chat-open' : ''} ${right ? 'has-details' : ''}`}>
    <nav className="nav-rail" aria-label="Điều hướng chính"><button className="rail-logo" title="PTITChat" onClick={() => { setNav('messages'); setTab('all'); setQuery(''); setMobileChat(false); }}><MessageCircle size={30} /><i /></button><div className="rail-links"><IconButton label="Tin nhắn" className={nav === 'messages' ? 'active' : ''} onClick={() => { setNav('messages'); setTab('all'); setQuery(''); setMobileChat(false); }}><MessageCircle size={23} /><span className="rail-notification" /></IconButton><IconButton label="Danh bạ" className={nav === 'contacts' ? 'active' : ''} onClick={() => { setNav('contacts'); setMobileChat(false); }}><Users size={23} /></IconButton><IconButton label="Nhóm của tôi" className={nav === 'groups' ? 'active' : ''} onClick={() => { setNav('groups'); setTab('groups'); setMobileChat(false); }}><GraduationCap size={24} /></IconButton></div><div className="rail-bottom"><IconButton label="Cài đặt" onClick={() => openModal('settings')}><Settings size={22} /></IconButton><button className="rail-profile" aria-label="Hồ sơ của tôi" onClick={() => openModal('profile')}><Avatar person={me} size="small" /></button></div></nav>
    <aside className="conversation-panel"><header className="sidebar-brand"><Brand /><span className="beta">BETA</span></header><div className="conversations-heading"><div><span className="section-eyebrow">KHÔNG GIAN CỦA BẠN</span><h1>{nav === 'contacts' ? 'Danh bạ' : nav === 'groups' ? 'Nhóm của tôi' : 'Tin nhắn'}<span>{nav === 'contacts' ? data.people.length - 1 : conversations.length}</span></h1></div><IconButton className="new-chat" label={nav === 'groups' ? 'Tạo nhóm' : 'Cuộc trò chuyện mới'} onClick={() => openModal(nav === 'groups' ? 'group' : 'new')}><Plus size={21} /></IconButton></div><div className="sidebar-search"><Search size={17} /><input aria-label="Tìm kiếm cuộc trò chuyện" placeholder={nav === 'contacts' ? 'Tìm kiếm bạn bè...' : 'Tìm kiếm cuộc trò chuyện...'} value={query} onChange={e => setQuery(e.target.value)} />{query && <IconButton label="Xóa tìm kiếm" onClick={() => setQuery('')}><X size={14} /></IconButton>}</div>
      {nav === 'contacts' ? <div className="contact-list">{data.people.filter(p => !isMe(p) && normalize((p.name || p.displayName || '') + ' ' + (p.username || '')).includes(normalize(query))).map(p => <button className="contact-row" key={p.id || p._id} onClick={() => createConversation('direct', [p.id || p._id])}><Avatar person={p} online /><span><b>{p.name || p.displayName}</b><small>@{p.username} · {p.online ? 'Online' : 'Offline'}</small></span><MessageCircle size={18} /></button>)}</div> : <><div className="conversation-tabs">{[['all', 'Tất cả'], ['unread', 'Chưa đọc'], ['groups', 'Nhóm']].map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}{key === 'unread' && <span>{conversations.filter(c => c.unread > 0).length}</span>}</button>)}</div><div className="conversation-scroll">{visible.some(c => c.pinned) && <div className="list-label"><Pin size={12} /> ĐÃ GHIM</div>}{[...visible.filter(c => c.pinned), ...visible.filter(c => !c.pinned)].map((c, i) => <React.Fragment key={c.id}>{!c.pinned && (i === 0 || visible.filter(x => x.pinned).length === i) && <div className="list-label">CUỘC TRÒ CHUYỆN</div>}<button className={`conversation-item ${c.id === selected ? 'selected' : ''}`} onClick={() => openConversation(c)}><Avatar person={c.type === 'direct' ? other(c) : null} group={c.type === 'group' ? c : null} online={c.type === 'direct'} /><span className="conversation-text"><span className="conversation-name"><b>{title(c)}{c.emoji && <em>{c.emoji}</em>}</b><time>{c.messages.length ? timeText(c.messages.at(-1).time) : 'Mới'}</time></span><span className="conversation-preview"><span>{c.messages.at(-1)?.sender === me.id ? 'Bạn: ' : ''}{c.messages.at(-1)?.text || c.messages.at(-1)?.file?.name || 'Bắt đầu cuộc trò chuyện'}</span>{c.unread > 0 ? <b className="unread-badge">{c.unread}</b> : c.pinned ? <Pin size={12} /> : null}</span></span></button></React.Fragment>)}{!visible.length && <div className="empty-small"><Search size={28} /><p>{tab === 'unread' ? 'Bạn đã đọc tất cả tin nhắn!' : 'Không tìm thấy cuộc trò chuyện'}</p><button onClick={() => openModal('new')}>Bắt đầu trò chuyện mới</button></div>}</div></>}
      <div className="online-section"><div className="online-title"><span><i /> ĐANG HOẠT ĐỘNG</span><span>{onlinePeople.length}</span></div><div className="online-avatars">{onlinePeople.slice(0, 5).map(p => <button key={p.id} onClick={() => createConversation('direct', [p.id])} title={p.name}><Avatar person={p} online size="small" /><span>{p.name.split(' ').at(-1)}</span></button>)}</div></div><button className="create-group" onClick={() => openModal('group')}><span><Users size={19} /></span><div><b>Cùng nhau kết nối</b><small>Tạo nhóm, chia sẻ nhiều hơn</small></div><Plus size={18} /></button><button className="sidebar-user" onClick={() => openModal('profile')}><Avatar person={{ ...me, online: server ? connected : true }} size="small" online /><span><b>{me.name || me.displayName}</b><small><i />{server ? (connected ? 'Đã kết nối' : 'Đang kết nối...') : 'Chế độ trải nghiệm'}</small></span><MoreHorizontal size={20} /></button></aside>
    <main className="chat-panel">{(!isOnline || (server && !connected)) && <div className="offline-banner" role="alert"><WifiOff size={16} /><span>{!isOnline ? 'Mất kết nối Internet. Tin nhắn đang được lưu vào hàng đợi.' : 'Đang kết nối lại máy chủ Socket.IO...'}</span><button type="button" className="reconnect-btn" onClick={() => { if (server && socket.current) socket.current.connect(); flushOutbox(); }}>Thử kết nối lại</button></div>}{!active ? <div className="welcome-chat"><span className="welcome-icon"><MessageCircle size={38} /></span><span className="section-eyebrow">PTITCHAT · KẾT NỐI KHÔNG KHOẢNG CÁCH</span><h2>Một lời chào, một kết nối mới.</h2><p>Chọn một cuộc trò chuyện hoặc tìm bạn bè<br />để bắt đầu chia sẻ những điều thú vị.</p><button className="primary" onClick={() => openModal('new')}><Plus size={18} />Bắt đầu trò chuyện</button></div> : <><header className="chat-header"><IconButton label="Quay lại danh sách" className="mobile-back" onClick={() => setMobileChat(false)}><ArrowLeft size={21} /></IconButton><Avatar person={active.type === 'direct' ? other(active) : null} group={active.type === 'group' ? active : null} online={active.type === 'direct'} /><div className="chat-header-title"><h2>{title(active)} {active.emoji}<ChevronDown size={16} onClick={() => setRight(!right)} /></h2><p>{active.type === 'group' ? <><span className="status-dot" />{active.members.length} thành viên<span className="dot-separator">·</span>{activeMembers.filter(p => p.online).length} đang hoạt động</> : <><span className={`status-dot ${other(active).online ? '' : 'offline'}`} />{other(active).online ? onlineLabel : 'Offline'}</>}</p></div><div className="chat-header-actions">{active.type === 'direct' && <><IconButton label="Gọi thoại" onClick={() => startCall(false)}><Phone size={20} /></IconButton><IconButton label="Gọi video" onClick={() => startCall(true)}><Video size={20} /></IconButton><span className="header-divider" /></>}{active.type === 'group' && <><IconButton label="Gọi thoại nhóm" onClick={() => startGroupCall(false)}><Phone size={20} /></IconButton><IconButton label="Gọi video nhóm" onClick={() => startGroupCall(true)}><Video size={20} /></IconButton><span className="header-divider" /></>}<IconButton label="Tìm trong cuộc trò chuyện" className={chatSearch ? 'tinted' : ''} onClick={() => { setChatSearch(!chatSearch); setMessageQuery(''); }}><Search size={21} /></IconButton><span className="header-divider" /><IconButton label={right ? 'Ẩn thông tin cuộc trò chuyện' : 'Thông tin cuộc trò chuyện'} className={right ? 'tinted' : ''} onClick={() => setRight(!right)}><Info size={21} /></IconButton></div></header>{activeGroupCallInfo && activeGroupCallInfo.conversationId === (active.id || active._id) && groupCallState !== 'in-call' && <div className="group-call-banner"><div className="group-call-banner-left"><Video size={20} /><div><b>Cuộc gọi nhóm đang diễn ra</b><small>{activeGroupCallInfo.participantCount || 1} thành viên đang tham gia · Bắt đầu bởi {activeGroupCallInfo.callerName}</small></div></div><button type="button" className="btn-join-group-call" onClick={() => startGroupCall(activeGroupCallInfo.isVideo)}>Tham gia ngay</button></div>}
      {chatSearch && <div className="message-search"><Search size={18} /><input autoFocus placeholder="Tìm nội dung tin nhắn hoặc tên tệp..." aria-label="Tìm tin nhắn" value={messageQuery} onChange={e => setMessageQuery(e.target.value)} /><small>{messages.length} kết quả</small><IconButton label="Đóng tìm kiếm tin nhắn" onClick={() => { setChatSearch(false); setMessageQuery(''); }}><X size={18} /></IconButton></div>}
      {active.pinnedMessage ? (
        <div className="pinned-message-bar" onClick={() => {
          const el = document.getElementById('msg-' + (active.pinnedMessage._id || active.pinnedMessage.id));
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}>
          <div className="pinned-bar-content">
            <span className="pinned-bar-icon"><Pin size={15} /></span>
            <div className="pinned-bar-text">
              <b>Tin nhắn đã ghim:</b>
              <span>{active.pinnedMessage.sender ? (active.pinnedMessage.sender.displayName || active.pinnedMessage.sender.name || active.pinnedMessage.sender.username || 'Thành viên') + ': ' : ''}{active.pinnedMessage.text || active.pinnedMessage.file?.name || 'Tệp đính kèm'}</span>
            </div>
          </div>
          <div className="pinned-bar-actions">
            <button type="button" className="btn-unpin-msg" title="Bỏ ghim tin nhắn" onClick={(e) => { e.stopPropagation(); togglePinMessage(active.pinnedMessage); }}><X size={15} /></button>
          </div>
        </div>
      ) : (
        <div className="pinned-note"><span><Pin size={15} /></span><p><b>Một nhóm nhỏ, những ý tưởng lớn</b><span> Cùng chia sẻ và giữ kết nối mỗi ngày nhé! ✨</span></p><ChevronRight size={16} /></div>
      )}
      <div className="messages" role="log" aria-label="Tin nhắn" aria-live="polite"><div className="chat-start"><span><ShieldCheck size={12} /> Cuộc trò chuyện riêng tư của bạn</span></div>{messages.map((m, index) => {
        if (m.type === 'system') {
          return <div key={m.id || m._id} className="system-message-divider"><span>{m.text}</span></div>;
        }
        const own = isMe(m.sender); const previous = messages[index - 1]; const newDay = !previous || new Date(previous.time).toDateString() !== new Date(m.time).toDateString();
        const reactionMap = {};
        if (Array.isArray(m.reactions)) {
          m.reactions.forEach(r => {
            if (!r?.emoji) return;
            if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, meReacted: false };
            reactionMap[r.emoji].count += 1;
            if (isMe(r.user)) reactionMap[r.emoji].meReacted = true;
          });
        }
        const reactionList = Object.entries(reactionMap);
        const mid = m.id || m._id;

        return <React.Fragment key={mid}>{newDay && <div className="date-divider"><span>{new Date(m.time).toDateString() === new Date().toDateString() ? 'Hôm nay' : new Date(m.time).toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>}<article id={'msg-' + mid} className={`message-row ${own ? 'own' : ''}`}>
          {!own && <Avatar person={person(m.sender)} size="message-avatar" />}
          <div className="message-content">
            {!own && active.type === 'group' && <div className="sender-name">{person(m.sender).name}</div>}
            <div className="bubble-wrapper">
              <div className={`bubble ${m.file ? 'has-file' : ''} ${m.image ? 'has-image' : ''}`}>
                {m.replyTo && (
                  <div className="reply-quote-box" onClick={() => {
                    const targetId = m.replyTo.id || m.replyTo._id || m.replyTo;
                    const el = document.getElementById("msg-" + targetId);
                    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}>
                    <div className="reply-quote-line" />
                    <div className="reply-quote-content">
                      <small>{m.replyTo.sender ? (isMe(m.replyTo.sender) ? "Bạn" : (person(m.replyTo.sender).name || "Thành viên")) : "Tin nhắn trích dẫn"}</small>
                      <p>{m.replyTo.text || (m.replyTo.attachments?.[0]?.fileName || (m.replyTo.file ? m.replyTo.file.name : "Tệp đính kèm"))}</p>
                    </div>
                  </div>
                )}
                {m.text && <p>{m.text}</p>}
                {m.file && (m.file.type?.startsWith('image/') ? <StoredImage className="message-image" file={m.file} onClick={src => setModal({ type: 'image', src, name: m.file.name })} /> : <FileAttachment file={m.file} onOpen={download} />)}
                {m.image && <img className="message-image" src={m.image} alt="Khoảnh khắc sân trường, chia sẻ bởi Hoàng Nam" onClick={() => setModal({ type: 'image', src: m.image, name: 'Khoảnh khắc sân trường' })} />}
              </div>
              <div className={`msg-actions-hover ${reactingMsgId === mid ? 'active-open' : ''}`}>
                <button type="button" className="msg-action-btn" title="Trả lời tin nhắn" onClick={e => { e.stopPropagation(); setReplyingTo(m); textInput.current?.focus(); }}><Reply size={15} /></button>
                <button type="button" className="msg-action-btn" title="Thả cảm xúc" onClick={e => { e.stopPropagation(); setReactingMsgId(reactingMsgId === mid ? null : mid); }}><Smile size={15} /></button>
                <button type="button" className={`msg-action-btn ${m.isPinned ? 'active' : ''}`} title={m.isPinned ? 'Bỏ ghim' : 'Ghim tin nhắn'} onClick={e => { e.stopPropagation(); togglePinMessage(m); }}><Pin size={15} /></button>
                {reactingMsgId === mid && (
                  <div className="reaction-picker-popover" onClick={e => e.stopPropagation()}>
                    {['👍', '❤️', '😂', '😮', '😢', '😡'].map(em => (
                      <button key={em} type="button" className="reaction-emoji-btn" onClick={() => { toggleReaction(mid, em); setReactingMsgId(null); }}>{em}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {reactionList.length > 0 && <div className="msg-reactions">{reactionList.map(([em, info]) => <button key={em} type="button" className={`reaction-pill ${info.meReacted ? 'active' : ''}`} title={info.meReacted ? 'Bỏ cảm xúc ' + em : 'Thả ' + em} onClick={() => toggleReaction(mid, em)}><span>{em}</span><span>{info.count}</span></button>)}</div>}
            <div className="message-time">{timeText(m.time)}{own && <span className={`msg-status ${m.pending ? 'pending' : (m.status === 'seen' || (m.readBy && m.readBy.length > 0)) ? 'seen' : m.status === 'delivered' ? 'delivered' : 'sent'}`} title={m.pending ? 'Đang gửi (hàng đợi)...' : (m.status === 'seen' || (m.readBy && m.readBy.length > 0)) ? 'Đã xem' : m.status === 'delivered' ? 'Đã nhận' : 'Đã gửi'}>{m.pending ? <Clock size={13} className="spin" /> : (m.status === 'seen' || (m.readBy && m.readBy.length > 0)) ? <CheckCheck size={14} /> : m.status === 'delivered' ? <CheckCheck size={14} /> : <Check size={14} />}</span>}</div>
          </div>
        </article></React.Fragment>;
      })}{!messages.length && <div className="empty-messages"><MessageCircle size={35} /><h3>{messageQuery ? 'Chưa tìm thấy tin nhắn' : 'Câu chuyện bắt đầu từ bạn'}</h3><p>{messageQuery ? 'Thử tìm với một từ khóa khác nhé.' : 'Gửi một lời chào để bắt đầu cuộc trò chuyện 👋'}</p></div>}{typing.some(t => t.conversationId === selected && t.userId !== me.id) && <div className="typing-indicator">{typing.filter(t => t.conversationId === selected && t.userId !== me.id).map(t => person(t.userId).name.split(' ').at(-1)).join(', ')} đang nhập<span>•••</span></div>}<div ref={bottom} /></div>
      <form className="composer-area" onSubmit={send}>{replyingTo && <div className="reply-preview-bar"><div className="reply-preview-content"><Reply size={15} className="reply-preview-icon" /><div className="reply-preview-text"><b>Đang trả lời {isMe(replyingTo.sender) ? "chính mình" : (person(replyingTo.sender).name || "thành viên")}:</b><span>{replyingTo.text || (replyingTo.file ? replyingTo.file.name : (replyingTo.attachments?.[0]?.fileName || "Tệp đính kèm"))}</span></div></div><IconButton label="Hủy trả lời" type="button" onClick={() => setReplyingTo(null)}><X size={16} /></IconButton></div>}{pending && <div className="attachment-preview"><Paperclip size={18} /><div><b>{pending.name}</b><small>{sizeText(pending.size)}</small></div><IconButton label="Bỏ tệp đính kèm" onClick={() => setPending(null)} type="button"><X size={17} /></IconButton></div>}<div className="composer"><div className="composer-tools"><IconButton type="button" label="Đính kèm tệp" onClick={() => fileInput.current.click()}><Paperclip size={20} /></IconButton><IconButton type="button" label="Gửi ảnh" onClick={() => imageInput.current.click()}><ImageIcon size={20} /></IconButton></div><textarea ref={textInput} aria-label="Nội dung tin nhắn" placeholder={`Nhắn tin ${active.type === 'group' ? 'cho nhóm' : 'cho ' + other(active).name.split(' ').at(-1)}...`} value={draft} rows={1} maxLength={4000} onChange={e => changeDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} /><div className="emoji-container"><IconButton type="button" label="Chọn biểu tượng cảm xúc" onClick={() => setEmoji(!emoji)}><Smile size={21} /></IconButton>{emoji && <div className="emoji-picker">{['😊', '❤️', '👍', '🎉', '😂', '✨', '🙌', '🔥', '👋', '🚀', '💯', '🎓', '🥰', '😎', '✅', '🤔'].map(s => <button key={s} type="button" onClick={() => { setDraft(d => d + s); setEmoji(false); textInput.current?.focus(); }}>{s}</button>)}</div>}</div><button className="send-button" type="submit" title="Gửi tin nhắn" aria-label="Gửi tin nhắn" disabled={sending || (!draft.trim() && !pending)}>{sending ? <LoaderCircle className="spin" size={18} /> : <Send size={19} />}</button></div><div className="composer-footer"><span><ShieldCheck size={12} />{server ? (connected ? 'Đã kết nối Socket.IO' : 'Đang kết nối lại máy chủ...') : 'Không gian trò chuyện dành cho sinh viên PTIT'}</span><span><b>Enter</b> để gửi · <b>Shift + Enter</b> để xuống dòng</span></div></form></>}
      <input hidden type="file" ref={fileInput} onChange={attach} /><input hidden type="file" accept="image/*" ref={imageInput} onChange={attach} /></main>
    {active && right && <aside className="details-panel"><div className="details-title"><h3>Thông tin {active.type === 'group' ? 'nhóm' : 'cuộc trò chuyện'}</h3><IconButton label="Ẩn thông tin" onClick={() => setRight(false)}><PanelRightClose size={18} /></IconButton></div><div className="group-profile"><div className="profile-avatar-wrap"><Avatar person={active.type === 'direct' ? other(active) : null} group={active.type === 'group' ? active : null} size="large" /><span>{active.type === 'group' ? '🎓' : '✨'}</span></div><h2>{title(active)}</h2><p>{active.type === 'group' ? `${active.members.length} thành viên · Nhóm học tập` : `@${other(active).username}`}</p><div className="group-actions"><button onClick={toggleMute}><span>{muted.includes(selected) ? <BellOff size={18} /> : <Bell size={18} />}</span>{muted.includes(selected) ? 'Bật thông báo' : 'Thông báo'}</button><button onClick={() => { setChatSearch(true); setMessageQuery(''); }}><span><Search size={18} /></span>Tìm kiếm</button><button onClick={() => active.type === 'group' ? openModal('editgroup') : setModal({ type: 'person', person: other(active) })}><span>{active.type === 'group' ? <Settings size={18} /> : <User size={18} />}</span>{active.type === 'group' ? 'Chỉnh sửa' : 'Hồ sơ'}</button></div></div><div className="detail-section about"><h4>Giới thiệu</h4><p>{active.type === 'group' ? active.description || 'Chia sẻ ý tưởng, giữ kết nối và cùng nhau tiến xa.' : other(active).bio || 'Xin chào, mình đang sử dụng PTITChat!'}</p></div>{active.type === 'group' && <div className="detail-section"><div className="detail-heading"><h4>Thành viên <span>{active.members.length}</span></h4><button onClick={() => openModal('members')}>Xem tất cả<ChevronRight size={12} /></button></div><div className="member-preview">{activeMembers.slice(0, 5).map(p => { const isCurrent = isMe(p); return <button key={p.id || p._id} title={p.name} onClick={() => isCurrent ? openModal('profile') : setModal({ type: 'person', person: p })}><Avatar person={p} online={isCurrent || p.online} size="small" /><small>{isCurrent ? 'Bạn' : (p.name.split(' ').at(-1))}</small></button>; })}</div></div>}<div className="detail-section"><div className="detail-heading"><h4>Ảnh & video <span>{photos.length}</span></h4><button onClick={() => openModal('media')}>Xem tất cả<ChevronRight size={12} /></button></div><div className="media-grid">{photos.slice(-3).map(m => <div key={m.id}>{m.image ? <img src={m.image} alt="Ảnh trong cuộc trò chuyện" onClick={() => setModal({ type: 'image', src: m.image, name: 'Ảnh đã chia sẻ' })} /> : <StoredImage file={m.file} onClick={src => setModal({ type: 'image', src, name: m.file.name })} />}</div>)}{!photos.length && <p className="detail-empty">Ảnh được chia sẻ sẽ hiện ở đây.</p>}</div></div><div className="detail-section shared-files"><div className="detail-heading"><h4>Tệp đã chia sẻ <span>{files.length}</span></h4><button onClick={() => openModal('files')}>Tất cả<ChevronRight size={12} /></button></div>{files.slice(-2).map(m => <FileAttachment key={m.id} file={m.file} onOpen={download} />)}{!files.length && <p className="detail-empty">Chưa có tệp đính kèm.</p>}</div><div className="details-bottom"><div className="ptit-seal"><GraduationCap size={24} /></div><p>Gắn kết hôm nay.<br /><b>Vững bước ngày mai.</b></p><span>MADE WITH <b>♡</b> AT PTIT</span></div></aside>}
    {modal && <Modal title={typeof modal === 'object' ? modal.type === 'image' ? modal.name : 'Hồ sơ người dùng' : ({ group: 'Tạo nhóm mới', new: 'Cuộc trò chuyện mới', profile: 'Hồ sơ của tôi', members: 'Thành viên nhóm', media: 'Ảnh đã chia sẻ', files: 'Tệp đã chia sẻ', settings: 'Cài đặt', editgroup: 'Chỉnh sửa nhóm' })[modal]} onClose={() => setModal(null)} wide={modal?.type === 'image'}>
      {modal?.type === 'image' && <img className="lightbox-image" src={modal.src} alt={modal.name} />}
      {modal?.type === 'person' && <div className="person-profile"><Avatar person={modal.person} size="large" online /><h2>{modal.person.name}</h2><p>@{modal.person.username}</p><span className="profile-status"><i className={`status-dot ${modal.person.online ? '' : 'offline'}`} />{modal.person.online ? onlineLabel : 'Offline'}</span><p>{modal.person.bio || 'Xin chào, mình đang sử dụng PTITChat!'}</p>{modal.person.studentId && <div className="profile-detail"><GraduationCap size={18} />{modal.person.studentId}</div>}<button className="primary" onClick={() => createConversation('direct', [modal.person.id])}><MessageCircle size={18} />Nhắn tin</button></div>}
      {(modal === 'new' || modal === 'group') && <form onSubmit={e => { e.preventDefault(); if (modal === 'group') { if (!groupName.trim()) return setModalError('Vui lòng nhập tên nhóm.'); if (chosen.length < 2) return setModalError('Chọn ít nhất 2 thành viên để tạo nhóm.'); createConversation('group', chosen, groupName.trim()); } }}>{modal === 'group' && <label>Tên nhóm<div className="input-wrap"><Users size={18} /><input autoFocus maxLength={60} required placeholder="Ví dụ: Nhóm đồ án PTIT" value={groupName} onChange={e => setGroupName(e.target.value)} /></div></label>}<p className="modal-description">{modal === 'group' ? 'Chọn những người bạn muốn kết nối cùng.' : 'Tìm một người bạn và bắt đầu cuộc trò chuyện.'}</p><div className="input-wrap"><Search size={17} /><input aria-label="Tìm thành viên" placeholder="Tìm theo tên hoặc username..." value={memberQuery} onChange={e => setMemberQuery(e.target.value)} /></div><div className="member-select-list">{data.people.filter(p => !isMe(p) && normalize((p.name || p.displayName || '') + ' ' + (p.username || '')).includes(normalize(memberQuery))).map(p => { const pid = p.id || p._id; return <button type="button" className={`member-choice ${chosen.includes(pid) ? 'checked' : ''}`} key={pid} onClick={() => modal === 'new' ? createConversation('direct', [pid]) : setChosen(c => c.includes(pid) ? c.filter(id => id !== pid) : [...c, pid])}><Avatar person={p} online={p.online} /><span><b>{p.name || p.displayName}</b><small>@{p.username}</small></span>{modal === 'group' ? <i>{chosen.includes(pid) && <Check size={13} />}</i> : <MessageCircle size={18} />}</button>; })}</div>{modalError && <p className="form-error" role="alert">{modalError}</p>}{modal === 'group' && <div className="modal-footer"><span>Đã chọn {chosen.length} thành viên</span><button className="primary" type="submit"><Plus size={17} />Tạo nhóm</button></div>}</form>}
      {modal === 'profile' && <form onSubmit={saveProfile}><div className="edit-avatar"><Avatar person={profile} size="large" /><button type="button" className="icon-btn" aria-label="Đổi ảnh đại diện" onClick={() => avatarInput.current.click()}><Camera size={18} /></button><input hidden ref={avatarInput} accept="image/*" type="file" onChange={e => { const file = e.target.files?.[0]; if (!file) return; if (!file.type.startsWith('image/')) return setModalError('Vui lòng chọn một tệp ảnh.'); if (file.size > 1024 * 1024) return setModalError('Ảnh đại diện tối đa 1 MB.'); const r = new FileReader(); r.onload = () => setProfile(p => ({ ...p, avatar: r.result })); r.readAsDataURL(file); }} /></div><p className="profile-username">@{me.username}</p><label>Họ và tên<input className="plain-input" maxLength={60} required value={profile.name || profile.displayName || ''} onChange={e => setProfile(p => ({ ...p, name: e.target.value, displayName: e.target.value }))} /></label><div className="form-two-col"><label>Mã sinh viên<input className="plain-input" maxLength={30} placeholder="B21DCCN001" value={profile.studentId || ''} onChange={e => setProfile(p => ({ ...p, studentId: e.target.value }))} /></label><label>Email<input className="plain-input" type="email" maxLength={120} placeholder="ban@ptit.edu.vn" value={profile.email || ''} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} /></label></div><label>Giới thiệu<textarea className="plain-input" rows={3} maxLength={160} placeholder="Chia sẻ một chút về bạn..." value={profile.bio || ''} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))} /></label>{modalError && <p role="alert" className="form-error">{modalError}</p>}<div className="modal-footer"><button type="button" className="text-danger" onClick={logout}><LogOut size={16} />Đăng xuất</button><button className="primary" type="submit">Lưu thay đổi<Check size={17} /></button></div></form>}
      {modal === 'members' && <div className="member-select-list">{activeMembers.map(p => { const isCurrent = isMe(p); return <button className="member-choice" key={p.id || p._id} onClick={() => isCurrent ? openModal('profile') : setModal({ type: 'person', person: p })}><Avatar person={p} online={isCurrent || p.online} /><span><b>{p.name}{isCurrent ? ' (Bạn)' : ''}</b><small>{(isCurrent || p.online) ? onlineLabel : 'Offline'}</small></span><ChevronRight size={16} /></button>; })}</div>}
      {modal === 'media' && <div className="gallery">{photos.map(m => m.image ? <img key={m.id} src={m.image} alt="Ảnh đã chia sẻ" onClick={() => setModal({ type: 'image', src: m.image, name: 'Ảnh đã chia sẻ' })} /> : <StoredImage key={m.id} file={m.file} onClick={src => setModal({ type: 'image', src, name: m.file.name })} />)}{!photos.length && <p>Chưa có ảnh trong cuộc trò chuyện này.</p>}</div>}
      {modal === 'files' && <div className="all-files">{files.map(m => <FileAttachment key={m.id} file={m.file} onOpen={download} />)}{!files.length && <p>Chưa có tệp trong cuộc trò chuyện này.</p>}</div>}
      {modal === 'settings' && <div className="settings-content"><div className="settings-account"><Avatar person={me} /><span><b>{me.name}</b><small>@{me.username}</small></span><button onClick={() => openModal('profile')}>Chỉnh sửa</button></div><div className="settings-info"><Globe size={20} /><div><b>Ngôn ngữ</b><small>Tiếng Việt</small></div><Check size={17} /></div><div className="settings-info">{theme === 'dark' ? <Moon size={20} color="#f59e0b" /> : <Sun size={20} color="#f59e0b" />}<div><b>Giao diện</b><small>{theme === 'dark' ? 'Chế độ tối (Dark mode)' : 'Chế độ sáng (Light mode)'}</small></div><div className="theme-switcher"><button type="button" className={`theme-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => setTheme('light')}><Sun size={14} /> Sáng</button><button type="button" className={`theme-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => setTheme('dark')}><Moon size={14} /> Tối</button></div></div><div className="settings-info"><ShieldCheck size={20} /><div><b>{server ? 'Chế độ máy chủ' : 'Chế độ trải nghiệm'}</b><small>{server ? 'REST API & Socket.IO · ' + (connected ? 'Đã kết nối' : 'Mất kết nối') : 'Dữ liệu được lưu trên trình duyệt này'}</small></div></div><p className="modal-description">{server ? 'Trạng thái trực tuyến và tin nhắn được đồng bộ giữa các tài khoản qua máy chủ.' : 'Để nhắn tin giữa nhiều thiết bị, chạy máy chủ Node.js, sau đó chọn “Kết nối máy chủ Node.js” ở màn hình đăng nhập. Trạng thái Online trong demo là dữ liệu minh họa.'}</p>
        <div className="change-password-box">
          <button type="button" className="change-password-btn-toggle" onClick={() => { setShowChangePass(!showChangePass); setChangePassError(''); }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Lock size={16} /> Đổi mật khẩu tài khoản</span>
            <ChevronDown size={16} style={{ transform: showChangePass ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
          </button>
          {showChangePass && (
            <form className="change-password-fields" onSubmit={handlePasswordChange}>
              <label>
                Mật khẩu hiện tại
                <input className="plain-input" type="password" required placeholder="Nhập mật khẩu đang dùng" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
              </label>
              <label>
                Mật khẩu mới (ít nhất 6 ký tự)
                <input className="plain-input" type="password" required minLength={6} placeholder="Nhập mật khẩu mới" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
              </label>
              <label>
                Nhập lại mật khẩu mới
                <input className="plain-input" type="password" required minLength={6} placeholder="Xác nhận mật khẩu mới" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
              </label>
              {changePassError && <p className="form-error" role="alert">{changePassError}</p>}
              <button className="btn-submit-change-pass" type="submit" disabled={changePassLoading}>
                {changePassLoading ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />} Cập nhật mật khẩu
              </button>
            </form>
          )}
        </div>
        <button className="settings-logout" onClick={logout}><LogOut size={18} />Đăng xuất</button><p className="version">PTITChat 1.0 · Kết nối không khoảng cách</p></div>}
      {modal === 'editgroup' && <form onSubmit={updateGroup}><label>Tên nhóm<input className="plain-input" required maxLength={60} value={groupName} onChange={e => setGroupName(e.target.value)} /></label><label>Giới thiệu<textarea className="plain-input" rows={3} maxLength={240} value={groupDescription} onChange={e => setGroupDescription(e.target.value)} /></label>{modalError && <p className="form-error">{modalError}</p>}<div className="modal-footer"><span /><button className="primary" type="submit">Lưu thay đổi<Check size={17} /></button></div></form>}
    </Modal>}{toast && <div className="toast" role="status"><CheckCircle2 size={18} />{toast}<button aria-label="Đóng thông báo" onClick={() => setToast('')}><X size={15} /></button></div>}
    {callState === 'incoming' && callData && <div className="incoming-call-alert" role="dialog" aria-label="Cuộc gọi đến"><Avatar person={{ name: callData.callerName, avatar: callData.callerAvatar }} size="small" /><div className="incoming-call-info"><b>{callData.callerName}</b><small>Đang gọi {callData.isVideo ? 'video' : 'thoại'}...</small></div><div className="incoming-call-actions"><button type="button" className="btn-accept-call" title="Trả lời" onClick={acceptIncomingCall}>{callData.isVideo ? <Video size={19} /> : <Phone size={19} />}</button><button type="button" className="btn-decline-call" title="Từ chối" onClick={rejectIncomingCall}><PhoneOff size={19} /></button></div></div>}
    {(callState === 'calling' || callState === 'connected') && <div className="call-overlay" role="dialog" aria-modal="true" aria-label="Cuộc gọi"><div className="call-video-container">{callData?.isVideo && !isVideoOff ? <video ref={remoteVideoEl} autoPlay playsInline className="remote-video" /> : <div className="call-audio-placeholder"><div className="call-avatar-pulse"><Avatar person={callData?.recipient || { name: callData?.callerName, avatar: callData?.callerAvatar }} size="large" /></div><div className="call-peer-name">{callData?.recipient?.name || callData?.recipient?.displayName || callData?.callerName || 'Thành viên PTITChat'}</div><div className="call-status-label">{callState === 'calling' ? 'Đang đổ chuông...' : 'Đang kết nối cuộc gọi'}</div>{callState === 'connected' && <div className="call-timer">{formatCallTime(callSeconds)}</div>}</div>}{callData?.isVideo && <div className="local-video-pip"><video ref={localVideoEl} autoPlay playsInline muted style={{ display: isVideoOff ? 'none' : 'block' }} />{isVideoOff && <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#334155' }}><VideoOff size={22} color="#94a3b8" /></div>}</div>}</div><div className="call-control-bar"><button type="button" className={`call-action-btn ${isMuted ? 'off' : ''}`} title={isMuted ? 'Bật Mic' : 'Tắt Mic'} onClick={toggleAudioMute}>{isMuted ? <MicOff size={22} /> : <Mic size={22} />}</button>{callData?.isVideo && <button type="button" className={`call-action-btn ${isVideoOff ? 'off' : ''}`} title={isVideoOff ? 'Bật Camera' : 'Tắt Camera'} onClick={toggleVideoOff}>{isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}</button>}{callData?.isVideo && <button type="button" className={`call-action-btn ${isScreenSharing ? "active-share" : ""}`} title={isScreenSharing ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"} onClick={toggleScreenShare}><ScreenShare size={22} /></button>}<button type="button" className="call-action-btn end-call" title="Kết thúc cuộc gọi" onClick={endCurrentCall}><PhoneOff size={24} /></button></div></div>}
    {activeGroupCallInfo && groupCallState !== 'in-call' && (!active || (active.id || active._id) !== activeGroupCallInfo.conversationId) && <div className="incoming-call-alert" role="dialog" aria-label="Cuộc gọi nhóm"><Avatar group={{ color: '#b52740' }} size="small" /><div className="incoming-call-info"><b>{activeGroupCallInfo.groupName}</b><small>{activeGroupCallInfo.callerName} đã bắt đầu cuộc gọi nhóm...</small></div><div className="incoming-call-actions"><button type="button" className="btn-accept-call" title="Tham gia" onClick={() => { const targetConv = data.conversations.find(c => (c.id || c._id) === activeGroupCallInfo.conversationId); if (targetConv) openConversation(targetConv); startGroupCall(activeGroupCallInfo.isVideo, targetConv); }}>{activeGroupCallInfo.isVideo ? <Video size={19} /> : <Phone size={19} />}</button><button type="button" className="btn-decline-call" title="Bỏ qua" onClick={() => setActiveGroupCallInfo(null)}><X size={19} /></button></div></div>}
    {groupCallState === 'in-call' && <div className="call-overlay" role="dialog" aria-modal="true" aria-label="Cuộc gọi nhóm"><div className="call-video-container" style={{ maxHeight: '78vh' }}><div className="group-call-grid"><div className="group-call-tile local">{groupCallData?.isVideo && !isVideoOff ? <video ref={localVideoEl} autoPlay playsInline muted /> : <div className="group-call-placeholder"><Avatar person={me} size="large" /><div className="call-peer-name" style={{ fontSize: 16 }}>{me.name || me.displayName || 'Bạn'}</div></div>}<div className="tile-name-tag">{isMuted ? <MicOff size={14} color="#ef4444" /> : <Mic size={14} />}<span>{me.name || me.displayName || 'Bạn'} (Tôi)</span></div></div>{groupPeers.map(p => <RemoteVideoTile key={p.userId} peer={p} />)}</div></div><div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}><span style={{ fontWeight: 650, fontSize: 15 }}>{groupCallData?.groupName || 'Cuộc gọi nhóm'}</span><span style={{ fontSize: 13, color: '#94a3b8' }}>· {groupPeers.length + 1} người tham gia</span><span className="call-timer">{formatCallTime(callSeconds)}</span></div><div className="call-control-bar"><button type="button" className={`call-action-btn ${isMuted ? 'off' : ''}`} title={isMuted ? 'Bật Mic' : 'Tắt Mic'} onClick={toggleAudioMute}>{isMuted ? <MicOff size={22} /> : <Mic size={22} />}</button>{groupCallData?.isVideo && <button type="button" className={`call-action-btn ${isVideoOff ? 'off' : ''}`} title={isVideoOff ? 'Bật Camera' : 'Tắt Camera'} onClick={toggleVideoOff}>{isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}</button>}{groupCallData?.isVideo && <button type="button" className={`call-action-btn ${isScreenSharing ? "active-share" : ""}`} title={isScreenSharing ? "Dừng chia sẻ màn hình" : "Chia sẻ màn hình"} onClick={toggleScreenShare}><ScreenShare size={22} /></button>}<button type="button" className="call-action-btn end-call" title="Rời cuộc gọi nhóm" onClick={leaveGroupCall}><PhoneOff size={24} /></button></div></div>}
  </div>;
}
