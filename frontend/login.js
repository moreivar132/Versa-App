import { getSession, requireAuth, login } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const errorEl = document.getElementById('loginError');

  const showError = (message) => {
    if (!errorEl) return;
    if (!message) {
      errorEl.hidden = true;
      errorEl.textContent = '';
      return;
    }
    errorEl.hidden = false;
    errorEl.textContent = message;
  };

  const existingSession = getSession();
  if (existingSession?.token) {
    requireAuth().then((user) => {
      if (user) {
        window.location.replace('manager-taller-inicio.html');
      }
    });
  }

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    showError('');

    const email = document.getElementById('email')?.value.trim();
    const password = document.getElementById('password')?.value;

    if (!email || !password) {
      showError('Completa tu email y contraseña.');
      return;
    }

    try {
      await login(email, password);
      window.location.replace('manager-taller-inicio.html');
    } catch (error) {
      console.error('Error en login:', error);
      showError(error.message || 'No se pudo iniciar sesión.');
    }
  });
});
