/**
 * Permissions Registry
 * Define todos los permisos del sistema de forma centralizada.
 * 
 * NOTA: Este archivo será la fuente de verdad para permisos.
 * Los permisos existentes en la DB (tabla permission) deben sincronizarse con esto.
 */

/**
 * Estructura de permisos por módulo
 * Formato: MODULO.ACCION
 */
const PERMISSIONS = {
    // === TALLER ===
    ORDENES: {
        VIEW: 'ordenes.view',
        CREATE: 'ordenes.create',
        EDIT: 'ordenes.edit',
        DELETE: 'ordenes.delete',
        ASSIGN: 'ordenes.assign',
        COMPLETE: 'ordenes.complete'
    },
    CITAS: {
        VIEW: 'citas.view',
        CREATE: 'citas.create',
        EDIT: 'citas.edit',
        DELETE: 'citas.delete'
    },
    INVENTARIO: {
        VIEW: 'inventario.view',
        CREATE: 'inventario.create',
        EDIT: 'inventario.edit',
        DELETE: 'inventario.delete',
        TRANSFER: 'inventario.transfer'
    },
    COMPRAS: {
        VIEW: 'compras.view',
        CREATE: 'compras.create',
        EDIT: 'compras.edit',
        DELETE: 'compras.delete',
        APPROVE: 'compras.approve'
    },

    // === VENTAS ===
    VENTAS: {
        VIEW: 'ventas.view',
        CREATE: 'ventas.create',
        EDIT: 'ventas.edit',
        DELETE: 'ventas.delete',
        REFUND: 'ventas.refund'
    },
    CAJA: {
        VIEW: 'caja.view',
        OPEN: 'caja.open',
        CLOSE: 'caja.close',
        MOVEMENT: 'caja.movement'
    },
    FACTURAS: {
        VIEW: 'facturas.view',
        CREATE: 'facturas.create',
        EDIT: 'facturas.edit',
        VOID: 'facturas.void',
        CONFIG: 'facturas.config'
    },

    // === CRM ===
    CLIENTES: {
        VIEW: 'clientes.view',
        CREATE: 'clientes.create',
        EDIT: 'clientes.edit',
        DELETE: 'clientes.delete'
    },
    VEHICULOS: {
        VIEW: 'vehiculos.view',
        CREATE: 'vehiculos.create',
        EDIT: 'vehiculos.edit',
        DELETE: 'vehiculos.delete'
    },

    // === ADMIN ===
    USUARIOS: {
        VIEW: 'usuarios.view',
        CREATE: 'usuarios.create',
        EDIT: 'usuarios.edit',
        DELETE: 'usuarios.delete',
        ASSIGN_ROLE: 'usuarios.assign_role'
    },
    SUCURSALES: {
        VIEW: 'sucursales.view',
        CREATE: 'sucursales.create',
        EDIT: 'sucursales.edit',
        DELETE: 'sucursales.delete'
    },
    ROLES: {
        VIEW: 'roles.view',
        CREATE: 'roles.create',
        EDIT: 'roles.edit',
        DELETE: 'roles.delete'
    },
    CONFIG: {
        VIEW: 'config.view',
        EDIT: 'config.edit'
    },

    // === MARKETPLACE ===
    MARKETPLACE: {
        VIEW: 'marketplace.view',
        MANAGE_LISTING: 'marketplace.manage_listing',
        MANAGE_SERVICES: 'marketplace.manage_services',
        MANAGE_PROMOS: 'marketplace.manage_promos'
    },

    // === MARKETING ===
    EMAIL: {
        VIEW: 'email.view',
        CREATE: 'email.create',
        SEND: 'email.send'
    }
};

/**
 * Obtener todos los permisos como array plano
 */
function getAllPermissions() {
    const perms = [];
    for (const module of Object.values(PERMISSIONS)) {
        for (const perm of Object.values(module)) {
            perms.push(perm);
        }
    }
    return perms;
}

/**
 * Verificar si un permiso existe
 */
function isValidPermission(permission) {
    return getAllPermissions().includes(permission);
}

module.exports = {
    PERMISSIONS,
    getAllPermissions,
    isValidPermission
};
