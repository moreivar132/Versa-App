const pool = require('../db');

const getAllRoles = async () => {
    const result = await pool.query('SELECT * FROM rol ORDER BY nombre');
    return result.rows;
};

const getUserRoles = async (userId) => {
    const result = await pool.query(
        `SELECT r.* 
     FROM rol r
     JOIN usuariorol ur ON r.id = ur.id_rol
     WHERE ur.id_usuario = $1`,
        [userId]
    );
    return result.rows;
};

const assignRoleToUser = async (userId, roleId) => {
    // Verificar si ya existe para evitar duplicados
    const check = await pool.query(
        'SELECT * FROM usuariorol WHERE id_usuario = $1 AND id_rol = $2',
        [userId, roleId]
    );

    if (check.rows.length > 0) return check.rows[0];

    const result = await pool.query(
        'INSERT INTO usuariorol (id_usuario, id_rol) VALUES ($1, $2) RETURNING *',
        [userId, roleId]
    );
    return result.rows[0];
};

const removeRoleFromUser = async (userId, roleId) => {
    await pool.query(
        'DELETE FROM usuariorol WHERE id_usuario = $1 AND id_rol = $2',
        [userId, roleId]
    );
};

const clearUserRoles = async (userId) => {
    await pool.query('DELETE FROM usuariorol WHERE id_usuario = $1', [userId]);
};

module.exports = {
    getAllRoles,
    getUserRoles,
    assignRoleToUser,
    removeRoleFromUser,
    clearUserRoles
};
