const jwt = require('jsonwebtoken');

// Middleware para proteger rutas verificando el token JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Formato: "Bearer TOKEN"

  if (!token) {
    return res.status(401).json({ error: 'No se proporcionó un token de acceso.' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({ error: 'El token ha expirado.' });
      }
      return res.status(403).json({ error: 'Token inválido.' });
    }
    
    // Si el token es válido, añadimos el payload del usuario a la request
    req.user = user;
    next(); // Continuamos a la siguiente función o ruta
  });
};

module.exports = { authenticateToken };
