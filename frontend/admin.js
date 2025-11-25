import { requireAuth } from './auth.js';

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth();
  if (!user) return;

  const isSuperAdmin = Boolean(user.is_super_admin || user.role === 'admin');
  if (!isSuperAdmin) {
    alert('Acceso restringido a super administradores.');
    window.location.replace('index.html');
    return;
  }

  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    userInfo.textContent = `${user.nombre || user.email} · Administrador`;
  }

  // Initialize UserStore for admin operations (legacy/local support)
  await UserStore.init();

  const userListEl = document.getElementById('userList');
  const createUserForm = document.getElementById('createUserForm');
  if (!userListEl || !createUserForm) return;

  const feedbackEl = document.getElementById('adminFeedback');
  const secretWrapper = document.getElementById('adminGeneratedSecret');
  const secretValueEl = secretWrapper?.querySelector('.generated-secret__value');
  const passwordInput = document.getElementById('newUserPassword');
  const generateBtn = document.getElementById('btnGeneratePassword');
  const currentUserEmail = (user.email || '').trim().toLowerCase();

  const escapeHTML = (value = '') => `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function setFeedback(message, variant = 'info') {
    if (!feedbackEl) return;
    if (!message) {
      feedbackEl.textContent = '';
      feedbackEl.dataset.variant = '';
      feedbackEl.hidden = true;
      return;
    }
    feedbackEl.textContent = message;
    feedbackEl.dataset.variant = variant;
    feedbackEl.hidden = false;
  }

  function showGeneratedSecret(secret) {
    if (!secretWrapper || !secretValueEl) return;
    if (!secret) {
      secretWrapper.hidden = true;
      secretValueEl.textContent = '';
      return;
    }
    secretValueEl.textContent = secret;
    secretWrapper.hidden = false;
  }

  function formatRole(role) {
    return role === 'admin' ? 'Administrador' : 'Empleado';
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
  }

  function renderUsers() {
    userListEl.setAttribute('aria-busy', 'true');
    const users = UserStore.listUsers();
    if (!users.length) {
      userListEl.innerHTML = '<p class="helper-text">Aún no hay usuarios registrados.</p>';
      userListEl.setAttribute('aria-busy', 'false');
      return;
    }
    const markup = users
      .map((user) => {
        const normalized = user.email.trim().toLowerCase();
        const isSelf = normalized === currentUserEmail;
        const roleOptions = `
          <option value="empleado"${user.role === 'empleado' ? ' selected' : ''}>Empleado</option>
          <option value="admin"${user.role === 'admin' ? ' selected' : ''}>Administrador</option>`;
        return `
          <article class="user-card" data-email="${escapeHTML(user.email)}">
            <header class="user-card__header">
              <div>
                <strong>${escapeHTML(user.name || user.email)}</strong>
                <p class="helper-text">${escapeHTML(user.email)}</p>
              </div>
              <span class="badge ${user.role === 'admin' ? 'badge--accent' : 'badge--subtle'}">${formatRole(user.role)}</span>
            </header>
            <dl class="user-card__meta">
              <div>
                <dt>Creado</dt>
                <dd>${escapeHTML(formatDate(user.createdAt))}</dd>
              </div>
              <div>
                <dt>Último acceso</dt>
                <dd>${escapeHTML(formatDate(user.lastLoginAt))}</dd>
              </div>
            </dl>
            <div class="user-card__actions">
              <label class="user-card__role">
                <span>Rol</span>
                <select class="input" data-action="change-role" ${isSelf ? 'disabled' : ''}>
                  ${roleOptions}
                </select>
              </label>
              <button type="button" class="btn btn-dark btn-sm" data-action="reset-password">
                Restablecer contraseña
              </button>
              <button type="button" class="btn btn-ghost btn-sm" data-action="delete-user" ${isSelf ? 'disabled' : ''}>
                Revocar acceso
              </button>
            </div>
          </article>`;
      })
      .join('');
    userListEl.innerHTML = markup;
    userListEl.setAttribute('aria-busy', 'false');
  }

  function getTargetEmail(element) {
    const card = element.closest('.user-card');
    return card ? card.getAttribute('data-email') : '';
  }

  generateBtn?.addEventListener('click', () => {
    const password = UserStore.generateSecurePassword();
    if (passwordInput) {
      passwordInput.value = password;
      passwordInput.focus();
      passwordInput.select();
    }
    showGeneratedSecret(password);
    setFeedback('Se generó una contraseña robusta. Copia y compártela de forma segura.', 'info');
  });

  createUserForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const formData = new FormData(createUserForm);
    const email = (formData.get('email') || '').toString().trim();
    const name = (formData.get('name') || '').toString().trim();
    const role = (formData.get('role') || 'empleado').toString();
    const password = (formData.get('password') || '').toString();
    if (!email || !password) {
      setFeedback('Completa los campos obligatorios para crear la cuenta.', 'error');
      return;
    }
    try {
      await UserStore.createUser({ email, name, role, password });
      renderUsers();
      createUserForm.reset();
      showGeneratedSecret(password);
      setFeedback(`Cuenta creada para ${email}. Recuerda compartir la contraseña mostrada una sola vez.`, 'success');
    } catch (error) {
      setFeedback(error.message || 'No se pudo crear el usuario.', 'error');
    }
  });

  userListEl.addEventListener('change', async (event) => {
    const select = event.target.closest('[data-action="change-role"]');
    if (!select) return;
    const email = getTargetEmail(select);
    const newRole = select.value;
    try {
      await UserStore.changeRole(email, newRole);
      setFeedback(`El rol de ${email} ahora es ${formatRole(newRole)}.`, 'success');
      renderUsers();
    } catch (error) {
      setFeedback(error.message || 'No se pudo actualizar el rol.', 'error');
      renderUsers();
    }
  });

  userListEl.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const action = target.getAttribute('data-action');
    if (!action) return;
    const email = getTargetEmail(target);
    if (!email) return;

    if (action === 'reset-password') {
      const newPassword = UserStore.generateSecurePassword();
      try {
        await UserStore.resetPassword(email, newPassword);
        showGeneratedSecret(newPassword);
        setFeedback(`Contraseña restablecida para ${email}. Comunica la nueva clave de inmediato.`, 'success');
      } catch (error) {
        setFeedback(error.message || 'No se pudo restablecer la contraseña.', 'error');
      }
      return;
    }

    if (action === 'delete-user') {
      const confirmed = window.confirm(`¿Seguro que deseas revocar el acceso de ${email}?`);
      if (!confirmed) return;
      try {
        await UserStore.deleteUser(email);
        setFeedback(`Se revocó el acceso de ${email}.`, 'success');
        renderUsers();
      } catch (error) {
        setFeedback(error.message || 'No se pudo revocar el acceso.', 'error');
      }
    }
  });

  renderUsers();
});
