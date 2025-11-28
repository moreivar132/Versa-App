const pool = require('../db');

const getAllRoles = async () => {
    const result = await pool.query('SELECT * FROM rol ORDER BY nombre');
    return result.rows;
};

const getRoleById = async (id) => {
    const result = await pool.query('SELECT * FROM rol WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0];
};

const createRole = async ({ nombre }) => {
    const result = await pool.query(
        'INSERT INTO rol (nombre) VALUES ($1) RETURNING *',
        [nombre]
    );
    return result.rows[0];
};

const updateRole = async (id, { nombre }) => {
    const result = await pool.query(
        'UPDATE rol SET nombre = $1 WHERE id = $2 RETURNING *',
        [nombre, id]
    );
    return result.rows[0];
};

const deleteRole = async (id) => {
    await pool.query('DELETE FROM rolpermiso WHERE id_rol = $1', [id]);
    await pool.query('DELETE FROM usuariorol WHERE id_rol = $1', [id]);
    await pool.query('DELETE FROM rol WHERE id = $1', [id]);
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

const getRolePermissions = async (roleId) => {
    const result = await pool.query(
        `SELECT p.*
     FROM permiso p
     JOIN rolpermiso rp ON p.id = rp.id_permiso
     WHERE rp.id_rol = $1
     ORDER BY p.nombre`,
        [roleId]
    );
    return result.rows;
};

const assignPermissionToRole = async (roleId, permisoId) => {
    const existing = await pool.query(
        'SELECT 1 FROM rolpermiso WHERE id_rol = $1 AND id_permiso = $2',
        [roleId, permisoId]
    );

    if (existing.rows.length > 0) return existing.rows[0];

    const result = await pool.query(
        'INSERT INTO rolpermiso (id_rol, id_permiso) VALUES ($1, $2) RETURNING *',
        [roleId, permisoId]
    );
    return result.rows[0];
};

const clearRolePermissions = async (roleId) => {
    await pool.query('DELETE FROM rolpermiso WHERE id_rol = $1', [roleId]);
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
