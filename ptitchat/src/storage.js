const DB_NAME = 'ptitchat-files';
function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('files');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveFile(id, file) {
  const db = await open();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('files', 'readwrite');
      tx.objectStore('files').put(file, id);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
export async function readFile(id) {
  const db = await open();
  try {
    return await new Promise((resolve, reject) => {
      const r = db.transaction('files').objectStore('files').get(id);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  } finally {
    db.close();
  }
}
export async function hashPassword(password, salt) {
  const bytes = new TextEncoder().encode(salt + password);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
export const load = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
export const api = async (path, { token, ...options } = {}) => {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const data = await res.json().catch(() => ({ error: 'Không thể kết nối máy chủ. Hãy thử lại.' }));
  if (!res.ok) throw new Error(data.error || data.message || 'Có lỗi xảy ra.');

  // Unpack responses from MongoDB Atlas Backend
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.users)) return data.users;
  if (data.user && data.token) return { user: data.user, token: data.token };
  if (data.data) return data.data;
  return data;
};
