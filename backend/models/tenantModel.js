const pool = require('../db');

const getAllTenants = async () => {
    const result = await pool.query('SELECT * FROM tenant ORDER BY nombre');
    return result.rows;
};

const getTenantById = async (id) => {
    const result = await pool.query('SELECT * FROM tenant WHERE id = $1', [id]);
    return result.rows[0];
};

const createTenant = async (nombre) => {
    const result = await pool.query(
        'INSERT INTO tenant (nombre) VALUES ($1) RETURNING *',
        [nombre]
    );
    return result.rows[0];
};

module.exports = {
    getAllTenants,
    getTenantById,
    createTenant,
};
