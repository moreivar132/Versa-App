const jwt = require('jsonwebtoken');

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Token no proporcionado.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Normalize tenant_id field - some JWTs use tenant_id, others use id_tenant
    // Provide both aliases for compatibility with all routes
    if (payload.tenant_id && !payload.id_tenant) {
      payload.id_tenant = payload.tenant_id;
    } else if (payload.id_tenant && !payload.tenant_id) {
      payload.tenant_id = payload.id_tenant;
    }

    req.user = payload;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

module.exports = verifyJWT;
