/**
 * FinSaaS RBAC Controller
 * Manages user roles and access within a tenant
 * 
 * SECURITY: All endpoints require TENANT_ADMIN permission (finsaas.rbac.manage)
 */

const pool = require('../../../../../db');

/**
 * GET /api/finsaas/admin/rbac/users
 * List all users in the tenant with their roles and empresa access
 */
async function listUsers(req, res) {
    const tenantId = req.user?.id_tenant;

    if (!tenantId) {
        return res.status(400).json({ error: 'Contexto de tenant no encontrado' });
    }

    try {
        const result = await pool.query(`
            SELECT 
                u.id,
                u.nombre,
                u.email,
                u.activo,
                u.created_at,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', r.id,
                        'nombre', r.nombre
                    )) FILTER (WHERE r.id IS NOT NULL),
                    '[]'
                ) as roles,
                COALESCE(
                    json_agg(DISTINCT jsonb_build_object(
                        'id', e.id,
                        'nombre', COALESCE(e.nombre_legal, e.nombre_comercial)
                    )) FILTER (WHERE e.id IS NOT NULL),
                    '[]'
                ) as empresas
            FROM usuario u
            LEFT JOIN usuariorol ur ON ur.id_usuario = u.id AND (ur.tenant_id = $1 OR ur.tenant_id IS NULL)
            LEFT JOIN rol r ON r.id = ur.id_rol
            LEFT JOIN accounting_usuario_empresa aue ON aue.id_usuario = u.id AND aue.id_tenant = $1
            LEFT JOIN accounting_empresa e ON e.id = aue.id_empresa
            WHERE u.id_tenant = $1
            GROUP BY u.id, u.nombre, u.email, u.activo, u.created_at
            ORDER BY u.nombre
        `, [tenantId]);

        res.json({
            ok: true,
            users: result.rows.map(user => ({
                id: user.id,
                nombre: user.nombre,
                email: user.email,
                activo: user.activo,
                createdAt: user.created_at,
                roles: user.roles,
                empresas: user.empresas
            }))
        });

    } catch (error) {
        console.error('[FinSaaSRBAC] listUsers error:', error);
        res.status(500).json({ error: 'Error al obtener usuarios', details: error.message });
    }
}

/**
 * GET /api/finsaas/admin/rbac/roles
 * List available roles for assignment
 */
async function listRoles(req, res) {
    const tenantId = req.user?.id_tenant;

    try {
        const result = await pool.query(`
            SELECT id, nombre, descripcion, scope
            FROM rol
            WHERE (tenant_id = $1 OR tenant_id IS NULL OR scope = 'global')
            ORDER BY nombre
        `, [tenantId]);

        res.json({
            ok: true,
            roles: result.rows
        });

    } catch (error) {
        console.error('[FinSaaSRBAC] listRoles error:', error);
        res.status(500).json({ error: 'Error al obtener roles', details: error.message });
    }
}

/**
 * PATCH /api/finsaas/admin/rbac/users/:userId
 * Update user's role and empresa access
 * 
 * Body: {
 *   roleId: number,
 *   empresaIds: number[] (optional)
 * }
 */
