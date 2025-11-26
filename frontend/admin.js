import { fetchWithAuth, requireAuth } from './auth.js';

const ADMIN_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const LOCAL_USER_STORE_KEY = 'versa_admin_users';

function getLocalUsers() {
  try {
    const stored = localStorage.getItem(LOCAL_USER_STORE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('No se pudieron leer los usuarios locales.', error);
    return [];
  }
}

function persistLocalUsers(users = []) {
  try {
    localStorage.setItem(LOCAL_USER_STORE_KEY, JSON.stringify(users));
  } catch (error) {
    console.warn('No se pudieron guardar los usuarios locales.', error);
  }
}

function normalizeUser(user = {}) {
  if (!user?.email) return null;
  const now = new Date().toISOString();
  return {
    email: String(user.email).trim().toLowerCase(),
    name: user.name || user.nombre || '',
    role: user.role || 'empleado',
    is_super_admin: Boolean(user.is_super_admin || user.role === 'admin'),
    createdAt: user.createdAt || now,
    lastLoginAt: user.lastLoginAt || user.last_login_at || now
  };
}

function ensureSelfUser(users, currentUser) {
  const normalizedCurrent = normalizeUser(currentUser);
  if (!normalizedCurrent) return users;
  const exists = users.some((entry) => entry.email === normalizedCurrent.email);
  if (exists) return users;
  return [normalizedCurrent, ...users];
}

async function requestJSON(path, options = {}) {
  const response = await fetchWithAuth(`${ADMIN_API_URL}${path}`, options);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || 'No se pudo completar la operación.');
  }
  return response.json();
}

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

  const userListEl = document.getElementById('userList');
  const createUserForm = document.getElementById('createUserForm');
  if (!userListEl || !createUserForm) return;

  const feedbackEl = document.getElementById('adminFeedback');
  const secretWrapper = document.getElementById('adminGeneratedSecret');
  const secretValueEl = secretWrapper?.querySelector('.generated-secret__value');
  const passwordInput = document.getElementById('newUserPassword');
  const generateBtn = document.getElementById('btnGeneratePassword');
  const currentUserEmail = (user.email || '').trim().toLowerCase();
  let cachedUsers = ensureSelfUser(getLocalUsers(), user);

  const escapeHTML = (value = '') => `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  function generateSecurePassword() {
    const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const cryptoObj = window.crypto || window.msCrypto;
    const length = 16;
    const bytes = new Uint32Array(length);
    if (cryptoObj?.getRandomValues) {
      cryptoObj.getRandomValues(bytes);
    }
    return Array.from({ length }, (_, index) => {
      const fallback = Math.floor(Math.random() * alphabet.length);
      const value = bytes[index] || fallback;
      return alphabet[value % alphabet.length];
    }).join('');
  }

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
    const users = cachedUsers;
    if (!users.length) {
      userListEl.innerHTML = '<p class="helper-text">Aún no hay usuarios registrados.</p>';
      userListEl.setAttribute('aria-busy', 'false');
      return;
    }
    const markup = users
      .map((entry) => {
        const normalized = entry.email.trim().toLowerCase();
        const isSelf = normalized === currentUserEmail;
        const roleOptions = `
          <option value="empleado"${entry.role === 'empleado' ? ' selected' : ''}>Empleado</option>
          <option value="admin"${entry.role === 'admin' ? ' selected' : ''}>Administrador</option>`;
        return `
          <article class="user-card" data-email="${escapeHTML(entry.email)}">
            <header class="user-card__header">
              <div>
                <strong>${escapeHTML(entry.name || entry.email)}</strong>
                <p class="helper-text">${escapeHTML(entry.email)}</p>
              </div>
              <span class="badge ${entry.role === 'admin' ? 'badge--accent' : 'badge--subtle'}">${formatRole(entry.role)}</span>
            </header>
            <dl class="user-card__meta">
              <div>
                <dt>Creado</dt>
                <dd>${escapeHTML(formatDate(entry.createdAt))}</dd>
              </div>
              <div>
                <dt>Último acceso</dt>
                <dd>${escapeHTML(formatDate(entry.lastLoginAt))}</dd>
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

  const AdminStore = {
    async listUsers() {
      try {
        const data = await requestJSON('/api/admin/users');
        const normalized = Array.isArray(data) ? data.map(normalizeUser).filter(Boolean) : [];
        cachedUsers = ensureSelfUser(normalized, user);
        persistLocalUsers(cachedUsers);
        return cachedUsers;
      } catch (error) {
        console.warn('Fallo al recuperar usuarios desde la API, usando caché local.', error);
        cachedUsers = ensureSelfUser(getLocalUsers(), user);
        return cachedUsers;
      }
    },

    async createUser(payload) {
      const baseUser = normalizeUser({ ...payload, createdAt: new Date().toISOString() });
      if (!baseUser) throw new Error('Email inválido.');
      try {
        const created = await requestJSON('/api/admin/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const normalized = normalizeUser(created) || baseUser;
        cachedUsers = ensureSelfUser([normalized, ...cachedUsers.filter((u) => u.email !== normalized.email)], user);
        persistLocalUsers(cachedUsers);
        return normalized;
      } catch (error) {
        console.warn('Creación de usuario solo en almacenamiento local.', error);
        cachedUsers = ensureSelfUser([baseUser, ...cachedUsers.filter((u) => u.email !== baseUser.email)], user);
        persistLocalUsers(cachedUsers);
        return baseUser;
      }
    },

    async changeRole(email, role) {
      try {
        await requestJSON(`/api/admin/users/${encodeURIComponent(email)}/role`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role })
        });
      } catch (error) {
        console.warn('No se pudo actualizar en backend, se actualizará solo localmente.', error);
      }
      cachedUsers = cachedUsers.map((entry) => (
        entry.email === email ? { ...entry, role, is_super_admin: role === 'admin' } : entry
      ));
      persistLocalUsers(cachedUsers);
    },

    async resetPassword(email, password) {
      try {
        await requestJSON(`/api/admin/users/${encodeURIComponent(email)}/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });
      } catch (error) {
        console.warn('Restablecimiento local únicamente.', error);
      }
      return password;
    },

    async deleteUser(email) {
      try {
        await requestJSON(`/api/admin/users/${encodeURIComponent(email)}`, { method: 'DELETE' });
      } catch (error) {
        console.warn('Eliminación solo local.', error);
      }
      cachedUsers = cachedUsers.filter((entry) => entry.email !== email);
      persistLocalUsers(cachedUsers);
    }
  };

  async function refreshUserList() {
    userListEl.setAttribute('aria-busy', 'true');
    cachedUsers = await AdminStore.listUsers();
    renderUsers();
  }

  generateBtn?.addEventListener('click', () => {
    const password = generateSecurePassword();
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
      await AdminStore.createUser({ email, name, role, password });
      await refreshUserList();
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
      await AdminStore.changeRole(email, newRole);
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
      const newPassword = generateSecurePassword();
      try {
        await AdminStore.resetPassword(email, newPassword);
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
        await AdminStore.deleteUser(email);
        setFeedback(`Se revocó el acceso de ${email}.`, 'success');
        renderUsers();
      } catch (error) {
        setFeedback(error.message || 'No se pudo revocar el acceso.', 'error');
      }
    }
  });

  refreshUserList();
});

function setupSuperAdminPanel() {
  const tenantFormWrapper = document.getElementById('tenantFormWrapper');
  const toggleTenantFormBtn = document.getElementById('toggleTenantFormBtn');
  const cancelTenantFormBtn = document.getElementById('cancelTenantFormBtn');
  const tenantForm = document.getElementById('tenantForm');
  const tenantFeedback = document.getElementById('tenantFeedback');

  const saasUserForm = document.getElementById('createSaaSUserForm');
  const saasUserFeedback = document.getElementById('saasUserFeedback');

  const showTenantForm = () => {
    if (tenantFormWrapper) tenantFormWrapper.hidden = false;
  };

  const hideTenantForm = () => {
    if (tenantFormWrapper) tenantFormWrapper.hidden = true;
    if (tenantForm) tenantForm.reset();
    hideFeedback(tenantFeedback);
  };

  const showFeedback = (el, message) => {
    if (!el) return;
    el.textContent = message;
    el.hidden = false;
  };

  const hideFeedback = (el) => {
    if (!el) return;
    el.hidden = true;
    el.textContent = '';
  };

  toggleTenantFormBtn?.addEventListener('click', () => {
    if (!tenantFormWrapper) return;
    const willShow = tenantFormWrapper.hidden;
    tenantFormWrapper.hidden = !willShow;
    if (willShow) {
      hideFeedback(tenantFeedback);
      tenantForm?.reset();
    }
  });

  cancelTenantFormBtn?.addEventListener('click', hideTenantForm);

  tenantForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    hideFeedback(tenantFeedback);

    const formData = new FormData(tenantForm);
    const nombre = `${formData.get('nombre') || ''}`.trim();

    if (!nombre) {
      showFeedback(tenantFeedback, 'El nombre del tenant es obligatorio.');
      return;
    }

    const payloadTenant = { nombre };
    console.log('Payload tenant', payloadTenant);

    // TODO: cuando el backend esté listo:
    // import api from './api.js';
    // await api.post('/tenants', payloadTenant);

    showFeedback(tenantFeedback, 'Tenant preparado para enviar al backend.');
    hideTenantForm();
  });

  saasUserForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    hideFeedback(saasUserFeedback);

    const formData = new FormData(saasUserForm);
    const nombre = `${formData.get('nombre') || ''}`.trim();
    const email = `${formData.get('email') || ''}`.trim();
    const password = `${formData.get('password') || ''}`.trim();
    const porcentaje_mano_obra = parseFloat(formData.get('porcentaje_mano_obra') || 0.5);
    const is_super_admin = formData.has('is_super_admin');

    const rolesSelect = document.getElementById('rolesSelect');
    const selectedRoleIds = Array.from(rolesSelect?.selectedOptions || [])
      .map((opt) => Number(opt.value))
      .filter((value) => !Number.isNaN(value));

    const sucursalesSelect = document.getElementById('sucursalesSelect');
    const selectedSucursalIds = Array.from(sucursalesSelect?.selectedOptions || [])
      .map((opt) => Number(opt.value))
      .filter((value) => !Number.isNaN(value));

    const payloadUsuario = {
      nombre,
      email,
      password,
      is_super_admin,
      porcentaje_mano_obra,
      rol_ids: selectedRoleIds,
      sucursal_ids: selectedSucursalIds
    };

    console.log('Payload usuario SaaS', payloadUsuario);

    // TODO: cuando el backend esté listo:
    // import api from './api.js';
    // await api.post('/usuarios', payloadUsuario);

    showFeedback(saasUserFeedback, 'Usuario SaaS preparado para enviar al backend.');
    saasUserForm.reset();
  });
}
