const pool = require('../db');

// Busca un usuario por su dirección de email
const getUserByEmail = async (email) => {
  try {
    const result = await pool.query(
      'SELECT * FROM usuarios WHERE email = $1',
      [email]
    );
    return result.rows[0]; // Devuelve el primer usuario encontrado o undefined
  } catch (error) {
    console.error('Error al obtener usuario por email:', error);
    throw error;
  }
};

module.exports = { getUserByEmail };
