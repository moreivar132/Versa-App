/**
 * Clientes Repository
 * 
 * Acceso a base de datos para el módulo de clientes.
 * TODAS las queries viven aquí, no en controllers ni services.
 */

const { getTenantDb } = require('../../../core/db/tenant-db');

/**
 * Buscar cliente por documento en un tenant
 */
async function findByDocumento(ctx, documento) {
    const db = getTenantDb(ctx);
    const result = await db.query(
        'SELECT id FROM clientefinal WHERE documento = $1 AND id_tenant = $2',
        [documento, ctx.tenantId]
    );
    return result.rows[0] || null;
}

/**
 * Crear un nuevo cliente
 */
async function create(ctx, clienteData) {
    const db = getTenantDb(ctx);
    const {
        nombre, tipo_documento, documento, origen_cliente,
        telefono, telefono_alternativo, email, direccion,
        localidad, cp_cliente, comentario
    } = clienteData;

    const result = await db.txWithRLS(async (trxDb) => {
        return trxDb.query(`
            INSERT INTO clientefinal 
            (id_tenant, nombre, tipo_documento, documento, origen_cliente, 
             telefono, telefono_alternativo, email, direccion, localidad, 
             cp_cliente, comentario, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            RETURNING *
        `, [
            ctx.tenantId,
            nombre,
            tipo_documento || null,
            documento,
            origen_cliente || null,
            telefono,
            telefono_alternativo || null,
            email || null,
            direccion || null,
            localidad || null,
            cp_cliente || null,
            comentario || null
        ]);
    });

    return result.rows[0];
}

/**
 * Obtener últimos N clientes del tenant
 */
async function findLatest(ctx, limit = 3) {
    const db = getTenantDb(ctx);

    let query, params;

    if (ctx.isSuperAdmin) {
        query = `SELECT * FROM clientefinal ORDER BY created_at DESC LIMIT $1`;
        params = [limit];
    } else {
        query = `SELECT * FROM clientefinal WHERE id_tenant = $1 ORDER BY created_at DESC LIMIT $2`;
        params = [ctx.tenantId, limit];
    }

    const result = await db.query(query, params);
    return result.rows;
}

/**
 * Contar clientes del tenant
 */
async function count(ctx) {
    const db = getTenantDb(ctx);

    let query, params;

    if (ctx.isSuperAdmin) {
        query = 'SELECT COUNT(*) FROM clientefinal';
        params = [];
    } else {
        query = 'SELECT COUNT(*) FROM clientefinal WHERE id_tenant = $1';
        params = [ctx.tenantId];
    }

    const result = await db.query(query, params);
    return parseInt(result.rows[0].count);
}

/**
 * Buscar cliente por ID (verificando tenant)
 */
async function findById(ctx, id) {
    const db = getTenantDb(ctx);
    const result = await db.query(
        'SELECT * FROM clientefinal WHERE id = $1 AND id_tenant = $2',
        [id, ctx.tenantId]
    );
    return result.rows[0] || null;
}

/**
 * Actualizar cliente
 */
async function update(ctx, id, clienteData) {
    const db = getTenantDb(ctx);
    const {
        nombre, tipo_documento, documento, origen_cliente,
        telefono, telefono_alternativo, email, direccion,
        localidad, cp_cliente, comentario
    } = clienteData;

    const result = await db.txWithRLS(async (trxDb) => {
        return trxDb.query(`
            UPDATE clientefinal
            SET nombre = $1, tipo_documento = $2, documento = $3, origen_cliente = $4,
                telefono = $5, telefono_alternativo = $6, email = $7, direccion = $8,
                localidad = $9, cp_cliente = $10, comentario = $11, updated_at = NOW()
            WHERE id = $12 AND id_tenant = $13
            RETURNING *
        `, [
            nombre,
            tipo_documento || null,
            documento,
            origen_cliente || null,
            telefono,
            telefono_alternativo || null,
            email || null,
            direccion || null,
            localidad || null,
            cp_cliente || null,
            comentario || null,
            id,
            ctx.tenantId
        ]);
    });

    return result.rows[0] || null;
}

/**
 * Buscar clientes por término
 */
async function search(ctx, searchTerm, limit = 10) {
    const db = getTenantDb(ctx);
    const term = `%${searchTerm}%`;

    let query, params;

    if (ctx.isSuperAdmin) {
        query = `
            SELECT * FROM clientefinal 
            WHERE (nombre ILIKE $1 OR documento ILIKE $1 OR telefono ILIKE $1)
            LIMIT $2
        `;
        params = [term, limit];
    } else {
        query = `
            SELECT * FROM clientefinal 
            WHERE id_tenant = $1 
            AND (nombre ILIKE $2 OR documento ILIKE $2 OR telefono ILIKE $2)
            LIMIT $3
        `;
        params = [ctx.tenantId, term, limit];
    }

    const result = await db.query(query, params);
    return result.rows;
}

module.exports = {
    findByDocumento,
    create,
    findLatest,
    count,
    findById,
    update,
    search
};
