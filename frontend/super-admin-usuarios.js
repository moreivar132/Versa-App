import { fetchWithAuth, requireAuth, clearSession } from './auth.js';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ============================================================================
// ESTADO GLOBAL
// ============================================================================
const state = {
    currentUser: null,
    users: [],
    tenants: [],
    roles: [],
    sucursales: [],
    allSucursales: []
};

// ============================================================================
// UTILIDADES
// ============================================================================

function showFeedback(message, type = 'info') {
    const feedbackEl = document.getElementById('feedbackAlert');
    if (!feedbackEl) return;

    feedbackEl.textContent = message;
    feedbackEl.className = `alert alert--${type}`;
    feedbackEl.classList.remove('hidden');

    setTimeout(() => {
        feedbackEl.classList.add('hidden');
    }, 5000);
}

function generateSecurePassword() {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (x) => charset[x % charset.length]).join('');
}

function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateString) {
    const container = document.getElementById('usersTableContainer');

    if (state.users.length === 0) {
        container.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <h3>No hay usuarios registrados</h3>
        <p>Crea el primer usuario usando el formulario de arriba</p>
      </div>
    `;
        return;
    }

    const tableHTML = `
    <table class="users-table">
      <thead>
        <tr>
          <th>Usuario</th>
          <th>Email</th>
          <th>Tenant</th>
          <th>Tipo</th>
          <th>Roles</th>
          <th>Sucursales</th>
          <th>Creado</th>
          <th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${state.users.map(user => {
        const tenant = state.tenants.find(t => t.id === user.id_tenant);
        const userRoles = user.roles || [];
        const userSucursales = user.sucursales || [];

        return `
            <tr data-user-id="${user.id}">
              <td><strong>${escapeHTML(user.nombre)}</strong></td>
              <td>${escapeHTML(user.email)}</td>
              <td>${tenant ? escapeHTML(tenant.nombre) : '—'}</td>
              <td>
                ${user.is_super_admin
                ? '<span class="badge badge--super-admin">Super Admin</span>'
                : '<span class="badge badge--user">Usuario</span>'
            }
              </td>
              <td>
                ${userRoles.length > 0
                ? userRoles.map(r => `<span class="badge badge--admin">${escapeHTML(r)}</span>`).join(' ')
                : '—'
            }
              </td>
              <td>
                ${userSucursales.length > 0
                ? `${userSucursales.length} sucursal(es)`
                : '—'
            }
              </td>
              <td>${formatDate(user.created_at)}</td>
              <td>
                <div class="actions-group">
                  <button class="btn-icon" data-action="edit" data-user-id="${user.id}" title="Editar">
                    ✏️
                  </button>
                  <button class="btn-icon" data-action="delete" data-user-id="${user.id}" title="Eliminar">
                    🗑️
                  </button>
                </div>
              </td>
            </tr>
          `;
    }).join('')}
      </tbody>
    </table>
  `;

    container.innerHTML = tableHTML;
}

function populateTenantSelect() {
    const select = document.getElementById('tenantSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Seleccionar tenant...</option>' +
        state.tenants.map(tenant =>
            `<option value="${tenant.id}">${escapeHTML(tenant.nombre)}</option>`
        ).join('');
}

function populateRolesSelect() {
    const select = document.getElementById('rolesSelect');
    if (!select) return;

    select.innerHTML = state.roles.map(role =>
        `<option value="${role.id}">${escapeHTML(role.nombre)}</option>`
    ).join('');
}

function populateSucursalesSelect(tenantId = null) {
    const select = document.getElementById('sucursalesSelect');
    if (!select) return;

    if (!tenantId) {
        select.innerHTML = '<option value="">Selecciona un tenant primero...</option>';
        select.disabled = true;
        return;
    }

    const filteredSucursales = state.allSucursales.filter(s => s.id_tenant === parseInt(tenantId));

    if (filteredSucursales.length === 0) {
        select.innerHTML = '<option value="">Este tenant no tiene sucursales</option>';
        select.disabled = true;
        return;
    }

    select.disabled = false;
    select.innerHTML = filteredSucursales.map(sucursal =>
        `<option value="${sucursal.id}">${escapeHTML(sucursal.nombre)}</option>`
    ).join('');
}

// ============================================================================
// EVENTOS
// ============================================================================

function initEventListeners() {
    document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
        e.preventDefault();
        clearSession();
        window.location.href = 'login.html';
    });

    document.getElementById('generatePasswordBtn')?.addEventListener('click', () => {
        const password = generateSecurePassword();
        const passwordInput = document.getElementById('userPassword');
        if (passwordInput) {
            passwordInput.value = password;
            showFeedback(`Contraseña generada: ${password}`, 'info');
        }
    });

    document.getElementById('tenantSelect')?.addEventListener('change', (e) => {
        const tenantId = e.target.value;
        populateSucursalesSelect(tenantId);
    });

    document.getElementById('createUserForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleCreateUser(e.target);
    });

    document.getElementById('refreshUsersBtn')?.addEventListener('click', async () => {
        await loadUsers();
        showFeedback('Lista de usuarios actualizada', 'success');
    });

    document.getElementById('usersTableContainer')?.addEventListener('click', async (e) => {
        const target = e.target;
        if (!target.dataset.action) return;

        const userId = parseInt(target.dataset.userId);
        const action = target.dataset.action;

        if (action === 'edit') {
            handleEditUser(userId);
        } else if (action === 'delete') {
            await handleDeleteUser(userId);
        }
    });
}

async function handleCreateUser(form) {
    const formData = new FormData(form);

    const userData = {
        id_tenant: parseInt(formData.get('id_tenant')),
        nombre: formData.get('nombre'),
        email: formData.get('email'),
        password: formData.get('password'),
        is_super_admin: formData.has('is_super_admin'),
        porcentaje_mano_obra: parseFloat(formData.get('porcentaje_mano_obra') || 0.5)
    };

    if (!userData.id_tenant || !userData.nombre || !userData.email || !userData.password) {
        showFeedback('Por favor completa todos los campos obligatorios', 'error');
        return;
    }

    const rolesSelect = document.getElementById('rolesSelect');
    const selectedRoles = Array.from(rolesSelect.selectedOptions).map(opt => parseInt(opt.value));

    const sucursalesSelect = document.getElementById('sucursalesSelect');
    const selectedSucursales = Array.from(sucursalesSelect.selectedOptions).map(opt => parseInt(opt.value));

    try {
        const newUser = await API.createUser(userData);

        if (selectedRoles.length > 0) {
            await API.assignRoles(newUser.id, selectedRoles);
        }

        if (selectedSucursales.length > 0) {
            await API.assignSucursales(newUser.id, selectedSucursales);
        }

        showFeedback(`Usuario ${userData.nombre} creado exitosamente`, 'success');
        form.reset();
        await loadUsers();
    } catch (error) {
        showFeedback(`Error al crear usuario: ${error.message}`, 'error');
    }
}

function handleEditUser(userId) {
    const user = state.users.find(u => u.id === userId);
    if (!user) return;
    showFeedback(`Edición de usuario ${user.nombre} - Funcionalidad pendiente`, 'info');
    console.log('Editar usuario:', user);
}

async function handleDeleteUser(userId) {
    const user = state.users.find(u => u.id === userId);
    if (!user) return;

    const confirmed = confirm(`¿Estás seguro de eliminar al usuario ${user.nombre}?`);
    if (!confirmed) return;

    try {
        await API.deleteUser(userId);
        showFeedback(`Usuario ${user.nombre} eliminado`, 'success');
        await loadUsers();
    } catch (error) {
        showFeedback(`Error al eliminar usuario: ${error.message}`, 'error');
    }
}

// ============================================================================
// CARGA DE DATOS
// ============================================================================

async function loadUsers() {
    try {
        state.users = await API.getUsers();
        renderUsersTable();
        updateStats();
    } catch (error) {
        showFeedback('Error al cargar usuarios', 'error');
    }
}

async function loadTenants() {
    try {
        state.tenants = await API.getTenants();
        populateTenantSelect();
        updateStats();
    } catch (error) {
        showFeedback('Error al cargar tenants', 'error');
    }
}

async function loadRoles() {
    try {
        state.roles = await API.getRoles();
        populateRolesSelect();
    } catch (error) {
        showFeedback('Error al cargar roles', 'error');
    }
}

async function loadSucursales() {
    try {
        state.allSucursales = await API.getSucursales();
        updateStats();
    } catch (error) {
        showFeedback('Error al cargar sucursales', 'error');
    }
}

async function init() {
    const user = await requireAuth();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    if (!user.is_super_admin) {
        showFeedback('Acceso denegado: Solo super administradores', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    state.currentUser = user;

    const userInfo = document.getElementById('userInfo');
    if (userInfo) {
        userInfo.textContent = user.nombre || user.email;
    }

    initEventListeners();

    await Promise.all([
        loadTenants(),
        loadRoles(),
        loadSucursales(),
        loadUsers()
    ]);

    showFeedback('Panel de administración cargado correctamente', 'success');
}

document.addEventListener('DOMContentLoaded', init);
