/**
 * VERSA - Dashboard Preferences API Routes
 * 
 * Endpoints para gestionar preferencias del dashboard por usuario
 * GET  /api/dashboard/prefs - Obtener preferencias
 * POST /api/dashboard/prefs - Guardar/actualizar preferencias
 */

const express = require('express');
const router = express.Router();

const { authorize } = require('../middleware/rbac');

// =====================================================
// KPI Defaults por rol
// =====================================================
const DEFAULT_KPIS_BY_ROLE = {
    super_admin: {
        visible_kpis: [
            'ingresos_global', 'egresos_global', 'beneficio', 'margen_global',
            'ingresos_taller', 'ingresos_marketplace', 'total_ledger',
            'ticket_medio', 'ordenes_abiertas', 'listas_entregar', 'stock_bajo', 'cliente_top'
        ],
        density: 'normal',
        collapsed_sections: [],
        legend_mode: 'chips'
    },
    admin: {
        visible_kpis: [
            'ingresos_global', 'egresos_global', 'beneficio', 'margen_global',
            'ingresos_taller', 'ingresos_marketplace', 'total_ledger',
            'ticket_medio', 'ordenes_abiertas', 'listas_entregar', 'stock_bajo', 'cliente_top'
        ],
        density: 'normal',
        collapsed_sections: [],
        legend_mode: 'chips'
    },
    contable: {
        visible_kpis: [
            'ingresos_global', 'egresos_global', 'beneficio', 'margen_global',
            'ingresos_taller', 'ingresos_marketplace', 'total_ledger',
            'ticket_medio'
        ],
        density: 'normal',
        collapsed_sections: ['operacion'],
        legend_mode: 'chips'
    },
    mecanico: {
        visible_kpis: [
            'ingresos_global', 'beneficio',
            'ingresos_taller',
            'ordenes_abiertas', 'listas_entregar', 'stock_bajo'
        ],
        density: 'compacto',
        collapsed_sections: ['marketplace'],
        legend_mode: 'popover'
    }
};

/**
 * GET /api/dashboard/prefs
 * Obtener preferencias del dashboard para el usuario actual
 * 
 * Query params:
 * - page_key: string (default: 'home_dashboard')
 * - branch_id: number (opcional, para preferencias específicas de sucursal)
 */
