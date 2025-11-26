const pool = require('../db');

const getAllSucursales = async () => {
    const result = await pool.query('SELECT * FROM sucursal ORDER BY nombre');
    return result.rows;
};

const getSucursalesByTenant = async (tenantId) => {
    const result = await pool.query(
        'SELECT * FROM sucursal WHERE id_tenant = $1 ORDER BY nombre',
        [tenantId]
    );
    return result.rows;
};

const getUserSucursales = async (userId) => {
    const result = await pool.query(
        `SELECT s.* 
     FROM sucursal s
     JOIN usuariosucursal us ON s.id = us.id_sucursal
     WHERE us.id_usuario = $1`,
        [userId]
    );
    return result.rows;
};

const assignSucursalToUser = async (userId, sucursalId) => {
    // Verificar duplicados
    const check = await pool.query(
        'SELECT * FROM usuariosucursal WHERE id_usuario = $1 AND id_sucursal = $2',
        [userId, sucursalId]
    );

    if (check.rows.length > 0) return check.rows[0];

    const result = await pool.query(
        'INSERT INTO usuariosucursal (id_usuario, id_sucursal) VALUES ($1, $2) RETURNING *',
        [userId, sucursalId]
    );
    return result.rows[0];
};

const clearUserSucursales = async (userId) => {
    await pool.query('DELETE FROM usuariosucursal WHERE id_usuario = $1', [userId]);
};

module.exports = {
    getAllSucursales,
    getSucursalesByTenant,
    getUserSucursales,
    assignSucursalToUser,
    clearUserSucursales
};
