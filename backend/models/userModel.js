const { getTenantDb } = require('../src/core/db/tenant-db');

/**
 * Helper para resolver DB vs Ctx
 * Si recibe un objeto "query" style, es DB directa (tx o req.db)
 * Si recibe un objeto { ... } es ctx
 * Si no recibe nada o null, busca tenant en ctx
 */
function resolveDb(ctxOrDb, options = {}) {
  if (ctxOrDb && typeof ctxOrDb.query === 'function') {
    return ctxOrDb;
  }
  return getTenantDb(ctxOrDb, options);
}

async function getUserByEmail(email, ctx = null) {
  if (!email) return null;
  // Login flow typically calls this without tenant context first
  const db = resolveDb(ctx, { allowNoTenant: true });
  const result = await db.query('SELECT * FROM usuario WHERE email = $1 LIMIT 1', [email]);
  return result.rows[0] || null;
}

async function getUserById(id, ctx = null) {
  if (!id) return null;
  // Can be used in login flow too
  const db = resolveDb(ctx, { allowNoTenant: true });
  const result = await db.query('SELECT * FROM usuario WHERE id = $1 LIMIT 1', [id]);
  return result.rows[0] || null;
}

async function createUser({ id_tenant, nombre, email, passwordHash, isSuperAdmin, porcentaje_mano_obra }, ctx = null) {
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

  // Creation might happen in public signup (no curr tenant) or admin (has tenant)
  // safe to allow no tenant if id_tenant is explicit
  const db = resolveDb(ctx, { allowNoTenant: true });
  const result = await db.query(insertQuery, values);
  return result.rows[0] || null;
}

async function getAllUsers(ctx = {}) {
  // Listing users is usually an admin task, should be tenant aware or system aware
  // But legacy behavior was global. For now, we allow global if superadmin context, 
  // but let's default to tenant safety if ctx provided.
  // Given the query joins tenant, this is likely a superadmin view.
  const db = resolveDb(ctx, { allowNoTenant: true });

  const result = await db.query(`
    SELECT u.*, t.nombre as tenant_nombre 
    FROM usuario u
    LEFT JOIN tenant t ON u.id_tenant = t.id
    ORDER BY u.created_at DESC
  `);
  return result.rows;
}

async function updateUser(id, { nombre, email, id_tenant, is_super_admin, porcentaje_mano_obra, password_hash }, ctx = null) {
  const db = resolveDb(ctx, { allowNoTenant: true }); // Updates can be self-profile or admin

  // Build dynamic query based on whether password is being updated
  if (password_hash) {
    const updateQuery = `
      UPDATE usuario 
      SET nombre = $1, 
          email = $2, 
          id_tenant = $3, 
          is_super_admin = $4, 
          porcentaje_mano_obra = $5,
          password_hash = $6
      WHERE id = $7
      RETURNING *
    `;
    const values = [nombre, email, id_tenant, is_super_admin, porcentaje_mano_obra, password_hash, id];
    const result = await db.query(updateQuery, values);
    return result.rows[0];
  } else {
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
    const result = await db.query(updateQuery, values);
    return result.rows[0];
  }
}

async function deleteUser(id, ctx = null) {
  const db = resolveDb(ctx, { allowNoTenant: true });
  await db.query('DELETE FROM usuario WHERE id = $1', [id]);
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