router.get('/prefs', authorize(), async (req, res) => {
    try {
        const { page_key = 'home_dashboard', branch_id } = req.query;
        const userId = req.user.id;
        const tenantId = req.user.id_tenant;
        const userRole = req.user.rol || 'admin';

        // Buscar preferencias guardadas
        let query, params;

        if (branch_id) {
            // Buscar preferencias específicas de sucursal
            query = `
                SELECT prefs_json, updated_at
                FROM user_dashboard_prefs
                WHERE id_tenant = $1 AND id_user = $2 AND page_key = $3 AND id_sucursal = $4
            `;
            params = [tenantId, userId, page_key, branch_id];
        } else {
            // Buscar preferencias globales del usuario (sin sucursal específica)
            query = `
                SELECT prefs_json, updated_at
                FROM user_dashboard_prefs
                WHERE id_tenant = $1 AND id_user = $2 AND page_key = $3 AND id_sucursal IS NULL
            `;
            params = [tenantId, userId, page_key];
        }

        const result = await req.db.query(query, params);

        if (result.rows.length > 0) {
            // Devolver preferencias guardadas
            return res.json({
                success: true,
                source: 'database',
                prefs: result.rows[0].prefs_json,
                updated_at: result.rows[0].updated_at
            });
        }

        // No hay preferencias guardadas, devolver defaults según rol
        const roleDefaults = DEFAULT_KPIS_BY_ROLE[userRole] || DEFAULT_KPIS_BY_ROLE.admin;

        return res.json({
            success: true,
            source: 'defaults',
            prefs: roleDefaults,
            role: userRole
        });

    } catch (error) {
        console.error('Error obteniendo preferencias dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * POST /api/dashboard/prefs
 * Guardar/actualizar preferencias del dashboard
 * 
 * Body:
 * - page_key: string (default: 'home_dashboard')  
 * - branch_id: number (opcional)
 * - prefs_json: object con las preferencias
 */
router.post('/prefs', authorize(), async (req, res) => {
    try {
        const {
            page_key = 'home_dashboard',
            branch_id = null,
            prefs_json
        } = req.body;

        const userId = req.user.id;
        const tenantId = req.user.id_tenant;

        if (!prefs_json || typeof prefs_json !== 'object') {
            return res.status(400).json({
                success: false,
                error: 'prefs_json es requerido y debe ser un objeto'
            });
        }

        // Validar estructura de prefs_json
        const validKeys = ['visible_kpis', 'order', 'density', 'collapsed_sections', 'legend_mode'];
        const prefsToSave = {};

        for (const key of validKeys) {
            if (prefs_json[key] !== undefined) {
                prefsToSave[key] = prefs_json[key];
            }
        }

        // Validar valores específicos
        if (prefsToSave.density && !['compacto', 'normal'].includes(prefsToSave.density)) {
            return res.status(400).json({
                success: false,
                error: 'density debe ser "compacto" o "normal"'
            });
        }

        if (prefsToSave.legend_mode && !['chips', 'popover'].includes(prefsToSave.legend_mode)) {
            return res.status(400).json({
                success: false,
                error: 'legend_mode debe ser "chips" o "popover"'
            });
        }

        // UPSERT de preferencias
        const query = `
            INSERT INTO user_dashboard_prefs (id_tenant, id_user, id_sucursal, page_key, prefs_json)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id_tenant, id_user, id_sucursal, page_key)
            DO UPDATE SET 
                prefs_json = user_dashboard_prefs.prefs_json || $5,
                updated_at = now()
            RETURNING id, prefs_json, updated_at
        `;

        const result = await req.db.query(query, [
            tenantId,
            userId,
            branch_id,
            page_key,
            JSON.stringify(prefsToSave)
        ]);

        res.json({
            success: true,
            message: 'Preferencias guardadas',
            prefs: result.rows[0].prefs_json,
            updated_at: result.rows[0].updated_at
        });

    } catch (error) {
        console.error('Error guardando preferencias dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * DELETE /api/dashboard/prefs
 * Resetear preferencias a defaults del rol
 * 
 * Query params:
 * - page_key: string
 * - branch_id: number (opcional)
 */
router.delete('/prefs', authorize(), async (req, res) => {
    try {
        const { page_key = 'home_dashboard', branch_id } = req.query;
        const userId = req.user.id;
        const tenantId = req.user.id_tenant;
        const userRole = req.user.rol || 'admin';

        let query, params;

        if (branch_id) {
            query = `
                DELETE FROM user_dashboard_prefs
                WHERE id_tenant = $1 AND id_user = $2 AND page_key = $3 AND id_sucursal = $4
            `;
            params = [tenantId, userId, page_key, branch_id];
        } else {
            query = `
                DELETE FROM user_dashboard_prefs
                WHERE id_tenant = $1 AND id_user = $2 AND page_key = $3 AND id_sucursal IS NULL
            `;
            params = [tenantId, userId, page_key];
        }

        await req.db.query(query, params);

        // Devolver los defaults del rol
        const roleDefaults = DEFAULT_KPIS_BY_ROLE[userRole] || DEFAULT_KPIS_BY_ROLE.admin;

        res.json({
            success: true,
            message: 'Preferencias reseteadas a defaults',
            prefs: roleDefaults,
            role: userRole
        });

    } catch (error) {
        console.error('Error reseteando preferencias dashboard:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

/**
 * GET /api/dashboard/kpi-definitions
 * Devuelve el registro de definiciones de KPIs disponibles
 */
router.get('/kpi-definitions', authorize(), async (req, res) => {
    try {
        const userRole = req.user.rol || 'admin';

        // Devolver las definiciones de KPIs con visibilidad por rol
        const kpiDefinitions = getKpiDefinitions();

        // Marcar cuáles son visibles por defecto para este rol
        const kpisWithDefaults = kpiDefinitions.map(kpi => ({
            ...kpi,
            default_visible: kpi.default_visible_by_role[userRole] ?? true
        }));

        res.json({
            success: true,
            definitions: kpisWithDefaults,
            role: userRole
        });

    } catch (error) {
        console.error('Error obteniendo definiciones KPI:', error);
        res.status(500).json({
            success: false,
            error: 'Error interno del servidor'
        });
    }
});

// =====================================================
// KPI Definitions Registry
// =====================================================
function getKpiDefinitions() {
    return [
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
                exclusion: 'No incluye Marketplace ni ventas directas'
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
}

module.exports = router;
