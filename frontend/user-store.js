(function initUserStore(global){
  function getApiBase() {
    // Permite configurar explícitamente la URL del backend (útil si el frontend se sirve desde otro puerto).
    if (global.__API_BASE__) return global.__API_BASE__;

    const { origin, port, protocol, hostname } = global.location;
    if (port === '3000') return origin; // Frontend servido directamente por el backend.

    // Si se abre el login como archivo local o desde otro dev server, caemos al backend local por defecto.
    return `${protocol}//${hostname ? hostname : 'localhost'}:3000`;
  }

  const API_BASE = getApiBase();
  // ===== INICIO DE LA REFACTORIZACIÓN: Conexión al Backend =====
  // El UserStore ahora se comunicará con la API del backend en lugar de usar localStorage.

  // Función para realizar la autenticación contra el backend
  async function authenticate(email, password) {
    try {
      const response = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Si el servidor responde con un error (4xx, 5xx), lanzamos el mensaje de error
        throw new Error(data.error || 'Error al iniciar sesión.');
      }

      // Guardamos el token y los datos del usuario para futuras peticiones
      // NOTA: El token no se está usando en el resto del código, pero es la práctica correcta.
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // La API devuelve un objeto `user` que incluye nombre, email y rol
      return data.user;
    } catch (error) {
      console.error('Error en authenticate:', error);
      // Re-lanzamos el error para que la UI pueda mostrarlo
      throw error;
    }
  }

  // Función para obtener el usuario actual desde localStorage
  function getUser() {
    const userJson = localStorage.getItem('user');
    if (!userJson) return null;
    try {
      return JSON.parse(userJson);
    } catch (error) {
      console.error('Error al parsear datos de usuario:', error);
      logout(); // Si los datos están corruptos, cerramos sesión.
      return null;
    }
  }
  
  // Función para obtener el token (actualmente no se usa, pero es buena práctica tenerla)
  function getToken() {
      return localStorage.getItem('authToken');
  }

  // Función para cerrar sesión
  function logout() {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    // Redirigir al login
    location.href = 'login.html';
  }

  // La inicialización ahora verifica si ya hay una sesión activa.
  async function init() {
    const user = getUser();
    const onLogin = location.pathname.includes('login.html');

    if (user) {
        // Si hay un usuario y estamos en la página de login, redirigir al index.
        if (onLogin) {
            location.href = 'index.html';
        }
    } else {
        // Si no hay usuario y NO estamos en la página de login, forzar redirección.
        if (!onLogin) {
            location.href = 'login.html';
        }
    }
  }

  // Se exponen las funciones necesarias para que el resto de la aplicación funcione.
  const api = Object.freeze({
    init,
    authenticate,
    getUser,
    getToken,
    logout,
    // Las siguientes funciones no están implementadas en el backend todavía.
    // Devolverán un error informativo si se intentan usar.
    createUser: () => Promise.reject(new Error('La creación de usuarios no está implementada.')),
    listUsers: () => Promise.resolve([]),
  });

  global.UserStore = api;

})(typeof window !== 'undefined' ? window : globalThis);