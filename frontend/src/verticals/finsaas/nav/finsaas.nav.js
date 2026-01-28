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
        order: 1,
        requiredPermission: 'contabilidad.dashboard.read'
    },
    {
        id: 'copiloto-ia',
        label: 'Copiloto IA',
        route: '/src/verticals/finsaas/pages/copiloto-resumen.html',
        icon: 'psychology',
        order: 1.5,
        badge: 'IA',
        requiredPermission: 'copiloto.read'
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
        order: 2,
        requiredPermission: 'contabilidad.factura.read'
    },
    {
        id: 'documentos',
        label: 'Biblioteca',
        route: '/src/verticals/finsaas/pages/documentos.html',
        icon: 'folder_open',
        order: 2.3,
        requiredPermission: 'contabilidad.documento.read'
    },
    {
        id: 'gastos-ocr',
        label: 'Subir Gasto (IA)',
        route: '/src/verticals/finsaas/pages/gastos-nuevo.html',
        icon: 'upload_file',
        order: 2.5,
        requiredPermission: 'contabilidad.gasto.write'
    },
    {
        id: 'caja',
        label: 'Caja',
        route: '/src/verticals/finsaas/pages/caja.html',
        icon: 'payments',
        order: 3,
        requiredPermission: 'contabilidad.tesoreria.read'
    },
    {
        id: 'bancos',
        label: 'Bancos',
        route: '/src/verticals/finsaas/pages/bancos.html',
        icon: 'account_balance',
        order: 3.5,
        requiredPermission: 'contabilidad.tesoreria.read'
    },
    {
        id: 'contactos',
        label: 'Contactos',
        route: '/src/verticals/finsaas/pages/contactos.html',
        icon: 'contacts',
        order: 4,
        requiredPermission: 'contabilidad.read'
    },
    {
        id: 'empresas',
        label: 'Empresas',
        route: '/src/verticals/finsaas/pages/empresas.html',
        icon: 'business',
        order: 5,
        requiredPermission: 'contabilidad.empresa.read'
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
        order: 6,
        requiredPermission: 'contabilidad.trimestre.read'
    },
    {
        id: 'validacion-deducible',
        label: 'Validación Deducible',
        route: '/src/verticals/finsaas/pages/validacion-deducible.html',
        icon: 'fact_check',
        order: 6.5,
        requiredPermission: 'contabilidad.deducible.approve'
    },
    {
        id: 'admin',
        label: 'Administración',
        type: 'section',
        requiredPermission: 'finsaas.invites.manage'
    },
    {
        id: 'usuarios',
        label: 'Usuarios e Invitaciones',
        route: '/src/verticals/finsaas/pages/usuarios.html',
        icon: 'group_add',
        order: 6.6,
        requiredPermission: 'finsaas.invites.manage'
    },
    {
        id: 'permisos',
        label: 'Permisos y Roles',
        route: '/src/verticals/finsaas/pages/permisos.html',
        icon: 'admin_panel_settings',
        order: 6.7,
        requiredPermission: 'finsaas.rbac.manage'
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
        order: 7,
        requiredPermission: 'contabilidad.config.read'
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

