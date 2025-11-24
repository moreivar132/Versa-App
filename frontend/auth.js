(function initAuth(global) {
  const SESSION_KEY = 'versa_session_v1';

  const redirectToLogin = () => {
    if (window.location.pathname.endsWith('login.html')) return;
    window.location.replace('login.html');
  };

  function getSession() {
    try {
      const raw = global.localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (error) {
      console.warn('No se pudo leer la sesión almacenada.', error);
      return null;
    }
  }

  function setSession(token, user) {
    if (!token || !user) return;
    const payload = { token, user };
    global.localStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  }

  function clearSession() {
    global.localStorage.removeItem(SESSION_KEY);
  }

  function getToken() {
    const session = getSession();
    return session?.token || null;
  }

  function getCurrentUser() {
    const session = getSession();
    return session?.user || null;
  }

  async function requireAuth() {
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

  async function fetchWithAuth(url, options = {}) {
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

  global.Auth = {
    setSession,
    getToken,
    getCurrentUser,
    clearSession,
    requireAuth,
    fetchWithAuth,
  };
})(typeof window !== 'undefined' ? window : globalThis);
