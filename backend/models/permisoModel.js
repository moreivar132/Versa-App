const { getTenantDb } = require('../src/core/db/tenant-db');

function resolveDb(ctxOrDb, options = {}) {
    if (ctxOrDb && typeof ctxOrDb.query === 'function') {
        return ctxOrDb;
    }
    return getTenantDb(ctxOrDb, options);
}

const getAllPermisos = async (ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query('SELECT * FROM permiso ORDER BY nombre');
    return result.rows;
};

const getPermisoById = async (id, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query('SELECT * FROM permiso WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0];
};

const createPermiso = async ({ nombre, descripcion }, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        'INSERT INTO permiso (nombre, descripcion) VALUES ($1, $2) RETURNING *',
        [nombre, descripcion || null]
    );
    return result.rows[0];
};

const updatePermiso = async (id, { nombre, descripcion }, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        'UPDATE permiso SET nombre = $1, descripcion = $2 WHERE id = $3 RETURNING *',
        [nombre, descripcion || null, id]
    );
    return result.rows[0];
};

const deletePermiso = async (id, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    if (db.txWithRLS) {
        await db.txWithRLS(async (tx) => {
            await tx.query('DELETE FROM rolpermiso WHERE id_permiso = $1', [id]);
            await tx.query('DELETE FROM permiso WHERE id = $1', [id]);
        });
    } else {
        await db.query('DELETE FROM rolpermiso WHERE id_permiso = $1', [id]);
        await db.query('DELETE FROM permiso WHERE id = $1', [id]);
    }
};

const getRolePermisos = async (roleId, ctx = null) => {
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

const getUserPermisos = async (userId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        `SELECT DISTINCT p.*
     FROM permiso p
     JOIN rolpermiso rp ON p.id = rp.id_permiso
     JOIN usuariorol ur ON rp.id_rol = ur.id_rol
     WHERE ur.id_usuario = $1
     ORDER BY p.nombre`,
        [userId]
    );
    return result.rows;
};

module.exports = {
    getAllPermisos,
    getPermisoById,
    createPermiso,
    updatePermiso,
    deletePermiso,
    getRolePermisos,
    getUserPermisos
};
