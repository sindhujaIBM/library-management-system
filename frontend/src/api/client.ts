import axios from 'axios';

const TOKEN_KEY = 'library_token';
const USER_KEY  = 'library_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw) as { id: string; email: string; name: string; role: string }; }
  catch { return null; }
}

export function saveSession(token: string, user: { id: string; email: string; name: string; role: string }) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/';
}

function makeClient(baseURL: string) {
  const client = axios.create({ baseURL });
  client.interceptors.request.use(config => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  client.interceptors.response.use(
    res => res,
    err => {
      if (err.response?.status === 401) clearSession();
      return Promise.reject(err);
    }
  );
  return client;
}

export const authClient  = makeClient(import.meta.env.VITE_AUTH_API_URL  || '/api/auth');
export const booksClient = makeClient(import.meta.env.VITE_BOOKS_API_URL || '/api/books');
export const adminClient = makeClient(import.meta.env.VITE_ADMIN_API_URL || '/api/admin');
