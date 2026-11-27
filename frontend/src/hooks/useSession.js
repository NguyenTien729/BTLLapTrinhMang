import {useEffect,useState} from 'react';
import {request,getToken,clearSession,TOKEN_KEY,USER_KEY} from '../services/api.js';
import {toUser} from '../services/chat.js';

export default function useSession(){
  const [session,setSession]=useState(()=>{try {const user=JSON.parse(sessionStorage.getItem(USER_KEY));return getToken()&&user?{user,token:getToken()}:null;}catch{return null;}});
  const [loading,setLoading]=useState(!!session);
  function logout(){clearSession();setSession(null);history.replaceState(null,'','/login');}
  function login({token,user}){
    const normalized=toUser(user);sessionStorage.setItem(TOKEN_KEY,token);sessionStorage.setItem(USER_KEY,JSON.stringify(normalized));
    setSession({token,user:normalized});history.replaceState(null,'','/');
  }
  function updateUser(user){const normalized=toUser(user);sessionStorage.setItem(USER_KEY,JSON.stringify(normalized));setSession(s=>s?{...s,user:normalized}:s);}
  useEffect(()=>{window.addEventListener('ptitchat:expired',logout);return()=>window.removeEventListener('ptitchat:expired',logout);},[]);
  useEffect(()=>{
    if(!session?.token){setLoading(false);return;}
    let active=true,timer;
    try {
      const {exp}=JSON.parse(atob(session.token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
      if(!exp||exp*1000<=Date.now()){logout();setLoading(false);return;}
      timer=setTimeout(logout,Math.min(exp*1000-Date.now(),2147483647));
    }catch{logout();setLoading(false);return;}
    request('/users/me').then(({user})=>{if(active)updateUser(user);}).catch(error=>{if(active&&error.status!==401)console.error(error.message);}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;clearTimeout(timer);};
  },[session?.token]);
  return {session,loading,login,logout,updateUser};
}
