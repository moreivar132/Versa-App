const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getUserByEmail, getUserById, createUser } = require('../models/userModel');
const verifyJWT = require('../middleware/auth');
const { getTenantDb } = require('../src/core/db/tenant-db');

const router = express.Router();

function sanitizeUser(user = {}) {
  if (!user) return null;
  // eslint-disable-next-line no-unused-vars
  const { password_hash, ...safeUser } = user;
  return safeUser;
}

router.post('/register', async (req, res) => {
  const { id_tenant, nombre, email, password, is_super_admin } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // Get DB from context or fallback with allowNoTenant for initial user check
  const db = req.db || getTenantDb(req.context || {}, { allowNoTenant: true });

  const existingUser = await getUserByEmail(normalizedEmail, db);
  if (existingUser) {
    return res.status(409).json({ error: 'El usuario ya existe.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const createdUser = await createUser({
      id_tenant,
      nombre,
      email: normalizedEmail,
      passwordHash,
      isSuperAdmin: Boolean(is_super_admin),
    }, db);

    return res.status(201).json(sanitizeUser(createdUser));
  } catch (error) {
    console.error('Error al registrar usuario:', error);
    return res.status(500).json({ error: 'No se pudo registrar el usuario.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son obligatorios.' });
  }

  try {
    // Get DB from context or fallback with allowNoTenant for login
    const db = req.db || getTenantDb(req.context || {}, { allowNoTenant: true });

    const user = await getUserByEmail(String(email).trim().toLowerCase(), db);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash || '');
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Fetch user roles from database
    const rolesResult = await db.query(`
      SELECT r.nombre, r.display_name
      FROM usuariorol ur
      JOIN rol r ON r.id = ur.id_rol
      WHERE ur.id_usuario = $1
    `, [user.id]);

    const userRoles = rolesResult.rows.map(r => ({
      nombre: r.nombre,
      display_name: r.display_name || r.nombre
    }));

    // Fetch permissions
    let permissions = [];
    if (user.is_super_admin) {
      permissions = ['*'];
    } else {
      const permResult = await db.query(`
            SELECT DISTINCT COALESCE(p.key, p.nombre) as permission_key
            FROM usuariorol ur
            JOIN rol r ON ur.id_rol = r.id
            JOIN rolpermiso rp ON rp.id_rol = r.id
            JOIN permiso p ON p.id = rp.id_permiso
            WHERE ur.id_usuario = $1
        `, [user.id]);
      permissions = permResult.rows.map(r => r.permission_key);
    }

    const payload = {
      id: user.id,
      id_tenant: user.id_tenant,
      id_sucursal: user.id_sucursal,
      email: user.email,
      nombre: user.nombre,
      is_super_admin: user.is_super_admin,
      roles: userRoles.map(r => r.nombre)  // Include roles in JWT too
    };

    if (!process.env.JWT_SECRET) {
      console.error('CRITICAL ERROR: JWT_SECRET is not defined in environment variables.');
      return res.status(500).json({ error: 'Error de configuración del servidor (JWT).' });
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1d' });

    // Include roles in the response
    const safeUser = sanitizeUser(user);
    safeUser.roles = userRoles;
    safeUser.permissions = permissions;

    return res.json({ token, user: safeUser });
  } catch (error) {
    console.error('Error detallado en login:', error);
    if (error.stack) console.error(error.stack);
    return res.status(500).json({ error: 'No se pudo iniciar sesión. Ver logs del servidor.' });
  }
});

router.get('/me', verifyJWT, async (req, res) => {
  try {
    const db = req.db || getTenantDb(req.context || req.user || {}, { allowNoTenant: true });

    // Get user with tenant name
    const result = await db.query(`
      SELECT u.*, t.nombre as tenant_nombre
      FROM usuario u
      LEFT JOIN tenant t ON u.id_tenant = t.id
      WHERE u.id = $1
    `, [req.user.id]);

    const user = result.rows[0];
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Fetch user roles
    const rolesResult = await db.query(`
      SELECT r.nombre, r.display_name
      FROM usuariorol ur
      JOIN rol r ON r.id = ur.id_rol
      WHERE ur.id_usuario = $1
    `, [req.user.id]);

    const userRoles = rolesResult.rows.map(r => ({
      nombre: r.nombre,
      display_name: r.display_name || r.nombre
    }));

    // Fetch permissions logic (simplified version of RBAC middleware)
    let permissions = [];
    if (user.is_super_admin) {
      permissions = ['*'];
    } else {
      const permResult = await db.query(`
            SELECT DISTINCT COALESCE(p.key, p.nombre) as permission_key
            FROM usuariorol ur
            JOIN rol r ON ur.id_rol = r.id
            JOIN rolpermiso rp ON rp.id_rol = r.id
            JOIN permiso p ON p.id = rp.id_permiso
            WHERE ur.id_usuario = $1
        `, [req.user.id]);
      permissions = permResult.rows.map(r => r.permission_key);
    }

    const safeUser = sanitizeUser(user);
    safeUser.roles = userRoles;
    safeUser.permissions = permissions;

    return res.json(safeUser);
  } catch (error) {
    console.error('Error en /me:', error);
    return res.status(500).json({ error: 'No se pudo obtener el usuario.' });
  }
});

module.exports = router;
