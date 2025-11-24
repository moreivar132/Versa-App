(function initRoleRegistry(global){
  const emptyRegistry = Object.freeze({
    admins: Object.freeze([]),
    empleados: Object.freeze([]),
    details: Object.freeze({}),
    getRolesForEmail: () => [],
    hasRole: () => false,
    isAdmin: () => false,
    listUsers: () => [],
  });

  global.GOVERSA_ROLES = emptyRegistry;
})(typeof window !== 'undefined' ? window : globalThis);
