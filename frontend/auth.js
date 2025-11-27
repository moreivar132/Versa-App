const SESSION_KEY = 'versa_session_v1';

export function getApiBaseUrl() {
  // Si hay variable de entorno (ej. en Netlify/Railway), usarla
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  // En desarrollo local, asumir backend en puerto 3000
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // En producción (si no hay variable), usar path relativo (asume que el backend sirve el frontend)
  return '';
}

const API_BASE_URL = getApiBaseUrl();



export function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('No se pudo leer la sesión almacenada.', error);
    return null;
  }
}

export function setSession(token, user) {
  if (!token || !user) return;
  const payload = { token, user };
  localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getToken() {
  const session = getSession();
  return session?.token || null;
}

export function getCurrentUser() {
  const session = getSession();
  return session?.user || null;
}

export function redirectToLogin() {
  if (window.location.pathname.endsWith('login.html')) return;
  window.location.replace('login.html');
}

export async function requireAuth() {
  const session = getSession();
  if (!session?.token) {
    redirectToLogin();
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Sesión inválida');
    }

    const user = await response.json();
    setSession(session.token, user);
    return user;
  } catch (error) {
    clearSession();
    redirectToLogin();
    return null;
  }
}

export async function login(email, password) {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || 'Error en login');
  }

  const data = await response.json();
  setSession(data.token, data.user);
  return data.user;
}

export async function fetchWithAuth(url, options = {}) {
  const token = getToken();
  if (!token) {
    redirectToLogin();
    throw new Error('Sesión no encontrada');
  }

  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  headers.set('Authorization', `Bearer ${token}`);

  const fullUrl = url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  const response = await fetch(fullUrl, { ...options, headers });

  if (response.status === 401) {
    clearSession();
    redirectToLogin();
  }
  return response;
}
