/**
 * Module Repository Template
 * Abstrae el acceso a la base de datos.
 * 
 * RESPONSABILIDADES:
 * - Ejecutar queries SQL
 * - Mapear resultados a objetos de dominio
 * - Asegurar aislamiento por tenant
 * - NO contener lógica de negocio
 * 
 * IMPORTANTE: Todas las queries DEBEN filtrar por id_tenant
 */

const { query, transaction } = require('../../core/db');

// Nombre de la tabla (CAMBIAR según el módulo)
const TABLE_NAME = 'mi_tabla';

/**
 * Buscar múltiples registros
 * @param {Object} params
 * @param {number} params.tenantId
 * @param {number} params.limit
 * @param {number} params.offset
 * @param {Object} params.filters
 */
async function findMany({ tenantId, limit = 50, offset = 0, filters = {} }) {
    // Construir query dinámica según filtros
    let sql = `
        SELECT * FROM ${TABLE_NAME}
        WHERE id_tenant = $1
    `;
    const params = [tenantId];
    let paramIndex = 2;

    // Ejemplo de filtro por estado
    if (filters.estado) {
        sql += ` AND estado = $${paramIndex}`;
        params.push(filters.estado);
        paramIndex++;
    }

    // Ejemplo de filtro por búsqueda
    if (filters.q) {
        sql += ` AND nombre ILIKE $${paramIndex}`;
        params.push(`%${filters.q}%`);
        paramIndex++;
    }

    sql += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
}

/**
 * Contar registros
 */
async function count({ tenantId, filters = {} }) {
    let sql = `SELECT COUNT(*)::int as total FROM ${TABLE_NAME} WHERE id_tenant = $1`;
    const params = [tenantId];
    let paramIndex = 2;

    if (filters.estado) {
        sql += ` AND estado = $${paramIndex}`;
        params.push(filters.estado);
    }

    const result = await query(sql, params);
    return result.rows[0].total;
}

/**
 * Buscar por ID
 */
async function findById({ tenantId, id }) {
    const sql = `SELECT * FROM ${TABLE_NAME} WHERE id = $1 AND id_tenant = $2`;
    const result = await query(sql, [id, tenantId]);
    return result.rows[0] || null;
}

/**
 * Crear registro
 */
async function create({ tenantId, data }) {
    // Construir INSERT dinámico
    const fields = ['id_tenant', ...Object.keys(data)];
    const values = [tenantId, ...Object.values(data)];
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const sql = `
        INSERT INTO ${TABLE_NAME} (${fields.join(', ')})
        VALUES (${placeholders})
        RETURNING *
    `;

    const result = await query(sql, values);
    return result.rows[0];
}

/**
 * Actualizar registro
 */
async function update({ tenantId, id, data }) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

    const sql = `
        UPDATE ${TABLE_NAME}
        SET ${setClause}
        WHERE id = $${fields.length + 1} AND id_tenant = $${fields.length + 2}
        RETURNING *
    `;

    const result = await query(sql, [...values, id, tenantId]);
    return result.rows[0];
}

/**
 * Eliminar registro (soft delete recomendado en producción)
 */
async function deleteRecord({ tenantId, id }) {
    // Soft delete (recomendado)
    // const sql = `UPDATE ${TABLE_NAME} SET deleted_at = NOW() WHERE id = $1 AND id_tenant = $2`;

    // Hard delete
    const sql = `DELETE FROM ${TABLE_NAME} WHERE id = $1 AND id_tenant = $2`;
    await query(sql, [id, tenantId]);
}

module.exports = {
    findMany,
    count,
    findById,
    create,
    update,
    delete: deleteRecord
};
