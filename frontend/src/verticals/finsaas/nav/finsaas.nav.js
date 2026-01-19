/**
 * FinSaaS Navigation Manifest
 * Central source of truth for the Sidebar
 * 
 * Items with requiredPermission will only show to users with that permission
 */
export const finSaaSNav = [
    {
        id: 'overview',
        label: 'Overview',
        type: 'section'
    },
    {
        id: 'dashboard',
        label: 'Dashboard',
        route: '/src/verticals/finsaas/pages/dashboard.html',
        icon: 'dashboard',
        order: 1
    },
    {
        id: 'copiloto-ia',
        label: 'Copiloto IA',
        route: '/src/verticals/finsaas/pages/copiloto-resumen.html',
        icon: 'psychology',
        order: 1.5,
        badge: 'IA'
    },
    {
        id: 'operaciones',
        label: 'Operaciones',
        type: 'section'
    },
    {
        id: 'facturas',
        label: 'Facturas',
        route: '/src/verticals/finsaas/pages/facturas.html',
        icon: 'description',
        order: 2
    },
    {
        id: 'documentos',
        label: 'Biblioteca',
        route: '/src/verticals/finsaas/pages/documentos.html',
        icon: 'folder_open',
        order: 2.3
    },
    {
        id: 'gastos-ocr',
        label: 'Subir Gasto (IA)',
        route: '/src/verticals/finsaas/pages/gastos-nuevo.html',
        icon: 'upload_file',
        order: 2.5
    },
    {
        id: 'caja',
        label: 'Caja',
        route: '/src/verticals/finsaas/pages/caja.html',
        icon: 'payments',
        order: 3
    },
    {
        id: 'contactos',
        label: 'Contactos',
        route: '/src/verticals/finsaas/pages/contactos.html',
        icon: 'contacts',
        order: 4
    },
    {
        id: 'empresas',
        label: 'Empresas',
        route: '/src/verticals/finsaas/pages/empresas.html',
        icon: 'business',
        order: 5
    },
    {
        id: 'fiscalidad',
        label: 'Fiscalidad',
        type: 'section'
    },
    {
        id: 'trimestres',
        label: 'Trimestres',
        route: '/src/verticals/finsaas/pages/trimestres.html',
        icon: 'date_range',
        order: 6
    },
    {
        id: 'validacion-deducible',
        label: 'Validación Deducible',
        route: '/src/verticals/finsaas/pages/validacion-deducible.html',
        icon: 'fact_check',
        order: 6.5,
        requiredPermission: 'finsaas.deducible.manage'  // TENANT_ADMIN only
    },
    {
        id: 'admin',
        label: 'Administración',
        type: 'section',
        requiredPermission: 'finsaas.invites.manage'  // Only show section if user has any admin permission
    },
    {
        id: 'usuarios',
        label: 'Usuarios e Invitaciones',
        route: '/src/verticals/finsaas/pages/usuarios.html',
        icon: 'group_add',
        order: 6.6,
        requiredPermission: 'finsaas.invites.manage'  // TENANT_ADMIN only
    },
    {
        id: 'permisos',
        label: 'Permisos y Roles',
        route: '/src/verticals/finsaas/pages/permisos.html',
        icon: 'admin_panel_settings',
        order: 6.7,
        requiredPermission: 'finsaas.rbac.manage'  // TENANT_ADMIN only
    },
    {
        id: 'tools',
        label: 'Herramientas',
        type: 'section'
    },
    {
        id: 'config-factura',
        label: 'Configuración Factura',
        route: '/src/verticals/finsaas/pages/configuracion-factura.html',
        icon: 'tune',
        order: 7
    },
    {
        id: 'taller',
        label: 'Volver al Taller',
        route: '/manager-taller-inicio.html',
        icon: 'warehouse',
        order: 99,
        external: true // O fuera del router de finsaas
    }
];

