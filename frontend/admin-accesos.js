// ============================================================================
// ADMIN ACCESOS - Módulo completo de Administración de Accesos
// ============================================================================
// Este módulo gestiona:
// - Usuarios (CRUD + asignación de roles y sucursales)
// - Roles (CRUD + asignación de permisos)
// - Permisos (CRUD)
// - Tenants (CRUD)
// - Sucursales (CRUD)

import { requireAuth, clearSession } from './auth.js';
import usersService from './services/users-service.js';
import rolesService from './services/roles-service.js';
import permisosService from './services/permisos-service.js';
import tenantsService from './services/tenants-service.js';
import sucursalesService from './services/sucursales-service.js';

// ============================================================================
// ESTADO GLOBAL
// ============================================================================
const state = {
    currentUser: null,
    users: [],
    roles: [],
    permisos: [],
    tenants: [],
    sucursales: [],
    currentTab: 'usuarios'
};

// ============================================================================
// UTILIDADES
// ============================================================================

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = `toast toast-${type} active`;

    setTimeout(() => {
        toast.classList.remove('active');
    }, 5000);
}

function escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '—';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function generateSecurePassword() {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=';
    const array = new Uint32Array(length);
    window.crypto.getRandomValues(array);
    return Array.from(array, (x) => charset[x % charset.length]).join('');
}

// ============================================================================
// RENDERIZADO DE TABLAS
// ============================================================================

