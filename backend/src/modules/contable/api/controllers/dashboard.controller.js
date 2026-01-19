/**
 * Dashboard Controller
 * Endpoints para dashboard y reportes contables
 */

const service = require('../../application/services/contabilidad.service');
const { getEffectiveTenant } = require('../../../../../middleware/rbac');

/**
 * Helper para obtener empresa ID del context
 */
function getEmpresaId(req) {
    const val = req.headers['x-empresa-id'] || req.query.empresaId || req.empresaId;
    return val === '' ? null : val;
}

/**
 * GET /api/contabilidad/dashboard
 * Obtiene KPIs del dashboard
 */
async function getDashboard(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        // Obtener año y trimestre actuales o de params
        const now = new Date();
        const anio = parseInt(req.query.anio) || now.getFullYear();
        const trimestre = parseInt(req.query.trimestre) || Math.ceil((now.getMonth() + 1) / 3);

        const empresaId = getEmpresaId(req);

        // If no empresa specified, return empty/default KPIs
        if (!empresaId) {
            return res.json({
                ok: true,
                data: {
                    iva_trimestre: { resultado: 0, repercutido: 0, soportado: 0 },
                    pendiente_cobrar: { total: 0, count: 0 },
                    pendiente_pagar: { total: 0, count: 0 },
                    vencidas: { count: 0, total: 0 },
                    ingreso_mensual: 0,
                    gasto_mensual: 0,
                    saldo_caja: 0,
                    periodo: { anio, trimestre }
                }
            });
        }

        const kpis = await service.getDashboard({ tenantId }, empresaId, anio, trimestre);

        res.json({
            ok: true,
            data: {
                ...kpis,
                periodo: { anio, trimestre }
            }
        });
    } catch (error) {
        console.error('Error en getDashboard:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * GET /api/contabilidad/reports/iva
 * Reporte IVA por período
 */
async function getReporteIVA(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const now = new Date();
        const anio = parseInt(req.query.anio) || now.getFullYear();
        const trimestre = parseInt(req.query.trimestre) || Math.ceil((now.getMonth() + 1) / 3);

        const empresaId = getEmpresaId(req);
        if (!empresaId) {
            return res.json({
                ok: true,
                data: {
                    ingresos: { base: 0, iva: 0 },
                    gastos: { base: 0, iva: 0 },
                    iva_repercutido: 0,
                    iva_soportado: 0,
                    resultado: 0
                }
            });
        }

        const reporte = await service.getReporteIVA({ tenantId }, empresaId, anio, trimestre);

        res.json({
            ok: true,
            data: reporte
        });
    } catch (error) {
        console.error('Error en getReporteIVA:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * GET /api/contabilidad/reports/gastos-categoria
 * Gastos agrupados por categoría
 */
async function getGastosPorCategoria(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        // Defaults: último mes
        const now = new Date();
        const fechaHasta = req.query.fechaHasta || now.toISOString().split('T')[0];
        const fechaDesde = req.query.fechaDesde || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];

        const empresaId = getEmpresaId(req);
        if (!empresaId) {
            return res.json({
                ok: true,
                data: [],
                periodo: { fechaDesde, fechaHasta }
            });
        }

        const reporte = await service.getGastosPorCategoria({ tenantId }, empresaId, fechaDesde, fechaHasta);

        res.json({
            ok: true,
            data: reporte,
            periodo: { fechaDesde, fechaHasta }
        });
    } catch (error) {
        console.error('Error en getGastosPorCategoria:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * GET /api/contabilidad/reports/evolucion
 */
async function getEvolucionFinanciera(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const empresaId = getEmpresaId(req);
        if (!empresaId) {
            return res.json({ ok: true, data: [] });
        }

        const data = await service.getEvolucionFinanciera({ tenantId }, empresaId);

        res.json({
            ok: true,
            data
        });
    } catch (error) {
        console.error('Error en getEvolucionFinanciera:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

module.exports = {
    getDashboard,
    getReporteIVA,
    getGastosPorCategoria,
    getEvolucionFinanciera
};
