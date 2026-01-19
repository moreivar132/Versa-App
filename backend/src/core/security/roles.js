/**
 * Roles Registry
 * Define los roles base del sistema y sus permisos por defecto.
 * 
 * NOTA: Los roles en BD pueden tener permisos personalizados.
 * Estos son los defaults que se aplican al crear un rol.
 */

const { PERMISSIONS } = require('./permissions');

/**
 * Roles predefinidos del sistema
 */
const SYSTEM_ROLES = {
    SUPER_ADMIN: {
        code: 'SUPER_ADMIN',
        name: 'Super Administrador',
        description: 'Acceso total a todas las funcionalidades del sistema',
        isSystem: true,
        permissions: '*' // Acceso total
    },
    ADMIN: {
        code: 'ADMIN',
        name: 'Administrador',
        description: 'Administrador de la organización/tenant',
        isSystem: true,
        permissions: [
            // Todas las acciones de gestión
            ...Object.values(PERMISSIONS.ORDENES),
            ...Object.values(PERMISSIONS.CITAS),
            ...Object.values(PERMISSIONS.INVENTARIO),
            ...Object.values(PERMISSIONS.COMPRAS),
            ...Object.values(PERMISSIONS.VENTAS),
            ...Object.values(PERMISSIONS.CAJA),
            ...Object.values(PERMISSIONS.FACTURAS),
            ...Object.values(PERMISSIONS.CLIENTES),
            ...Object.values(PERMISSIONS.VEHICULOS),
            ...Object.values(PERMISSIONS.USUARIOS),
            ...Object.values(PERMISSIONS.SUCURSALES),
            ...Object.values(PERMISSIONS.ROLES),
            ...Object.values(PERMISSIONS.CONFIG),
            ...Object.values(PERMISSIONS.MARKETPLACE),
            ...Object.values(PERMISSIONS.EMAIL),
            // FinSaaS Admin permissions (TENANT_ADMIN only)
            ...Object.values(PERMISSIONS.FINSAAS)
        ]
    },
    GERENTE: {
        code: 'GERENTE',
        name: 'Gerente',
        description: 'Gerente de sucursal con acceso amplio',
        isSystem: false,
        permissions: [
            ...Object.values(PERMISSIONS.ORDENES),
            ...Object.values(PERMISSIONS.CITAS),
            ...Object.values(PERMISSIONS.INVENTARIO),
            ...Object.values(PERMISSIONS.COMPRAS),
            ...Object.values(PERMISSIONS.VENTAS),
            ...Object.values(PERMISSIONS.CAJA),
            PERMISSIONS.FACTURAS.VIEW,
            PERMISSIONS.FACTURAS.CREATE,
            ...Object.values(PERMISSIONS.CLIENTES),
            ...Object.values(PERMISSIONS.VEHICULOS),
            PERMISSIONS.USUARIOS.VIEW
        ]
    },
    RECEPCIONISTA: {
        code: 'RECEPCIONISTA',
        name: 'Recepcionista',
        description: 'Atención al cliente y gestión de citas',
        isSystem: false,
        permissions: [
            PERMISSIONS.ORDENES.VIEW,
            PERMISSIONS.ORDENES.CREATE,
            ...Object.values(PERMISSIONS.CITAS),
            PERMISSIONS.INVENTARIO.VIEW,
            PERMISSIONS.VENTAS.VIEW,
            PERMISSIONS.VENTAS.CREATE,
            PERMISSIONS.CAJA.VIEW,
            PERMISSIONS.CAJA.MOVEMENT,
            ...Object.values(PERMISSIONS.CLIENTES),
            ...Object.values(PERMISSIONS.VEHICULOS)
        ]
    },
    MECANICO: {
        code: 'MECANICO',
        name: 'Mecánico',
        description: 'Técnico de taller',
        isSystem: false,
        permissions: [
            PERMISSIONS.ORDENES.VIEW,
            PERMISSIONS.ORDENES.EDIT,
            PERMISSIONS.ORDENES.COMPLETE,
            PERMISSIONS.CITAS.VIEW,
            PERMISSIONS.INVENTARIO.VIEW,
            PERMISSIONS.VEHICULOS.VIEW
        ]
    }
};

/**
 * Verificar si un rol tiene un permiso específico
 */
function roleHasPermission(roleCode, permission) {
    const role = SYSTEM_ROLES[roleCode];
    if (!role) return false;
    if (role.permissions === '*') return true;
    return role.permissions.includes(permission);
}

/**
 * Check if user has tenant admin role
 * @param {Array|string} userRoles - Array of role objects/strings or single role string
 * @returns {boolean}
 */
function isTenantAdmin(userRoles) {
    const TENANT_ADMIN_ROLES = ['ADMIN', 'TENANT_ADMIN', 'SUPER_ADMIN', 'ADMINISTRADOR'];

    if (!userRoles) return false;

    // Handle single string
    if (typeof userRoles === 'string') {
        return TENANT_ADMIN_ROLES.includes(userRoles.toUpperCase());
    }

    // Handle array
    if (!Array.isArray(userRoles)) return false;

    return userRoles.some(r => {
        const roleName = typeof r === 'string' ? r : (r.nombre || r.name || r.code || '');
        return TENANT_ADMIN_ROLES.includes(roleName.toUpperCase());
    });
}

module.exports = {
    SYSTEM_ROLES,
    roleHasPermission,
    isTenantAdmin
};
