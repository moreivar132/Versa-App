document.addEventListener('DOMContentLoaded', async () => {
  const user = await Auth.requireAuth();
  if (!user) return;

  const isSuperAdmin = Boolean(user.is_super_admin);
  if (!isSuperAdmin) {
    alert('Acceso restringido a super administradores.');
    window.location.replace('index.html');
    return;
  }

  const userInfo = document.getElementById('userInfo');
  if (userInfo) {
    userInfo.textContent = `${user.nombre || user.email} · Administrador`;
  }

  // =============================
  // NUEVO PANEL SUPER ADMIN (SaaS)
  // =============================
  const superAdminPanel = document.getElementById('superAdminPanel');
  if (superAdminPanel) {
    superAdminPanel.hidden = !isSuperAdmin;
    if (isSuperAdmin) {
      setupSuperAdminPanel();
    }
  }
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
