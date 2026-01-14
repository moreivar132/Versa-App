/**
 * Empresa Middleware
 * Valida el contexto de empresa y los permisos de usuario
 */

const pool = require('../../../../db');
const { getEffectiveTenant } = require('../../../../middleware/rbac');

/**
 * Middleware para validar que se ha especificado una empresa
 * y que el usuario tiene acceso a ella.
 * 
 * Se espera:
 * - Header: x-empresa-id
 * - O Query param: empresaId
 */
async function requireEmpresa(req, res, next) {
    try {
        const tenantId = getEffectiveTenant(req);
        if (!tenantId) {
            return res.status(400).json({ ok: false, error: 'Tenant context required' });
        }

        const empresaId = req.headers['x-empresa-id'] || req.query.empresaId;

        if (!empresaId) {
            return res.status(400).json({
                ok: false,
                error: 'Empresa context required (x-empresa-id header or empresaId query)'
            });
        }

        // 1. Verificar existencia de la empresa en el tenant
        const empresaResult = await pool.query(
            'SELECT id, activo FROM accounting_empresa WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL',
            [empresaId, tenantId]
        );

        if (empresaResult.rows.length === 0) {
            return res.status(404).json({ ok: false, error: 'Empresa not found or access denied' });
        }

        if (!empresaResult.rows[0].activo) {
            return res.status(403).json({ ok: false, error: 'Empresa is inactive' });
        }

        // 2. Verificar permisos del usuario
        // Si es superadmin o tiene rol de admin global, pasa
        if (req.user?.es_super_admin || req.user?.rol === 'admin') {
            req.empresaId = empresaId;
            return next();
        }

        // Verificar asignación directa
        const accessResult = await pool.query(
            'SELECT rol_empresa FROM accounting_usuario_empresa WHERE id_usuario = $1 AND id_empresa = $2',
            [req.user.id, empresaId]
        );

        if (accessResult.rows.length === 0) {
            return res.status(403).json({ ok: false, error: 'User does not have access to this empresa' });
        }

        // Adjuntar contexto al request
        req.empresaId = empresaId;
        req.rolEmpresa = accessResult.rows[0].rol_empresa;

        next();
    } catch (error) {
        console.error('Empresa Middleware Error:', error);
        res.status(500).json({ ok: false, error: 'Internal Server Error validating empresa' });
    }
}

module.exports = {
    requireEmpresa
};
