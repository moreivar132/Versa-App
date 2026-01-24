const { getTenantDb } = require('../src/core/db/tenant-db');

function resolveDb(ctxOrDb, options = {}) {
    if (ctxOrDb && typeof ctxOrDb.query === 'function') {
        return ctxOrDb;
    }
    return getTenantDb(ctxOrDb, options);
}

const getAllSucursales = async (ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query('SELECT * FROM sucursal ORDER BY nombre');
    return result.rows;
};

const getSucursalesByTenant = async (tenantId, ctx = null) => {
    // If we have tenantId, we should try to use tenant-safe DB if context allows, 
    // but here we are filtering by tenantId explicitly.
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        'SELECT * FROM sucursal WHERE id_tenant = $1 ORDER BY nombre',
        [tenantId]
    );
    return result.rows;
};

const createSucursal = async ({ nombre, id_tenant, google_calendar_id }, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        'INSERT INTO sucursal (nombre, id_tenant, google_calendar_id) VALUES ($1, $2, $3) RETURNING *',
        [nombre, id_tenant, google_calendar_id]
    );
    return result.rows[0];
};

const updateSucursal = async (id, { nombre, id_tenant, google_calendar_id }, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        'UPDATE sucursal SET nombre = $1, id_tenant = $2, google_calendar_id = $3 WHERE id = $4 RETURNING *',
        [nombre, id_tenant, google_calendar_id, id]
    );
    return result.rows[0];
};

const deleteSucursal = async (id, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    if (db.txWithRLS) {
        await db.txWithRLS(async (tx) => {
            await tx.query('DELETE FROM usuariosucursal WHERE id_sucursal = $1', [id]);
            await tx.query('DELETE FROM sucursal WHERE id = $1', [id]);
        });
    } else {
        await db.query('DELETE FROM usuariosucursal WHERE id_sucursal = $1', [id]);
        await db.query('DELETE FROM sucursal WHERE id = $1', [id]);
    }
};

const getUserSucursales = async (userId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        `SELECT s.* 
     FROM sucursal s
     JOIN usuariosucursal us ON s.id = us.id_sucursal
     WHERE us.id_usuario = $1`,
        [userId]
    );
    return result.rows;
};

const assignSucursalToUser = async (userId, sucursalId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    // Verificar duplicados
    const check = await db.query(
        'SELECT * FROM usuariosucursal WHERE id_usuario = $1 AND id_sucursal = $2',
        [userId, sucursalId]
    );

    if (check.rows.length > 0) return check.rows[0];

    const result = await db.query(
        'INSERT INTO usuariosucursal (id_usuario, id_sucursal) VALUES ($1, $2) RETURNING *',
        [userId, sucursalId]
    );
    return result.rows[0];
};

const clearUserSucursales = async (userId, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    await db.query('DELETE FROM usuariosucursal WHERE id_usuario = $1', [userId]);
};

module.exports = {
    getAllSucursales,
    getSucursalesByTenant,
    createSucursal,
    updateSucursal,
    deleteSucursal,
    getUserSucursales,
    assignSucursalToUser,
    clearUserSucursales
};
