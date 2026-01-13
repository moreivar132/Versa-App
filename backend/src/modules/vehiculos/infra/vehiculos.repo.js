/**
 * Vehículos Repository
 * 
 * Acceso a base de datos para el módulo de vehículos.
 */

const { getTenantDb } = require('../../../core/db/tenant-db');

/**
 * Listar vehículos del tenant
 */
async function findAll(ctx, options = {}) {
    const db = getTenantDb(ctx);
    const { idSucursal } = options;

    let query = `
        SELECT v.*, c.nombre as nombre_cliente, s.nombre as nombre_sucursal
        FROM vehiculo v
        LEFT JOIN clientefinal c ON v.id_cliente = c.id
        LEFT JOIN sucursal s ON v.id_sucursal = s.id
        WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (!ctx.isSuperAdmin) {
        query += ` AND s.id_tenant = $${paramIndex}`;
        params.push(ctx.tenantId);
        paramIndex++;
    }

    if (idSucursal) {
        query += ` AND v.id_sucursal = $${paramIndex}`;
        params.push(idSucursal);
        paramIndex++;
    }

    query += ` ORDER BY v.created_at DESC`;

    const result = await db.query(query, params);
    return result.rows;
}

/**
 * Crear vehículo
 */
async function create(ctx, data) {
    const db = getTenantDb(ctx);
    const {
        id_cliente, id_sucursal, matricula, marca, modelo,
        year, serial, color, cc, seguro
    } = data;

    const result = await db.txWithRLS(async (trxDb) => {
        return trxDb.query(`
            INSERT INTO vehiculo
            (id_cliente, id_sucursal, matricula, marca, modelo, "year", "Serial", "Color", "CC", "Seguro", created_at, created_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), $11)
            RETURNING *
        `, [
            id_cliente || null,
            id_sucursal,
            matricula,
            marca,
            modelo,
            year || null,
            serial || null,
            color || null,
            cc || null,
            seguro || null,
            ctx.userId
        ]);
    });

    return result.rows[0];
}

/**
 * Actualizar vehículo
 */
async function update(ctx, id, data) {
    const db = getTenantDb(ctx);
    const {
        id_cliente, id_sucursal, matricula, marca, modelo,
        year, serial, color, cc, seguro
    } = data;

    const result = await db.txWithRLS(async (trxDb) => {
        return trxDb.query(`
            UPDATE vehiculo
            SET id_cliente = $1, id_sucursal = $2, matricula = $3, marca = $4, modelo = $5,
                "year" = $6, "Serial" = $7, "Color" = $8, "CC" = $9, "Seguro" = $10, 
                updated_at = NOW(), updated_by = $11
            WHERE id = $12
            RETURNING *
        `, [
            id_cliente || null,
            id_sucursal,
            matricula,
            marca,
            modelo,
            year || null,
            serial || null,
            color || null,
            cc || null,
            seguro || null,
            ctx.userId,
            id
        ]);
    });

    return result.rows[0] || null;
}

/**
 * Buscar vehículos
 */
async function search(ctx, options = {}) {
    const db = getTenantDb(ctx);
    const { q, id_cliente } = options;

    let query = `
        SELECT v.*, c.nombre as nombre_cliente 
        FROM vehiculo v
        LEFT JOIN clientefinal c ON v.id_cliente = c.id
        LEFT JOIN sucursal s ON v.id_sucursal = s.id
        WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (!ctx.isSuperAdmin) {
        query += ` AND s.id_tenant = $${paramIndex}`;
        params.push(ctx.tenantId);
        paramIndex++;
    }

    if (id_cliente) {
        query += ` AND v.id_cliente = $${paramIndex}`;
        params.push(id_cliente);
        paramIndex++;
    }

    if (q) {
        const searchTerm = `%${q}%`;
        query += ` AND (v.matricula ILIKE $${paramIndex} OR v.marca ILIKE $${paramIndex} OR v.modelo ILIKE $${paramIndex})`;
        params.push(searchTerm);
        paramIndex++;
    }

    query += ` LIMIT 20`;

    const result = await db.query(query, params);
    return result.rows;
}

/**
 * Buscar vehículo por ID
 */
async function findById(ctx, id) {
    const db = getTenantDb(ctx);
    const result = await db.query(`
        SELECT v.*, c.nombre as nombre_cliente, s.nombre as nombre_sucursal
        FROM vehiculo v
        LEFT JOIN clientefinal c ON v.id_cliente = c.id
        LEFT JOIN sucursal s ON v.id_sucursal = s.id
        WHERE v.id = $1 AND s.id_tenant = $2
    `, [id, ctx.tenantId]);
    return result.rows[0] || null;
}

module.exports = {
    findAll,
    create,
    update,
    search,
    findById
};
