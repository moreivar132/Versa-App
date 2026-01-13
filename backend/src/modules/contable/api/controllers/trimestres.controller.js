/**
 * Trimestres Controller
 * Gestión de cierres trimestrales
 */

const service = require('../../application/services/contabilidad.service');
const { getEffectiveTenant } = require('../../../../middleware/rbac');

/**
 * GET /api/contabilidad/trimestres
 */
async function list(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const filters = {
            anio: req.query.anio ? parseInt(req.query.anio) : null
        };

        const trimestres = await service.listTrimestres(tenantId, filters);

        // Añadir trimestres del año actual si no existen
        const currentYear = new Date().getFullYear();
        const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
        const result = [];

        for (let q = 1; q <= 4; q++) {
            const existing = trimestres.find(t => t.anio === currentYear && t.trimestre === q);
            if (existing) {
                result.push(existing);
            } else {
                // Trimestre virtual (no cerrado aún)
                result.push({
                    id: null,
                    id_tenant: tenantId,
                    anio: currentYear,
                    trimestre: q,
                    estado: 'ABIERTO',
                    base_ingresos: null,
                    iva_repercutido: null,
                    base_gastos: null,
                    iva_soportado: null,
                    resultado_iva: null,
                    closed_at: null,
                    is_current: q === currentQuarter
                });
            }
        }

        res.json({
            ok: true,
            data: result.sort((a, b) => b.trimestre - a.trimestre),
            historico: trimestres.filter(t => t.anio < currentYear)
        });
    } catch (error) {
        console.error('Error en list trimestres:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * GET /api/contabilidad/trimestres/:anio/:q
 */
async function getByPeriod(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const anio = parseInt(req.params.anio);
        const trimestre = parseInt(req.params.q);

        if (trimestre < 1 || trimestre > 4) {
            return res.status(400).json({ ok: false, error: 'Trimestre inválido (1-4)' });
        }

        const data = await service.getTrimestre(tenantId, anio, trimestre);

        res.json({
            ok: true,
            data
        });
    } catch (error) {
        console.error('Error en getByPeriod trimestre:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * POST /api/contabilidad/trimestres/:anio/:q/cerrar
 */
async function cerrar(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const anio = parseInt(req.params.anio);
        const trimestre = parseInt(req.params.q);
        const userId = req.user?.id;

        if (trimestre < 1 || trimestre > 4) {
            return res.status(400).json({ ok: false, error: 'Trimestre inválido (1-4)' });
        }

        const result = await service.cerrarTrimestre(tenantId, anio, trimestre, userId);

        res.json({
            ok: true,
            data: result,
            message: `Trimestre Q${trimestre} ${anio} cerrado correctamente`
        });
    } catch (error) {
        console.error('Error en cerrar trimestre:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * POST /api/contabilidad/trimestres/:anio/:q/reabrir
 */
async function reabrir(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const anio = parseInt(req.params.anio);
        const trimestre = parseInt(req.params.q);
        const userId = req.user?.id;
        const reason = req.body.reason || 'Reabierto por administrador';

        if (trimestre < 1 || trimestre > 4) {
            return res.status(400).json({ ok: false, error: 'Trimestre inválido (1-4)' });
        }

        const result = await service.reabrirTrimestre(tenantId, anio, trimestre, reason, userId);

        res.json({
            ok: true,
            data: result,
            message: `Trimestre Q${trimestre} ${anio} reabierto`
        });
    } catch (error) {
        console.error('Error en reabrir trimestre:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

module.exports = {
    list,
    getByPeriod,
    cerrar,
    reabrir
};