function renderUsersTable() {
    const container = document.getElementById('usersTableContainer');
    if (!container) return;

    if (state.users.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <h3>No hay usuarios registrados</h3>
                <p>Crea el primer usuario usando el botón "Crear Usuario"</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <table>
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
                        <tr>
                            <td><strong>${escapeHTML(user.nombre)}</strong></td>
                            <td>${escapeHTML(user.email)}</td>
                            <td>${tenant ? escapeHTML(tenant.nombre) : '—'}</td>
                            <td>
                                ${user.is_super_admin
                ? '<span class="badge badge-super-admin">Super Admin</span>'
                : '<span class="badge badge-user">Usuario</span>'
            }
                            </td>
                            <td>
                                ${userRoles.length > 0
                ? userRoles.map(r => `<span class="badge badge-admin">${escapeHTML(r)}</span>`).join(' ')
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
                                <div class="flex gap-2">
                                    <button class="btn-icon" onclick="editUser(${user.id})" title="Editar">✏️</button>
                                    <button class="btn-icon" onclick="deleteUser(${user.id})" title="Eliminar">🗑️</button>
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

function renderRolesTable() {
    const container = document.getElementById('rolesTableContainer');
    if (!container) return;

    if (state.roles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <h3>No hay roles registrados</h3>
                <p>Crea el primer rol usando el botón "Crear Rol"</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Nombre del Rol</th>
                    <th>Usuarios con este rol</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${state.roles.map(role => {
        const usersWithRole = state.users.filter(u =>
            u.roles && u.roles.includes(role.nombre)
        ).length;

        return `
                        <tr>
                            <td><strong>${escapeHTML(role.nombre)}</strong></td>
                            <td>${usersWithRole} usuario(s)</td>
                            <td>
                                <div class="flex gap-2">
                                    <button class="btn-icon" onclick="editRole(${role.id})" title="Editar">✏️</button>
                                    <button class="btn-icon" onclick="deleteRole(${role.id})" title="Eliminar">🗑️</button>
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

function renderPermisosTable() {
    const container = document.getElementById('permisosTableContainer');
    if (!container) return;

    if (state.permisos.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3>No hay permisos registrados</h3>
                <p>Los permisos se gestionan desde el backend. Si no ves permisos, verifica que los endpoints estén implementados.</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Nombre del Permiso</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${state.permisos.map(permiso => `
                    <tr>
                        <td><strong>${escapeHTML(permiso.nombre)}</strong></td>
                        <td>
                            <div class="flex gap-2">
                                <button class="btn-icon" onclick="editPermiso(${permiso.id})" title="Editar">✏️</button>
                                <button class="btn-icon" onclick="deletePermiso(${permiso.id})" title="Eliminar">🗑️</button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    container.innerHTML = tableHTML;
}

function renderTenantsTable() {
    const container = document.getElementById('tenantsTableContainer');
    if (!container) return;

    if (state.tenants.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <h3>No hay tenants registrados</h3>
                <p>Crea el primer tenant usando el botón "Crear Tenant"</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Nombre del Tenant</th>
                    <th>Usuarios</th>
                    <th>Sucursales</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${state.tenants.map(tenant => {
        const usersCount = state.users.filter(u => u.id_tenant === tenant.id).length;
        const sucursalesCount = state.sucursales.filter(s => s.id_tenant === tenant.id).length;

        return `
                        <tr>
                            <td><strong>${escapeHTML(tenant.nombre)}</strong></td>
                            <td>${usersCount} usuario(s)</td>
                            <td>${sucursalesCount} sucursal(es)</td>
                            <td>
                                <div class="flex gap-2">
                                    <button class="btn-icon" onclick="editTenant(${tenant.id})" title="Editar">✏️</button>
                                    <button class="btn-icon" onclick="deleteTenant(${tenant.id})" title="Eliminar">🗑️</button>
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

function renderSucursalesTable() {
    const container = document.getElementById('sucursalesTableContainer');
    if (!container) return;

    if (state.sucursales.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h3>No hay sucursales registradas</h3>
                <p>Crea la primera sucursal usando el botón "Crear Sucursal"</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <table>
            <thead>
                <tr>
                    <th>Nombre de la Sucursal</th>
                    <th>Tenant</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
                ${state.sucursales.map(sucursal => {
        const tenant = state.tenants.find(t => t.id === sucursal.id_tenant);

        return `
                        <tr>
                            <td><strong>${escapeHTML(sucursal.nombre)}</strong></td>
                            <td>${tenant ? escapeHTML(tenant.nombre) : '—'}</td>
                            <td>
                                <div class="flex gap-2">
                                    <button class="btn-icon" onclick="editSucursal(${sucursal.id})" title="Editar">✏️</button>
                                    <button class="btn-icon" onclick="deleteSucursal(${sucursal.id})" title="Eliminar">🗑️</button>
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

// ============================================================================
// CARGA DE DATOS
// ============================================================================

async function loadUsers() {
    try {
        state.users = await usersService.getUsers();
        renderUsersTable();
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
        showToast('Error al cargar usuarios: ' + error.message, 'error');
    }
}

async function loadRoles() {
    try {
        state.roles = await rolesService.getRoles();
        renderRolesTable();
        populateRolesSelects();
    } catch (error) {
        console.error('Error al cargar roles:', error);
        showToast('Error al cargar roles: ' + error.message, 'error');
    }
}

async function loadPermisos() {
    try {
        state.permisos = await permisosService.getPermisos();
        renderPermisosTable();
    } catch (error) {
        console.error('Error al cargar permisos:', error);
        // No mostrar error si simplemente no hay endpoint
        if (error.response?.status !== 404) {
            showToast('Error al cargar permisos: ' + error.message, 'error');
        }
    }
}

async function loadTenants() {
    try {
        state.tenants = await tenantsService.getTenants();
        renderTenantsTable();
        populateTenantsSelects();
    } catch (error) {
        console.error('Error al cargar tenants:', error);
        showToast('Error al cargar tenants: ' + error.message, 'error');
    }
}

async function loadSucursales() {
    try {
        state.sucursales = await sucursalesService.getSucursales();
        renderSucursalesTable();
        populateSucursalesSelects();
    } catch (error) {
        console.error('Error al cargar sucursales:', error);
        showToast('Error al cargar sucursales: ' + error.message, 'error');
    }
}

// ============================================================================
// POBLACIÓN DE SELECTS
// ============================================================================

function populateTenantsSelects() {
    const selects = document.querySelectorAll('#userTenant, #sucursalTenant');
    selects.forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">Seleccionar tenant...</option>' +
            state.tenants.map(tenant =>
                `<option value="${tenant.id}">${escapeHTML(tenant.nombre)}</option>`
            ).join('');
        if (currentValue) select.value = currentValue;
    });
}

function populateRolesSelects() {
    const select = document.getElementById('userRoles');
    if (!select) return;

    const currentValues = Array.from(select.selectedOptions).map(opt => opt.value);
    select.innerHTML = state.roles.map(role =>
        `<option value="${role.id}">${escapeHTML(role.nombre)}</option>`
    ).join('');

    // Restaurar selección
    currentValues.forEach(value => {
        const option = select.querySelector(`option[value="${value}"]`);
        if (option) option.selected = true;
    });
}

function populateSucursalesSelects() {
    const select = document.getElementById('userSucursales');
    if (!select) return;

    const tenantId = document.getElementById('userTenant')?.value;
    if (!tenantId) {
        select.innerHTML = '<option value="">Selecciona un tenant primero...</option>';
        select.disabled = true;
        return;
    }

    const filteredSucursales = state.sucursales.filter(s => s.id_tenant === parseInt(tenantId));

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
// GESTIÓN DE USUARIOS
// ============================================================================

window.openUserModal = function (userId = null) {
    const modal = document.getElementById('userModal');
    const form = document.getElementById('userForm');
    const title = document.getElementById('userModalTitle');
    const passwordGroup = document.getElementById('passwordGroup');

    form.reset();

    if (userId) {
        // Modo edición
        const user = state.users.find(u => u.id === userId);
        if (!user) return;

        title.textContent = 'Editar Usuario';
        document.getElementById('userId').value = user.id;
        document.getElementById('userName').value = user.nombre;
        document.getElementById('userEmail').value = user.email;
        document.getElementById('userTenant').value = user.id_tenant || '';
        document.getElementById('userPorcentaje').value = user.porcentaje_mano_obra || 0.5;
        document.getElementById('userIsSuperAdmin').checked = user.is_super_admin;

        // Ocultar campo de contraseña en edición
        passwordGroup.style.display = 'none';
        document.getElementById('userPassword').required = false;

        // Cargar sucursales del tenant
        populateSucursalesSelects();

        // TODO: Preseleccionar roles y sucursales actuales del usuario

    } else {
        // Modo creación
        title.textContent = 'Crear Usuario';
        passwordGroup.style.display = 'block';
        document.getElementById('userPassword').required = true;
    }

    modal.classList.add('active');
};

window.closeUserModal = function () {
    document.getElementById('userModal').classList.remove('active');
};

window.editUser = function (userId) {
    openUserModal(userId);
};

window.deleteUser = async function (userId) {
    const user = state.users.find(u => u.id === userId);
    if (!user) return;

    if (!confirm(`¿Estás seguro de eliminar al usuario "${user.nombre}"?`)) {
        return;
    }

    try {
        await usersService.deleteUser(userId);
        showToast(`Usuario "${user.nombre}" eliminado correctamente`, 'success');
        await loadUsers();
    } catch (error) {
        console.error('Error al eliminar usuario:', error);
        showToast('Error al eliminar usuario: ' + error.message, 'error');
    }
};

// ============================================================================
// GESTIÓN DE TENANTS
// ============================================================================

window.openTenantModal = function (tenantId = null) {
    const modal = document.getElementById('tenantModal');
    const form = document.getElementById('tenantForm');
    const title = document.getElementById('tenantModalTitle');

    form.reset();

    if (tenantId) {
        const tenant = state.tenants.find(t => t.id === tenantId);
        if (!tenant) return;

        title.textContent = 'Editar Tenant';
        document.getElementById('tenantId').value = tenant.id;
        document.getElementById('tenantName').value = tenant.nombre;
    } else {
        title.textContent = 'Crear Tenant';
    }

    modal.classList.add('active');
};

window.closeTenantModal = function () {
    document.getElementById('tenantModal').classList.remove('active');
};

window.editTenant = function (tenantId) {
    openTenantModal(tenantId);
};

window.deleteTenant = async function (tenantId) {
    const tenant = state.tenants.find(t => t.id === tenantId);
    if (!tenant) return;

    if (!confirm(`¿Estás seguro de eliminar el tenant "${tenant.nombre}"?`)) {
        return;
    }

    try {
        await tenantsService.deleteTenant(tenantId);
        showToast(`Tenant "${tenant.nombre}" eliminado correctamente`, 'success');
        await loadTenants();
    } catch (error) {
        console.error('Error al eliminar tenant:', error);
        showToast('Error al eliminar tenant: ' + error.message, 'error');
    }
};

// ============================================================================
// GESTIÓN DE SUCURSALES
// ============================================================================

window.openSucursalModal = function (sucursalId = null) {
    const modal = document.getElementById('sucursalModal');
    const form = document.getElementById('sucursalForm');
    const title = document.getElementById('sucursalModalTitle');

    form.reset();

    if (sucursalId) {
        const sucursal = state.sucursales.find(s => s.id === sucursalId);
        if (!sucursal) return;

        title.textContent = 'Editar Sucursal';
        document.getElementById('sucursalId').value = sucursal.id;
        document.getElementById('sucursalName').value = sucursal.nombre;
        document.getElementById('sucursalTenant').value = sucursal.id_tenant;
    } else {
        title.textContent = 'Crear Sucursal';
    }

    modal.classList.add('active');
};

window.closeSucursalModal = function () {
    document.getElementById('sucursalModal').classList.remove('active');
};

window.editSucursal = function (sucursalId) {
    openSucursalModal(sucursalId);
};

window.deleteSucursal = async function (sucursalId) {
    const sucursal = state.sucursales.find(s => s.id === sucursalId);
    if (!sucursal) return;

    if (!confirm(`¿Estás seguro de eliminar la sucursal "${sucursal.nombre}"?`)) {
        return;
    }

    try {
        await sucursalesService.deleteSucursal(sucursalId);
        showToast(`Sucursal "${sucursal.nombre}" eliminada correctamente`, 'success');
        await loadSucursales();
    } catch (error) {
        console.error('Error al eliminar sucursal:', error);
        showToast('Error al eliminar sucursal: ' + error.message, 'error');
    }
};

// ============================================================================
// GESTIÓN DE ROLES
// ============================================================================

window.openRoleModal = function (roleId = null) {
    const modal = document.getElementById('roleModal');
    const form = document.getElementById('roleForm');
    const title = document.getElementById('roleModalTitle');

    form.reset();

    if (roleId) {
        const role = state.roles.find(r => r.id === roleId);
        if (!role) return;

        title.textContent = 'Editar Rol';
        document.getElementById('roleId').value = role.id;
        document.getElementById('roleName').value = role.nombre;
    } else {
        title.textContent = 'Crear Rol';
    }

    modal.classList.add('active');
};

window.closeRoleModal = function () {
    document.getElementById('roleModal').classList.remove('active');
};

window.editRole = function (roleId) {
    openRoleModal(roleId);
};

window.deleteRole = async function (roleId) {
    const role = state.roles.find(r => r.id === roleId);
    if (!role) return;

    if (!confirm(`¿Estás seguro de eliminar el rol "${role.nombre}"?`)) {
        return;
    }

    try {
        await rolesService.deleteRole(roleId);
        showToast(`Rol "${role.nombre}" eliminado correctamente`, 'success');
        await loadRoles();
    } catch (error) {
        console.error('Error al eliminar rol:', error);
        showToast('Error al eliminar rol: ' + error.message, 'error');
    }
};

// ============================================================================
// GESTIÓN DE PERMISOS
// ============================================================================

window.openPermisoModal = function (permisoId = null) {
    const modal = document.getElementById('permisoModal');
    const form = document.getElementById('permisoForm');
    const title = document.getElementById('permisoModalTitle');

    form.reset();

    if (permisoId) {
        const permiso = state.permisos.find(p => p.id === permisoId);
        if (!permiso) return;

        title.textContent = 'Editar Permiso';
        document.getElementById('permisoId').value = permiso.id;
        document.getElementById('permisoName').value = permiso.nombre;
    } else {
        title.textContent = 'Crear Permiso';
    }

    modal.classList.add('active');
};

window.closePermisoModal = function () {
    document.getElementById('permisoModal').classList.remove('active');
};

window.editPermiso = function (permisoId) {
    openPermisoModal(permisoId);
};

window.deletePermiso = async function (permisoId) {
    const permiso = state.permisos.find(p => p.id === permisoId);
    if (!permiso) return;

    if (!confirm(`¿Estás seguro de eliminar el permiso "${permiso.nombre}"?`)) {
        return;
    }

    try {
        await permisosService.deletePermiso(permisoId);
        showToast(`Permiso "${permiso.nombre}" eliminado correctamente`, 'success');
        await loadPermisos();
    } catch (error) {
        console.error('Error al eliminar permiso:', error);
        showToast('Error al eliminar permiso: ' + error.message, 'error');
    }
};

// ============================================================================
// MANEJADORES DE FORMULARIOS
// ============================================================================

async function handleUserFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const userId = formData.get('id');

    const userData = {
        nombre: formData.get('nombre'),
        email: formData.get('email'),
        id_tenant: parseInt(formData.get('id_tenant')),
        is_super_admin: formData.has('is_super_admin'),
        porcentaje_mano_obra: parseFloat(formData.get('porcentaje_mano_obra'))
    };

    // Solo incluir password en creación
    if (!userId) {
        userData.password = formData.get('password');
    }

    // Obtener roles y sucursales seleccionados
    const rolesSelect = document.getElementById('userRoles');
    const selectedRoles = Array.from(rolesSelect.selectedOptions).map(opt => parseInt(opt.value));

    const sucursalesSelect = document.getElementById('userSucursales');
    const selectedSucursales = Array.from(sucursalesSelect.selectedOptions).map(opt => parseInt(opt.value));

    try {
        let user;
        if (userId) {
            // Actualizar
            user = await usersService.updateUser(parseInt(userId), userData);
            showToast('Usuario actualizado correctamente', 'success');
        } else {
            // Crear
            user = await usersService.createUser(userData);
            showToast('Usuario creado correctamente', 'success');
        }

        // Asignar roles
        if (selectedRoles.length > 0) {
            await usersService.assignRolesToUser(user.id, selectedRoles);
        }

        // Asignar sucursales
        if (selectedSucursales.length > 0) {
            await usersService.assignSucursalesToUser(user.id, selectedSucursales);
        }

        closeUserModal();
        await loadUsers();
    } catch (error) {
        console.error('Error al guardar usuario:', error);
        showToast('Error al guardar usuario: ' + error.message, 'error');
    }
}

async function handleTenantFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const tenantId = formData.get('id');

    const tenantData = {
        nombre: formData.get('nombre')
    };

    try {
        if (tenantId) {
            await tenantsService.updateTenant(parseInt(tenantId), tenantData);
            showToast('Tenant actualizado correctamente', 'success');
        } else {
            await tenantsService.createTenant(tenantData);
            showToast('Tenant creado correctamente', 'success');
        }

        closeTenantModal();
        await loadTenants();
    } catch (error) {
        console.error('Error al guardar tenant:', error);
        showToast('Error al guardar tenant: ' + error.message, 'error');
    }
}

async function handleSucursalFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const sucursalId = formData.get('id');

    const sucursalData = {
        nombre: formData.get('nombre'),
        id_tenant: parseInt(formData.get('id_tenant'))
    };

    try {
        if (sucursalId) {
            await sucursalesService.updateSucursal(parseInt(sucursalId), sucursalData);
            showToast('Sucursal actualizada correctamente', 'success');
        } else {
            await sucursalesService.createSucursal(sucursalData);
            showToast('Sucursal creada correctamente', 'success');
        }

        closeSucursalModal();
        await loadSucursales();
    } catch (error) {
        console.error('Error al guardar sucursal:', error);
        showToast('Error al guardar sucursal: ' + error.message, 'error');
    }
}

async function handleRoleFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const roleId = formData.get('id');

    const roleData = {
        nombre: formData.get('nombre')
    };

    try {
        if (roleId) {
            await rolesService.updateRole(parseInt(roleId), roleData);
            showToast('Rol actualizado correctamente', 'success');
        } else {
            await rolesService.createRole(roleData);
            showToast('Rol creado correctamente', 'success');
        }

        closeRoleModal();
        await loadRoles();
    } catch (error) {
        console.error('Error al guardar rol:', error);
        showToast('Error al guardar rol: ' + error.message, 'error');
    }
}

async function handlePermisoFormSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const permisoId = formData.get('id');

    const permisoData = {
        nombre: formData.get('nombre')
    };

    try {
        if (permisoId) {
            await permisosService.updatePermiso(parseInt(permisoId), permisoData);
            showToast('Permiso actualizado correctamente', 'success');
        } else {
            await permisosService.createPermiso(permisoData);
            showToast('Permiso creado correctamente', 'success');
        }

        closePermisoModal();
        await loadPermisos();
    } catch (error) {
        console.error('Error al guardar permiso:', error);
        showToast('Error al guardar permiso: ' + error.message, 'error');
    }
}

// ============================================================================
// INICIALIZACIÓN
// ============================================================================

function initEventListeners() {
    // Logout
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
        clearSession();
        window.location.href = 'login.html';
    });

    // Tabs
    document.querySelectorAll('.tab-button').forEach(button => {
        button.addEventListener('click', () => {
            const tab = button.dataset.tab;

            // Actualizar botones
            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            button.classList.add('active');

            // Actualizar contenido
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`tab-${tab}`)?.classList.add('active');

            state.currentTab = tab;
        });
    });

    // Botones de crear
    document.getElementById('createUserBtn')?.addEventListener('click', () => openUserModal());
    document.getElementById('createTenantBtn')?.addEventListener('click', () => openTenantModal());
    document.getElementById('createSucursalBtn')?.addEventListener('click', () => openSucursalModal());
    document.getElementById('createRoleBtn')?.addEventListener('click', () => openRoleModal());
    document.getElementById('createPermisoBtn')?.addEventListener('click', () => openPermisoModal());

    // Botones de refresh
    document.getElementById('refreshUsersBtn')?.addEventListener('click', loadUsers);

    // Generar contraseña
    document.getElementById('generatePasswordBtn')?.addEventListener('click', () => {
        const password = generateSecurePassword();
        document.getElementById('userPassword').value = password;
        showToast(`Contraseña generada: ${password}`, 'info');
    });

    // Cambio de tenant en formulario de usuario
    document.getElementById('userTenant')?.addEventListener('change', populateSucursalesSelects);

    // Formularios
    document.getElementById('userForm')?.addEventListener('submit', handleUserFormSubmit);
    document.getElementById('tenantForm')?.addEventListener('submit', handleTenantFormSubmit);
    document.getElementById('sucursalForm')?.addEventListener('submit', handleSucursalFormSubmit);
    document.getElementById('roleForm')?.addEventListener('submit', handleRoleFormSubmit);
    document.getElementById('permisoForm')?.addEventListener('submit', handlePermisoFormSubmit);

    // Cerrar modales al hacer click fuera
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });
}

async function init() {
    // Verificar autenticación
    const user = await requireAuth();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }

    // Verificar que sea Super Admin
    if (!user.is_super_admin) {
        showToast('Acceso denegado: Solo Super Administradores', 'error');
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
        return;
    }

    state.currentUser = user;

    // Mostrar nombre de usuario
    const userNameEl = document.getElementById('currentUserName');
    if (userNameEl) {
        userNameEl.textContent = user.nombre || user.email;
    }

    // Inicializar event listeners
    initEventListeners();

    // Cargar todos los datos en paralelo
    await Promise.all([
        loadTenants(),
        loadRoles(),
        loadSucursales(),
        loadPermisos(),
        loadUsers()
    ]);

    showToast('Módulo de administración cargado correctamente', 'success');
}

// Iniciar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);
