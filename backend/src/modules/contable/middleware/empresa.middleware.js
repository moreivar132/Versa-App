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
        // req.ctx ya debe estar poblado por el tenantContextMiddleware previo
        const tenantId = req.ctx?.tenantId;

        if (!tenantId) {
            return res.status(403).json({
                ok: false,
                error: 'Tenant context required. Check auth and tenant-context middleware chain.',
                requestId: req.requestId
            });
        }

        const empresaId = req.headers['x-empresa-id'] || req.query.empresaId;

        if (!empresaId) {
            return res.status(400).json({
                ok: false,
                error: 'Empresa context required (x-empresa-id header or empresaId query)',
                requestId: req.requestId
            });
        }

        // Usar pool directamente para validación de infraestructura si es necesario,
        // pero idealmente pasar por getTenantDb para asegurar RLS incluso aquí.
        const empresaResult = await pool.query(
            'SELECT id, activo FROM accounting_empresa WHERE id = $1 AND id_tenant = $2 AND deleted_at IS NULL',
            [empresaId, tenantId]
        );

        if (empresaResult.rows.length === 0) {
            return res.status(404).json({
                ok: false,
                error: 'Empresa not found or access denied for this tenant',
                requestId: req.requestId
            });
        }

        if (!empresaResult.rows[0].activo) {
            return res.status(403).json({ ok: false, error: 'Empresa is inactive' });
        }

        // Asignar al contexto unificado
        req.ctx.empresaId = empresaId;

        // Verificar permisos específicos de empresa si no es superadmin
        if (!req.ctx.isSuperAdmin) {
            const accessResult = await pool.query(
                'SELECT rol_empresa FROM accounting_usuario_empresa WHERE id_usuario = $1 AND id_empresa = $2',
                [req.ctx.userId, empresaId]
            );

            if (accessResult.rows.length === 0) {
                return res.status(403).json({ ok: false, error: 'User does not have access to this empresa' });
            }
            req.ctx.rolEmpresa = accessResult.rows[0].rol_empresa;
        } else {
            req.ctx.rolEmpresa = 'admin'; // SuperAdmin tiene rol admin en cualquier empresa
        }

        next();
    } catch (error) {
        console.error('Empresa Middleware Error:', error);
        res.status(500).json({ ok: false, error: 'Internal Server Error validating empresa' });
    }
}

module.exports = {
    requireEmpresa
};
