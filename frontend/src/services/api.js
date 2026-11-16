const TOKEN_KEY = 'ptitchat-token';
export const getToken = () => sessionStorage.getItem(TOKEN_KEY);
export const logout = () => sessionStorage.removeItem(TOKEN_KEY);

export async function request(path, { method = 'GET', body, token = getToken(), signal } = {}) {
  const response = await fetch(`/api${path}`, {
    method, signal,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) logout();
    throw new Error(data.message || 'Không thể xử lý yêu cầu. Vui lòng thử lại.');
  }
  return data;
}

export async function authenticate(mode, body) {
  const data = await request(`/auth/${mode}`, { method: 'POST', body, token: null });
  sessionStorage.setItem(TOKEN_KEY, data.token);
  return data.user;
}
