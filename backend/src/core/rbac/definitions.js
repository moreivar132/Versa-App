/**
 * RBAC Definitions - Source of Truth
 * 
 * Defines all Verticals, Permissions, and System Roles.
 * Used by the Sync Service to populate/update the database.
 */

const VERTICALS = {
    TALLER: 1,
    SAAS: 2,
    MARKETPLACE: 3,
    TASKS_LEADS: 4
};

const PERMISSIONS = [
    // =================================================================
    // SAAS / CONTABILIDAD (Vertical 2)
    // =================================================================
    { key: 'contabilidad.read', nombre: 'Ver Contabilidad (General)', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.dashboard.read', nombre: 'Ver Dashboard Contable', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.factura.read', nombre: 'Ver Facturas', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.documento.read', nombre: 'Ver Biblioteca de Documentos', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.gasto.write', nombre: 'Subir Gastos (OCR)', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.write', nombre: 'Editar Contabilidad', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.approve', nombre: 'Aprobar/Anular Contabilidad', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.admin', nombre: 'Admin Contabilidad', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.export', nombre: 'Exportar Contabilidad', module: 'contabilidad', vertical_id: VERTICALS.SAAS },

    // Empresas (Tenant Management within SaaS)
    { key: 'contabilidad.empresa.read', nombre: 'Ver Empresas', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.empresa.write', nombre: 'Editar Empresas', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'finsaas.empresa.manage', nombre: 'Gestionar Empresas (Admin)', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'finsaas.invites.manage', nombre: 'Gestionar Usuarios e Invitaciones', module: 'finsaas', vertical_id: VERTICALS.SAAS },
    { key: 'finsaas.rbac.manage', nombre: 'Gestionar Roles y Permisos', module: 'finsaas', vertical_id: VERTICALS.SAAS },

    // Tesorería e Impuestos
    { key: 'contabilidad.tesoreria.read', nombre: 'Ver Tesorería', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.tesoreria.write', nombre: 'Editar Tesorería', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.trimestre.read', nombre: 'Ver Trimestres Fiscales', module: 'contabilidad', vertical_id: VERTICALS.SAAS },
    { key: 'contabilidad.config.read', nombre: 'Ver Configuración Factura', module: 'contabilidad', vertical_id: VERTICALS.SAAS },

    // Fiscal / Deducibles
    { key: 'contabilidad.deducible.approve', nombre: 'Aprobar Deducibles', module: 'contabilidad', vertical_id: VERTICALS.SAAS },

    // Copiloto (AI)
    { key: 'copiloto.read', nombre: 'Usar Copiloto', module: 'copiloto', vertical_id: VERTICALS.SAAS },
    { key: 'copiloto.write', nombre: 'Configurar Copiloto', module: 'copiloto', vertical_id: VERTICALS.SAAS },
    { key: 'copiloto.admin', nombre: 'Admin Copiloto', module: 'copiloto', vertical_id: VERTICALS.SAAS },

    // =================================================================
    // TALLER (Vertical 1) & GLOBAL
    // =================================================================
    // Clientes (Used in clientes.routes.js)
    { key: 'clientes.read', nombre: 'Ver Clientes', module: 'clientes', vertical_id: VERTICALS.TALLER },
    { key: 'clientes.write', nombre: 'Editar Clientes', module: 'clientes', vertical_id: VERTICALS.TALLER },

    // Vehículos (Used in vehiculos.routes.js)
    { key: 'vehiculos.read', nombre: 'Ver Vehículos', module: 'vehiculos', vertical_id: VERTICALS.TALLER },
    { key: 'vehiculos.write', nombre: 'Editar Vehículos', module: 'vehiculos', vertical_id: VERTICALS.TALLER },

    // Ventas (Placeholder - not strictly enforced yet in code but good to have)
    { key: 'ventas.read', nombre: 'Ver Ventas', module: 'ventas', vertical_id: VERTICALS.TALLER },
    { key: 'ventas.write', nombre: 'Crear Ventas', module: 'ventas', vertical_id: VERTICALS.TALLER },

    // =================================================================
    // TASKS & LEADS (Vertical 4)
    // =================================================================
    // Projects
    { key: 'tasksleads.projects.view', nombre: 'Ver Proyectos', module: 'projects', vertical_id: VERTICALS.TASKS_LEADS },
    { key: 'tasksleads.projects.create', nombre: 'Crear Proyectos', module: 'projects', vertical_id: VERTICALS.TASKS_LEADS },
    { key: 'tasksleads.projects.edit', nombre: 'Editar Proyectos', module: 'projects', vertical_id: VERTICALS.TASKS_LEADS },
    { key: 'tasksleads.projects.delete', nombre: 'Eliminar Proyectos', module: 'projects', vertical_id: VERTICALS.TASKS_LEADS },

    // Tasks
    { key: 'tasksleads.tasks.view', nombre: 'Ver Tareas', module: 'tasks', vertical_id: VERTICALS.TASKS_LEADS },
    { key: 'tasksleads.tasks.create', nombre: 'Crear Tareas', module: 'tasks', vertical_id: VERTICALS.TASKS_LEADS },
    { key: 'tasksleads.tasks.edit', nombre: 'Editar Tareas', module: 'tasks', vertical_id: VERTICALS.TASKS_LEADS },
    { key: 'tasksleads.tasks.delete', nombre: 'Eliminar Tareas', module: 'tasks', vertical_id: VERTICALS.TASKS_LEADS },

    // Leads
    { key: 'tasksleads.leads.view', nombre: 'Ver Leads', module: 'leads', vertical_id: VERTICALS.TASKS_LEADS },
    { key: 'tasksleads.leads.create', nombre: 'Crear Leads', module: 'leads', vertical_id: VERTICALS.TASKS_LEADS },
    { key: 'tasksleads.leads.edit', nombre: 'Editar Leads', module: 'leads', vertical_id: VERTICALS.TASKS_LEADS },
    { key: 'tasksleads.leads.close', nombre: 'Cerrar Leads', module: 'leads', vertical_id: VERTICALS.TASKS_LEADS },

    // Timeline
    { key: 'tasksleads.timeline.view', nombre: 'Ver Timeline', module: 'timeline', vertical_id: VERTICALS.TASKS_LEADS },
    { key: 'tasksleads.timeline.sync', nombre: 'Sincronizar Timeline', module: 'timeline', vertical_id: VERTICALS.TASKS_LEADS }
];

const ROLES = [
    {
        nombre: 'SUPER_ADMIN',
        display_name: 'Super Administrador',
        is_system: true,
        level: 0,
        // Super Admin gets everything by default via implementation, but we can list explicit ones
        permissions: PERMISSIONS.map(p => p.key)
    },
    {
        nombre: 'TENANT_ADMIN', // Admin del Taller / Empresa Principal
        display_name: 'Administrador',
        is_system: true,
        level: 10,
        permissions: PERMISSIONS.map(p => p.key) // Full access to tenant stuff
    },
    {
        nombre: 'ADMINISTRADOR', // Alias for TENANT_ADMIN commonly used in legacy
        display_name: 'Administrador (Legacy)',
        is_system: true,
        level: 10,
        permissions: PERMISSIONS.map(p => p.key) // Full access
    },
    {
        nombre: 'ACCOUNTING', // Rol especializado para contables
        display_name: 'Contable',
        is_system: true,
        level: 60,
        permissions: [
            'contabilidad.read',
            'contabilidad.dashboard.read',
            'contabilidad.factura.read',
            'contabilidad.documento.read',
            'contabilidad.gasto.write',
            'contabilidad.write',
            'contabilidad.approve',
            'contabilidad.export',
            'contabilidad.empresa.read',
            'contabilidad.empresa.write',
            'contabilidad.tesoreria.read',
            'contabilidad.tesoreria.write',
            'contabilidad.deducible.approve',
            'contabilidad.trimestre.read',
            'contabilidad.config.read',
            'copiloto.read'
        ]
    },
    {
        nombre: 'empresa_lector', // Rol básico para invitados (Fallback)
        display_name: 'Lector Empresa',
        is_system: true,
        level: 99,
        permissions: [
            'contabilidad.read',
            'contabilidad.empresa.read',
            'clientes.read',
            'vehiculos.read',
            'copiloto.read'
        ]
    },
    // Nuevos roles específicos
    {
        nombre: 'MECANICO',
        display_name: 'Mecánico',
        is_system: true,
        level: 50,
        permissions: [
            'vehiculos.read', 'vehiculos.write',
            'clientes.read'
        ]
    },
    {
        nombre: 'VENDEDOR',
        display_name: 'Vendedor',
        is_system: true,
        level: 50,
        permissions: [
            'clientes.read', 'clientes.write',
            'vehiculos.read',
            'ventas.read', 'ventas.write'
        ]
    },
    {
        nombre: 'MANAGER_FINSAAS',
        display_name: 'Manager de Operaciones',
        is_system: true,
        level: 30, // Higher than accounting, lower than admin
        permissions: [
            // General
            'contabilidad.read',
            'contabilidad.dashboard.read',
            'contabilidad.factura.read',
            'contabilidad.documento.read',
            'contabilidad.gasto.write',
            'contabilidad.write',
            'contabilidad.approve',
            'contabilidad.export',
            'contabilidad.empresa.read',
            'contabilidad.empresa.write',
            'contabilidad.tesoreria.read',
            'contabilidad.tesoreria.write',
            'contabilidad.trimestre.read',
            'contabilidad.config.read',
            'copiloto.read',
            'copiloto.write',
            'clientes.read',
            'clientes.write',
            'vehiculos.read'
            // EXCLUDED per user request:
            // 'contabilidad.deducible.approve' -> Validación Deducible
            // 'finsaas.invites.manage'        -> Usuarios e Invitaciones
            // 'finsaas.rbac.manage'           -> Permisos y Roles
        ]
    },
    // =================================================================
    // TASKS & LEADS ROLES
    // =================================================================
    {
        nombre: 'TASKSLEADS_ADMIN',
        display_name: 'Admin Tasks & Leads',
        is_system: true,
        level: 20,
        permissions: [
            'tasksleads.projects.view', 'tasksleads.projects.create', 'tasksleads.projects.edit', 'tasksleads.projects.delete',
            'tasksleads.tasks.view', 'tasksleads.tasks.create', 'tasksleads.tasks.edit', 'tasksleads.tasks.delete',
            'tasksleads.leads.view', 'tasksleads.leads.create', 'tasksleads.leads.edit', 'tasksleads.leads.close',
            'tasksleads.timeline.view', 'tasksleads.timeline.sync'
        ]
    },
    {
        nombre: 'TASKSLEADS_STAFF',
        display_name: 'Staff Tasks & Leads',
        is_system: true,
        level: 50,
        permissions: [
            'tasksleads.projects.view',
            'tasksleads.tasks.view', 'tasksleads.tasks.create', 'tasksleads.tasks.edit',
            'tasksleads.leads.view', 'tasksleads.leads.create', 'tasksleads.leads.edit',
            'tasksleads.timeline.view'
        ]
    },
    {
        nombre: 'TASKSLEADS_VIEWER',
        display_name: 'Solo Lectura Tasks & Leads',
        is_system: true,
        level: 90,
        permissions: [
            'tasksleads.projects.view',
            'tasksleads.tasks.view',
            'tasksleads.leads.view',
            'tasksleads.timeline.view'
        ]
    }
];

module.exports = {
    VERTICALS,
    PERMISSIONS,
    ROLES
};
