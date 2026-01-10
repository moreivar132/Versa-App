/**
 * VERSA - KPI Registry Service
 * 
 * Fuente única de verdad para definiciones de KPIs del dashboard.
 * Incluye metadatos, tooltips, colores, y configuración por rol.
 */

// =====================================================
// Definiciones de KPIs
// =====================================================

export const KPI_SECTIONS = {
    resumen: {
        id: 'resumen',
        title: 'Resumen Financiero',
        description: 'Métricas principales de ingresos, egresos y rentabilidad',
        icon: 'account_balance_wallet',
        defaultExpanded: true,
        order: 0
    },
    taller: {
        id: 'taller',
        title: 'Taller',
        description: 'Ingresos y operaciones del servicio de taller',
        icon: 'build',
        defaultExpanded: true,
        order: 1
    },
    marketplace: {
        id: 'marketplace',
        title: 'Marketplace',
        description: 'Reservas online y pagos vía Stripe',
        icon: 'storefront',
        defaultExpanded: true,
        order: 2
    },
    operacion: {
        id: 'operacion',
        title: 'Operación',
        description: 'Métricas operativas y alertas',
        icon: 'pending_actions',
        defaultExpanded: false,
        order: 3
    }
};

export const BADGE_COLORS = {
    global: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af', border: 'rgba(156, 163, 175, 0.3)' },
    taller: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' },
    marketplace: { bg: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4', border: 'rgba(6, 182, 212, 0.3)' },
    ledger: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: 'rgba(34, 197, 94, 0.3)' }
};

