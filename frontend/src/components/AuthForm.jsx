import React,{useState} from 'react';
import {MessageCircle,ShieldCheck} from 'lucide-react';
import {request} from '../services/api.js';

export default function AuthForm({register=false,onLogin,onSwitch}) {
  const [email,setEmail]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function submit(event) {
    event.preventDefault();setError('');
    if(register && password!==confirm){setError('Mật khẩu xác nhận chưa khớp.');return;}
    setBusy(true);
    try { onLogin(await request('/auth/'+(register?'register':'login'),{method:'POST',token:null,body:{email,password,...(register?{username}: {})}})); }
    catch(error){setError(error.message);}finally{setBusy(false);}
  }
  return <div className="auth-page"><div className="auth-art"><div className="brand light"><MessageCircle size={34}/> PTITChat</div><div className="auth-story"><span className="eyebrow">KHÔNG GIAN KẾT NỐI CỦA SINH VIÊN PTIT</span><h1>Gần nhau hơn.<br/>Đi xa cùng nhau.</h1><p>Chia sẻ ý tưởng, trò chuyện và giữ kết nối cùng bạn bè.</p></div></div><main className="auth-main min-h-screen md:min-h-0"><div className="auth-form-wrap"><span className="welcome-icon"><MessageCircle size={27}/></span><h2>{register?'Bắt đầu kết nối':'Chào mừng trở lại!'}</h2><p>{register?'Tạo tài khoản PTITChat của bạn.':'Đăng nhập bằng email để tiếp tục trò chuyện.'}</p><div className="auth-tabs"><button className={!register?'selected':''} onClick={()=>onSwitch(false)}>Đăng nhập</button><button className={register?'selected':''} onClick={()=>onSwitch(true)}>Đăng ký</button></div><form onSubmit={submit}>
    {register&&<label>Tên hiển thị<div className="input-wrap"><input autoComplete="nickname" required minLength={2} maxLength={50} value={username} onChange={e=>setUsername(e.target.value)}/></div></label>}
    <label>Email<div className="input-wrap"><input aria-label="Email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>setEmail(e.target.value)}/></div></label>
    <label>Mật khẩu<div className="input-wrap"><input aria-label="Mật khẩu" type="password" autoComplete={register?'new-password':'current-password'} required minLength={register?8:1} value={password} onChange={e=>setPassword(e.target.value)}/></div></label>
    {register&&<label>Xác nhận mật khẩu<div className="input-wrap"><input aria-label="Xác nhận mật khẩu" type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)}/></div></label>}
    {error&&<p className="form-error" role="alert">{error}</p>}<button className="primary auth-submit" disabled={busy} type="submit">{busy?'Đang xử lý...':register?'Tạo tài khoản':'Đăng nhập'}</button></form><p className="demo-note"><ShieldCheck size={14}/> Phiên đăng nhập được bảo vệ bằng JWT.</p></div></main></div>;
}
