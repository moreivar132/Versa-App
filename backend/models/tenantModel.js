const { getTenantDb } = require('../src/core/db/tenant-db');

function resolveDb(ctxOrDb, options = {}) {
    if (ctxOrDb && typeof ctxOrDb.query === 'function') {
        return ctxOrDb;
    }
    return getTenantDb(ctxOrDb, options);
}

const getAllTenants = async (ctx = null) => {
    // Usually a superadmin operation
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query('SELECT * FROM tenant ORDER BY nombre');
    return result.rows;
};

const getTenantById = async (id, ctx = null) => {
    // Can be used during login resolution
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query('SELECT * FROM tenant WHERE id = $1', [id]);
    return result.rows[0];
};

const createTenant = async (nombre, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        'INSERT INTO tenant (nombre) VALUES ($1) RETURNING *',
        [nombre]
    );
    return result.rows[0];
};

const updateTenant = async (id, nombre, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    const result = await db.query(
        'UPDATE tenant SET nombre = $1 WHERE id = $2 RETURNING *',
        [nombre, id]
    );
    return result.rows[0];
};

const deleteTenant = async (id, ctx = null) => {
    const db = resolveDb(ctx, { allowNoTenant: true });
    await db.query('DELETE FROM tenant WHERE id = $1', [id]);
};

module.exports = {
    getAllTenants,
    getTenantById,
    createTenant,
    updateTenant,
    deleteTenant,
};
