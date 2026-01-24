const { getTenantDb } = require('../src/core/db/tenant-db');

function resolveDb(ctxOrDb, options = {}) {
    if (ctxOrDb && typeof ctxOrDb.query === 'function') {
        return ctxOrDb;
    }
    return getTenantDb(ctxOrDb, options);
}

const getAllRoles = async (ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query('SELECT * FROM rol ORDER BY nombre');
    return result.rows;
};

const getRoleById = async (id, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query('SELECT * FROM rol WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0];
};

const createRole = async ({ nombre }, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        'INSERT INTO rol (nombre) VALUES ($1) RETURNING *',
        [nombre]
    );
    return result.rows[0];
};

const updateRole = async (id, { nombre }, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        'UPDATE rol SET nombre = $1 WHERE id = $2 RETURNING *',
        [nombre, id]
    );
    return result.rows[0];
};

const deleteRole = async (id, ctx = null) => {
    // Transactional delete using txWithRLS if possible, otherwise sequential is mostly fine for admin ops
    // But let's try to be atomic if we can resolve a tx-capable db
    const db = resolveDb(ctx, { allowNoTenant: true });

    if (db.txWithRLS) {
        await db.txWithRLS(async (tx) => {
            await tx.query('DELETE FROM rolpermiso WHERE id_rol = $1', [id]);
            await tx.query('DELETE FROM usuariorol WHERE id_rol = $1', [id]);
            await tx.query('DELETE FROM rol WHERE id = $1', [id]);
        });
    } else {
        // Fallback or explicit tx passed
        await db.query('DELETE FROM rolpermiso WHERE id_rol = $1', [id]);
        await db.query('DELETE FROM usuariorol WHERE id_rol = $1', [id]);
        await db.query('DELETE FROM rol WHERE id = $1', [id]);
    }
};

const getUserRoles = async (userId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        `SELECT r.* 
     FROM rol r
     JOIN usuariorol ur ON r.id = ur.id_rol
     WHERE ur.id_usuario = $1`,
        [userId]
    );
    return result.rows;
};

const assignRoleToUser = async (userId, roleId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    // Verificar si ya existe para evitar duplicados
    const check = await db.query(
        'SELECT * FROM usuariorol WHERE id_usuario = $1 AND id_rol = $2',
        [userId, roleId]
    );

    if (check.rows.length > 0) return check.rows[0];

    const result = await db.query(
        'INSERT INTO usuariorol (id_usuario, id_rol) VALUES ($1, $2) RETURNING *',
        [userId, roleId]
    );
    return result.rows[0];
};

const removeRoleFromUser = async (userId, roleId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    await db.query(
        'DELETE FROM usuariorol WHERE id_usuario = $1 AND id_rol = $2',
        [userId, roleId]
    );
};

const clearUserRoles = async (userId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    await db.query('DELETE FROM usuariorol WHERE id_usuario = $1', [userId]);
};

const getRolePermissions = async (roleId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        `SELECT p.*
     FROM permiso p
     JOIN rolpermiso rp ON p.id = rp.id_permiso
     WHERE rp.id_rol = $1
     ORDER BY p.nombre`,
        [roleId]
    );
    return result.rows;
};

const assignPermissionToRole = async (roleId, permisoId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const existing = await db.query(
        'SELECT 1 FROM rolpermiso WHERE id_rol = $1 AND id_permiso = $2',
        [roleId, permisoId]
    );

    if (existing.rows.length > 0) return existing.rows[0];

    const result = await db.query(
        'INSERT INTO rolpermiso (id_rol, id_permiso) VALUES ($1, $2) RETURNING *',
        [roleId, permisoId]
    );
    return result.rows[0];
};

const clearRolePermissions = async (roleId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    await db.query('DELETE FROM rolpermiso WHERE id_rol = $1', [roleId]);
};

module.exports = {
    getAllRoles,
    getRoleById,
    createRole,
    updateRole,
    deleteRole,
    getUserRoles,
    assignRoleToUser,
    removeRoleFromUser,
    clearUserRoles,
    getRolePermissions,
    assignPermissionToRole,
    clearRolePermissions
};
