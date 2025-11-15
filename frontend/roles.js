// Registro centralizado de roles y usuarios autorizados.
// Este módulo expone `window.GOVERSA_ROLES` con una API sencilla para
// consultar los roles asignados por correo electrónico.
(function initRoleRegistry(global){
  const ROLE_DEFINITIONS = Object.freeze({
    admins: [
      {
        email: 'ivan.moreno@goversa.es',
        name: 'Iván Moreno',
        department: 'Dirección financiera',
        notes: 'Responsable máximo del área de finanzas.',
      },
      {
        email: 'finanzas@empresa.com',
        name: 'Equipo Finanzas',
        department: 'Finanzas',
        notes: 'Buzón compartido del equipo financiero.',
      },
    ],
    empleados: [
      {
        email: 'empleado@empresa.com',
        name: 'Empleado Demo',
        department: 'Operaciones',
        notes: 'Cuenta genérica para demostraciones internas.',
      },
    ],
  });

  const normalizeEmail = (email) => (email || '').trim().toLowerCase();

  function createRoleRegistry(definitions) {
    const roleEmails = {};
    const detailsByRole = {};
    const emailIndex = new Map();
    const aggregatedUsers = new Map();

    Object.entries(definitions).forEach(([roleKey, entries = []]) => {
      const emailsForRole = [];
      const details = [];

      entries.forEach((entry) => {
        const normalizedEmail = normalizeEmail(entry.email);
        if (!normalizedEmail) return;

        const canonicalEmail = entry.email.trim();
        if (!emailsForRole.includes(canonicalEmail)) {
          emailsForRole.push(canonicalEmail);
        }

        const detail = Object.freeze({
          email: canonicalEmail,
          normalizedEmail,
          role: roleKey,
          name: entry.name || '',
          department: entry.department || '',
          notes: entry.notes || '',
        });
        details.push(detail);

        const rolesForEmail = emailIndex.get(normalizedEmail) || new Set();
        rolesForEmail.add(roleKey);
        emailIndex.set(normalizedEmail, rolesForEmail);

        const aggregated =
          aggregatedUsers.get(normalizedEmail) || {
            email: canonicalEmail,
            normalizedEmail,
            name: entry.name || '',
            department: entry.department || '',
            roles: new Set(),
          };
        aggregated.roles.add(roleKey);
        if (!aggregated.name && entry.name) aggregated.name = entry.name;
        if (!aggregated.department && entry.department) {
          aggregated.department = entry.department;
        }
        aggregatedUsers.set(normalizedEmail, aggregated);
      });

      roleEmails[roleKey] = Object.freeze(emailsForRole.slice().sort());
      detailsByRole[roleKey] = Object.freeze(details);
    });

    function getRolesForEmail(email) {
      const normalizedEmail = normalizeEmail(email);
      if (!normalizedEmail) return [];
      return Array.from(emailIndex.get(normalizedEmail) || []);
    }

    function hasRole(email, role) {
      if (!role) return false;
      return getRolesForEmail(email).includes(role);
    }

    function listUsers() {
      return Array.from(aggregatedUsers.values())
        .map((user) => ({
          email: user.email,
          name: user.name,
          department: user.department,
          roles: Array.from(user.roles).sort(),
        }))
        .sort((a, b) => a.email.localeCompare(b.email));
    }

    return Object.freeze({
      ...roleEmails,
      details: Object.freeze(detailsByRole),
      getRolesForEmail,
      hasRole,
      isAdmin(email) {
        return hasRole(email, 'admins');
      },
      listUsers,
    });
  }

  const registry = createRoleRegistry(ROLE_DEFINITIONS);
  global.GOVERSA_ROLES = registry;
})(typeof window !== 'undefined' ? window : globalThis);