async function updateUserAccess(req, res) {
    const tenantId = req.user?.id_tenant;
    const adminUserId = req.user?.id;
    const targetUserId = parseInt(req.params.userId);
    const { roleId, empresaIds } = req.body;

    if (!tenantId) {
        return res.status(400).json({ error: 'Contexto de tenant no encontrado' });
    }

    if (!targetUserId || isNaN(targetUserId)) {
        return res.status(400).json({ error: 'ID de usuario inválido' });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Verify target user belongs to same tenant
        const userCheck = await client.query(
            'SELECT id, nombre FROM usuario WHERE id = $1 AND id_tenant = $2',
            [targetUserId, tenantId]
        );

        if (userCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const targetUser = userCheck.rows[0];

        // Prevent admin from removing their own admin role
        if (targetUserId === adminUserId) {
            // Check if new role is still admin
            const roleCheck = await client.query(
                'SELECT nombre FROM rol WHERE id = $1',
                [roleId]
            );
            const newRoleName = roleCheck.rows[0]?.nombre?.toUpperCase();
            if (!['ADMIN', 'TENANT_ADMIN', 'SUPER_ADMIN'].includes(newRoleName)) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'No puedes quitarte el rol de administrador a ti mismo' });
            }
        }

        // Update role if provided
        if (roleId) {
            // Verify role exists and is accessible
            const roleExists = await client.query(
                'SELECT id FROM rol WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL OR scope = \'global\')',
                [roleId, tenantId]
            );

            if (roleExists.rows.length === 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Rol no válido' });
            }

            // Remove existing roles for this tenant
            await client.query(
                'DELETE FROM usuariorol WHERE id_usuario = $1 AND (tenant_id = $2 OR tenant_id IS NULL)',
                [targetUserId, tenantId]
            );

            // Add new role
            await client.query(
                'INSERT INTO usuariorol (id_usuario, id_rol, tenant_id) VALUES ($1, $2, $3)',
                [targetUserId, roleId, tenantId]
            );
        }

        // Update empresa access if provided
        if (Array.isArray(empresaIds)) {
            // Validate all empresas belong to tenant
            if (empresaIds.length > 0) {
                const empresaCheck = await client.query(
                    'SELECT id FROM accounting_empresa WHERE id = ANY($1) AND id_tenant = $2',
                    [empresaIds, tenantId]
                );

                if (empresaCheck.rows.length !== empresaIds.length) {
                    await client.query('ROLLBACK');
                    return res.status(400).json({ error: 'Una o más empresas no son válidas' });
                }
            }

            // Remove existing empresa access
            await client.query(
                'DELETE FROM accounting_usuario_empresa WHERE id_usuario = $1 AND id_tenant = $2',
                [targetUserId, tenantId]
            );

            // Add new empresa access
            for (const empresaId of empresaIds) {
                await client.query(
                    'INSERT INTO accounting_usuario_empresa (id_usuario, id_empresa, id_tenant) VALUES ($1, $2, $3)',
                    [targetUserId, empresaId, tenantId]
                );
            }
        }

        // Audit log
        await client.query(`
            INSERT INTO accounting_audit_log 
            (id_tenant, entity_type, entity_id, action, after_json, performed_by)
            VALUES ($1, 'usuario', $2, 'UPDATE_ACCESS', $3, $4)
        `, [
            tenantId,
            targetUserId,
            JSON.stringify({ roleId, empresaIds }),
            adminUserId
        ]);

        await client.query('COMMIT');

        res.json({
            ok: true,
            message: `Accesos de ${targetUser.nombre} actualizados correctamente`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('[FinSaaSRBAC] updateUserAccess error:', error);
        res.status(500).json({ error: 'Error al actualizar accesos' });
    } finally {
        client.release();
    }
}

/**
 * GET /api/finsaas/admin/rbac/empresas
 * List empresas in the tenant for assignment
 */
async function listEmpresas(req, res) {
    const tenantId = req.user?.id_tenant;

    if (!tenantId) {
        return res.status(400).json({ error: 'Contexto de tenant no encontrado' });
    }

    try {
        const result = await pool.query(`
            SELECT id, COALESCE(nombre_legal, nombre_comercial) as nombre
            FROM accounting_empresa
            WHERE id_tenant = $1 AND deleted_at IS NULL
            ORDER BY nombre
        `, [tenantId]);

        res.json({
            ok: true,
            empresas: result.rows
        });

    } catch (error) {
        console.error('[FinSaaSRBAC] listEmpresas error:', error);
        res.status(500).json({ error: 'Error al obtener empresas' });
    }
}

module.exports = {
    listUsers,
    listRoles,
    updateUserAccess,
    listEmpresas
};