export const KPI_COLORS = {
    green: { main: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', hover: 'rgb(34, 197, 94)' },
    red: { main: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', hover: 'rgb(239, 68, 68)' },
    orange: { main: '#ff5f00', bg: 'rgba(255, 95, 0, 0.1)', hover: 'rgb(255, 95, 0)' },
    blue: { main: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', hover: 'rgb(59, 130, 246)' },
    amber: { main: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', hover: 'rgb(245, 158, 11)' },
    cyan: { main: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', hover: 'rgb(6, 182, 212)' },
    yellow: { main: '#eab308', bg: 'rgba(234, 179, 8, 0.1)', hover: 'rgb(234, 179, 8)' },
    indigo: { main: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)', hover: 'rgb(99, 102, 241)' },
    purple: { main: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', hover: 'rgb(168, 85, 247)' }
};

export const KPI_DEFINITIONS = [
    // === RESUMEN FINANCIERO (Hero) ===
    {
        id: 'ingresos_global',
        label: 'Ingresos',
        description: 'Total de ingresos de todas las fuentes',
        format: 'currency',
        section: 'resumen',
        weight: 'hero',
        badge_origin: 'global',
        icon: 'payments',
        color: 'green',
        default_visible_by_role: { super_admin: true, admin: true, contable: true, mecanico: true },
        drilldown: null,
        tooltip: {
            definition: 'Suma total de ingresos del período seleccionado',
            formula: 'Órdenes + Ventas (excluye anuladas)',
            source: 'Global (Taller + Ventas)',
            exclusion: null
        }
    },
    {
        id: 'egresos_global',
        label: 'Egresos',
        description: 'Total de gastos y compras',
        format: 'currency',
        section: 'resumen',
        weight: 'hero',
        badge_origin: 'global',
        icon: 'shopping_cart',
        color: 'red',
        default_visible_by_role: { super_admin: true, admin: true, contable: true, mecanico: false },
        drilldown: 'manager-taller-compras-historial.html',
        tooltip: {
            definition: 'Suma total de gastos del período',
            formula: 'SUM(compras.total)',
            source: 'Módulo Compras',
            exclusion: null
        }
    },
    {
        id: 'beneficio',
        label: 'Beneficio',
        description: 'Ingresos menos egresos',
        format: 'currency',
        section: 'resumen',
        weight: 'hero',
        badge_origin: 'global',
        icon: 'account_balance_wallet',
        color: 'orange',
        default_visible_by_role: { super_admin: true, admin: true, contable: true, mecanico: true },
        drilldown: null,
        tooltip: {
            definition: 'Diferencia entre ingresos y egresos',
            formula: 'Ingresos - Egresos',
            source: 'Calculado',
            exclusion: null
        }
    },
    {
        id: 'margen_global',
        label: 'Margen Global',
        description: 'Porcentaje de beneficio sobre ingresos',
        format: 'percent',
        section: 'resumen',
        weight: 'hero',
        badge_origin: 'global',
        icon: 'percent',
        color: 'blue',
        default_visible_by_role: { super_admin: true, admin: true, contable: true, mecanico: false },
        drilldown: null,
        tooltip: {
            definition: 'Porcentaje de ganancia sobre ingresos',
            formula: '(Beneficio / Ingresos) × 100',
            source: 'Calculado',
            exclusion: null
        }
    },

    // === TALLER (Standard) ===
    {
        id: 'ingresos_taller',
        label: 'Ingresos Taller',
        description: 'Ingresos exclusivos del taller',
        format: 'currency',
        section: 'taller',
        weight: 'standard',
        badge_origin: 'taller',
        icon: 'point_of_sale',
        color: 'amber',
        default_visible_by_role: { super_admin: true, admin: true, contable: true, mecanico: true },
        drilldown: 'manager-taller-ordenes-lista.html',
        tooltip: {
            definition: 'Ingresos generados por servicios del taller',
            formula: 'SUM(income_event) WHERE origen = taller',
            source: 'Módulo Taller (Ledger)',
            exclusion: 'No incluye Marketplace'
        }
    },

    // === MARKETPLACE (Standard) ===
    {
        id: 'ingresos_marketplace',
        label: 'Marketplace',
        description: 'Ingresos por reservas online',
        format: 'currency',
        section: 'marketplace',
        weight: 'standard',
        badge_origin: 'marketplace',
        icon: 'storefront',
        color: 'cyan',
        default_visible_by_role: { super_admin: true, admin: true, contable: true, mecanico: false },
        drilldown: 'manager-taller-marketplace.html',
        tooltip: {
            definition: 'Pagos recibidos por reservas del Marketplace',
            formula: 'SUM(income_event) WHERE origen = marketplace',
            source: 'Módulo Marketplace (Stripe)',
            exclusion: 'Solo pagos confirmados vía Stripe'
        }
    },
    {
        id: 'total_ledger',
        label: 'Total Ledger',
        description: 'Suma de ingresos confirmados del ledger',
        format: 'currency',
        section: 'marketplace',
        weight: 'standard',
        badge_origin: 'ledger',
        icon: 'account_balance',
        color: 'green',
        default_visible_by_role: { super_admin: true, admin: true, contable: true, mecanico: false },
        drilldown: null,
        tooltip: {
            definition: 'Suma de ingresos confirmados desde el ledger centralizado',
            formula: 'Marketplace + Taller (ledger)',
            source: 'Income Event Ledger',
            exclusion: null
        }
    },

    // === OPERACIÓN (Compact) ===
    {
        id: 'ticket_medio',
        label: 'Ticket Medio',
        description: 'Valor promedio por transacción',
        format: 'currency',
        section: 'operacion',
        weight: 'compact',
        badge_origin: 'global',
        icon: 'receipt_long',
        color: 'yellow',
        default_visible_by_role: { super_admin: true, admin: true, contable: true, mecanico: false },
        drilldown: null,
        tooltip: {
            definition: 'Promedio de ingresos por transacción',
            formula: 'Ingresos / (Órdenes + Ventas)',
            source: 'Calculado',
            exclusion: null
        }
    },
    {
        id: 'ordenes_abiertas',
        label: 'Órdenes Abiertas',
        description: 'Órdenes actualmente en progreso',
        format: 'integer',
        section: 'operacion',
        weight: 'compact',
        badge_origin: 'taller',
        icon: 'pending_actions',
        color: 'blue',
        default_visible_by_role: { super_admin: true, admin: true, contable: false, mecanico: true },
        drilldown: 'manager-taller-ordenes-lista.html?estado=EN_PROGRESO',
        tooltip: {
            definition: 'Órdenes en estado activo/en progreso',
            formula: 'COUNT(ordenes) WHERE estado = EN_PROGRESO',
            source: 'Módulo Taller',
            exclusion: null
        }
    },
    {
        id: 'listas_entregar',
        label: 'Listas x Entregar',
        description: 'Órdenes completadas pendientes de entrega',
        format: 'integer',
        section: 'operacion',
        weight: 'compact',
        badge_origin: 'taller',
        icon: 'local_shipping',
        color: 'indigo',
        default_visible_by_role: { super_admin: true, admin: true, contable: false, mecanico: true },
        drilldown: 'manager-taller-ordenes-lista.html?estado=COMPLETADA',
        tooltip: {
            definition: 'Órdenes listas para entregar al cliente',
            formula: 'COUNT(ordenes) WHERE estado = COMPLETADA',
            source: 'Módulo Taller',
            exclusion: null
        }
    },
    {
        id: 'stock_bajo',
        label: 'Stock Bajo',
        description: 'Productos con stock bajo mínimo',
        format: 'integer',
        section: 'operacion',
        weight: 'compact',
        badge_origin: 'global',
        icon: 'warning',
        color: 'red',
        default_visible_by_role: { super_admin: true, admin: true, contable: false, mecanico: true },
        drilldown: 'manager-taller-inventario.html?stock_bajo=1',
        tooltip: {
            definition: 'Productos con stock igual o menor al mínimo',
            formula: 'COUNT(productos) WHERE stock <= stock_minimo',
            source: 'Módulo Inventario',
            exclusion: null
        }
    },
    {
        id: 'cliente_top',
        label: 'Cliente Top',
        description: 'Cliente con más órdenes en el período',
        format: 'text',
        section: 'operacion',
        weight: 'compact',
        badge_origin: 'taller',
        icon: 'star',
        color: 'purple',
        default_visible_by_role: { super_admin: true, admin: true, contable: false, mecanico: false },
        drilldown: 'manager-taller-clientes.html',
        tooltip: {
            definition: 'Cliente con mayor actividad en el período',
            formula: 'Cliente con MAX(órdenes)',
            source: 'Módulo Taller',
            exclusion: null
        }
    }
];

// =====================================================
// Helpers
// =====================================================

/**
 * Obtener KPI por ID
 */
export function getKpiById(id) {
    return KPI_DEFINITIONS.find(k => k.id === id) || null;
}

/**
 * Obtener KPIs por sección
 */
export function getKpisBySection(sectionId) {
    return KPI_DEFINITIONS.filter(k => k.section === sectionId);
}

/**
 * Obtener KPIs por peso/variante
 */
export function getKpisByWeight(weight) {
    return KPI_DEFINITIONS.filter(k => k.weight === weight);
}

/**
 * Obtener visibilidad por defecto para un rol
 */
export function getDefaultVisibleKpis(role = 'admin') {
    return KPI_DEFINITIONS
        .filter(k => k.default_visible_by_role[role] === true)
        .map(k => k.id);
}

/**
 * Obtener todas las secciones ordenadas
 */
export function getSortedSections() {
    return Object.values(KPI_SECTIONS).sort((a, b) => a.order - b.order);
}

/**
 * Formatear valor según el format del KPI
 */
export function formatKpiValue(value, format) {
    if (value === null || value === undefined) return '—';

    switch (format) {
        case 'currency':
            return new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: 'EUR'
            }).format(value);
        case 'percent':
            return `${Number(value).toFixed(1)}%`;
        case 'integer':
            return Math.round(value).toString();
        case 'text':
        default:
            return String(value);
    }
}

/**
 * Obtener color para un KPI
 */
export function getKpiColor(colorName) {
    return KPI_COLORS[colorName] || KPI_COLORS.blue;
}

/**
 * Obtener color del badge de origen
 */
export function getBadgeColor(origin) {
    return BADGE_COLORS[origin] || BADGE_COLORS.global;
}

/**
 * Obtener label para el badge de origen
 */
export function getBadgeLabel(origin) {
    const labels = {
        global: 'Global',
        taller: 'Taller',
        marketplace: 'Marketplace',
        ledger: 'Ledger'
    };
    return labels[origin] || 'Global';
}
