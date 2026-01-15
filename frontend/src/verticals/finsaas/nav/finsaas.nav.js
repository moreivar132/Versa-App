/**
 * FinSaaS Navigation Manifest
 * Central source of truth for the Sidebar
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
