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

async function createUser({ id_tenant, nombre, email, passwordHash, isSuperAdmin }) {
  const insertQuery = `
    INSERT INTO usuario (id_tenant, nombre, email, password_hash, is_super_admin)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [id_tenant || null, nombre || null, email, passwordHash, Boolean(isSuperAdmin)];
  const result = await pool.query(insertQuery, values);
  return result.rows[0] || null;
}

module.exports = {
  getUserByEmail,
  getUserById,
  createUser,
};
