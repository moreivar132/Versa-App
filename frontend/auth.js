const SESSION_KEY = 'versa_session_v1';

export function getApiBaseUrl() {
  return import.meta.env.VITE_API_URL || '';
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
  const path = window.location.pathname;
  if (path.endsWith('login.html') || path.endsWith('login-finsaas.html') || path.endsWith('cliente-login.html')) return;

  // Si venimos de un contexto finsaas, ir al login de finsaas
  if (path.includes('finsaas')) {
    window.location.replace('/login-finsaas.html');
    return;
  }

  window.location.replace('/login.html');
}

export function logout() {
  clearSession();
  redirectToLogin();
}

export function redirectIfLoggedIn() {
  const session = getSession();
  if (session && session.token) {
    // Redirigir según el tipo de usuario o página por defecto
    // Si estamos en login-finsaas o contexto finsaas, ir al dashboard de finsaas
    if (window.location.pathname.includes('finsaas')) {
      window.location.href = '/src/verticals/finsaas/pages/dashboard.html';
      return;
    }
    // Por defecto al manager
    window.location.href = '/manager-taller-inicio.html';
  }
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
