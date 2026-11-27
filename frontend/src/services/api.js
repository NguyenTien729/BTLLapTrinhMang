export const TOKEN_KEY = 'ptitchat-token';
export const USER_KEY = 'ptitchat-user';
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export function clearSession() { sessionStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(USER_KEY); }
export function expireSession() { clearSession(); window.dispatchEvent(new Event('ptitchat:expired')); }

export async function request(path, { method='GET', body, token=getToken(), signal }={}) {
  const form = body instanceof FormData;
  const response = await fetch('/api'+path, {
    method, signal, headers:{ ...(!form && body ? { 'Content-Type':'application/json' } : {}), ...(token ? { Authorization:'Bearer '+token } : {}) },
    ...(body ? { body:form ? body : JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(()=>({}));
  if (!response.ok) {
    if (response.status === 401 && token) expireSession();
    throw Object.assign(new Error(data.message || 'Không thể xử lý yêu cầu.'), { status:response.status });
  }
  return data;
}
export async function uploadFile(file) {
  const body=new FormData(); body.append('file',file);
  const {data}=await request('/uploads',{method:'POST',body});
  return { url:data.url,fileName:data.originalName,mimeType:data.mimeType,fileSize:data.size,fileType:data.type };
}
