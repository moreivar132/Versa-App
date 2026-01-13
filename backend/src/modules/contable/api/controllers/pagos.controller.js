/**
 * Pagos Controller
 * Gestión de pagos de facturas
 */

const service = require('../../application/services/contabilidad.service');
const { getEffectiveTenant } = require('../../../../middleware/rbac');

/**
 * POST /api/contabilidad/facturas/:id/pagos
 */
async function registrarPago(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const facturaId = parseInt(req.params.id);
        const userId = req.user?.id;
        const data = req.body;

        // Validaciones básicas
        if (!data.fecha_pago) {
            return res.status(400).json({ ok: false, error: 'Fecha de pago requerida' });
        }

        if (!data.importe || data.importe <= 0) {
            return res.status(400).json({ ok: false, error: 'Importe de pago inválido' });
        }

        const pago = await service.registrarPago(tenantId, facturaId, data, userId);

        res.status(201).json({
            ok: true,
            data: pago,
            message: 'Pago registrado correctamente'
        });
    } catch (error) {
        console.error('Error en registrarPago:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * GET /api/contabilidad/facturas/:id/pagos
 */
async function listByFactura(req, res) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant no especificado' });
        }

        const facturaId = parseInt(req.params.id);
        const pagos = await service.listPagos(tenantId, facturaId);

        res.json({
            ok: true,
            data: pagos
        });
    } catch (error) {
        console.error('Error en listByFactura:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

/**
 * DELETE /api/contabilidad/pagos/:id
 */
async function remove(req, res) {
    try {
        const pagoId = parseInt(req.params.id);

        await service.eliminarPago(pagoId);

        res.json({
            ok: true,
            message: 'Pago eliminado correctamente'
        });
    } catch (error) {
        console.error('Error en remove pago:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message
        });
    }
}

module.exports = {
    registrarPago,
    listByFactura,
    remove
};
