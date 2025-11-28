const pool = require('../db');

async function getUserByEmail(email) {
  if (!email) return null;
  const result = await pool.query('SELECT * FROM usuario WHERE email = $1 LIMIT 1', [email]);
  return result.rows[0] || null;
}

async function getUserById(id) {
  if (!id) return null;
  const result = await pool.query('SELECT * FROM usuario WHERE id = $1 LIMIT 1', [id]);
  return result.rows[0] || null;
}

async function createUser({ id_tenant, nombre, email, passwordHash, isSuperAdmin, porcentaje_mano_obra }) {
  const insertQuery = `
    INSERT INTO usuario (id_tenant, nombre, email, password_hash, is_super_admin, porcentaje_mano_obra)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `;
  const values = [
    id_tenant || null,
    nombre || null,
    email,
    passwordHash,
    Boolean(isSuperAdmin),
    porcentaje_mano_obra || 0.5
  ];
  const result = await pool.query(insertQuery, values);
  return result.rows[0] || null;
}

async function getAllUsers() {
  const result = await pool.query(`
    SELECT u.*, t.nombre as tenant_nombre 
    FROM usuario u
    LEFT JOIN tenant t ON u.id_tenant = t.id
    ORDER BY u.created_at DESC
  `);
  return result.rows;
}

async function updateUser(id, { nombre, email, id_tenant, is_super_admin, porcentaje_mano_obra }) {
  const updateQuery = `
    UPDATE usuario 
    SET nombre = $1, 
        email = $2, 
        id_tenant = $3, 
        is_super_admin = $4, 
        porcentaje_mano_obra = $5
    WHERE id = $6
    RETURNING *
  `;
  const values = [nombre, email, id_tenant, is_super_admin, porcentaje_mano_obra, id];
  const result = await pool.query(updateQuery, values);
  return result.rows[0];
}

async function deleteUser(id) {
  await pool.query('DELETE FROM usuario WHERE id = $1', [id]);
  return true;
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
  getAllUsers,
  updateUser,
  deleteUser
};
