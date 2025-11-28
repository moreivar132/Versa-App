const pool = require('../db');

const getAllPermisos = async () => {
    const result = await pool.query('SELECT * FROM permiso ORDER BY nombre');
    return result.rows;
};

const getPermisoById = async (id) => {
    const result = await pool.query('SELECT * FROM permiso WHERE id = $1 LIMIT 1', [id]);
    return result.rows[0];
};

const createPermiso = async ({ nombre, descripcion }) => {
    const result = await pool.query(
        'INSERT INTO permiso (nombre, descripcion) VALUES ($1, $2) RETURNING *',
        [nombre, descripcion || null]
    );
    return result.rows[0];
};

const updatePermiso = async (id, { nombre, descripcion }) => {
    const result = await pool.query(
        'UPDATE permiso SET nombre = $1, descripcion = $2 WHERE id = $3 RETURNING *',
        [nombre, descripcion || null, id]
    );
    return result.rows[0];
};

const deletePermiso = async (id) => {
    await pool.query('DELETE FROM rolpermiso WHERE id_permiso = $1', [id]);
    await pool.query('DELETE FROM permiso WHERE id = $1', [id]);
};

const getRolePermisos = async (roleId) => {
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

const getUserPermisos = async (userId) => {
    const result = await pool.query(
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
