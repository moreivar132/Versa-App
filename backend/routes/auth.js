const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { getUserByEmail } = require('../models/userModel');

const router = express.Router();

// POST /api/auth/login - Maneja el inicio de sesión del usuario
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // 1. Validar que se recibieron email y contraseña
  if (!email || !password) {
    return res.status(400).json({ error: 'El email y la contraseña son obligatorios.' });
  }

  try {
    // 2. Buscar al usuario en la base de datos por su email
    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas.' }); // Mensaje genérico por seguridad
    }

    // 3. Comparar la contraseña proporcionada con el hash almacenado
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas.' }); // Mismo mensaje genérico
    }

    // 4. Si las credenciales son correctas, crear el token JWT
    const payload = {
      userId: user.id,
      email: user.email,
      // Puedes añadir más datos al token si lo necesitas, pero mantenlo ligero
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET,
      { expiresIn: '1h' } // El token expirará en 1 hora
    );

    // 5. Enviar el token y datos básicos del usuario al cliente
    res.status(200).json({
      message: 'Inicio de sesión exitoso.',
      token: token,
      user: {
        id: user.id,
        nombre: user.nombre,
        email: user.email
      }
    });

  } catch (error) {
    console.error('Error en el proceso de login:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
