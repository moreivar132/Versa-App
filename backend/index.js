require('dotenv').config(); // Carga las variables de entorno desde .env
const express = require('express');
const cors = require('cors');
const pool = require('./db'); // Importa el pool de conexión a la BD
const { authenticateToken } = require('./middleware/auth'); // Importa el middleware de autenticación
const authRoutes = require('./routes/auth'); // Importa las rutas de autenticación

const app = express();
const PORT = process.env.PORT || 3000;

// --- Middlewares Esenciales ---
app.use(cors()); // Permite peticiones desde diferentes orígenes (tu frontend)
app.use(express.json()); // Permite al servidor entender y manejar JSON en las peticiones

// --- Rutas Públicas ---
// La ruta de login no necesita autenticación, por eso va antes del middleware authenticateToken
app.use('/api/auth', authRoutes);

// --- Rutas Protegidas ---
// Todas las rutas definidas después de este punto requerirán un token válido
app.use(authenticateToken);

// GET /api/notas - Obtener todas las notas del usuario autenticado
app.get('/api/notas', async (req, res) => {
  const userId = req.user.userId; // Obtenemos el ID del usuario desde el token
  try {
    const result = await pool.query('SELECT * FROM notas WHERE usuario_id = $1 ORDER BY fecha_creacion DESC', [userId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener las notas:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/notas - Crear una nueva nota para el usuario autenticado
app.post('/api/notas', async (req, res) => {
  const { titulo, contenido } = req.body;
  const userId = req.user.userId; // Obtenemos el ID del usuario desde el token

  if (!titulo) {
    return res.status(400).json({ error: 'El título es obligatorio.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO notas (titulo, contenido, usuario_id) VALUES ($1, $2, $3) RETURNING *',
      [titulo, contenido, userId]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error al crear la nota:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/notas/:id - Actualizar una nota existente del usuario autenticado
app.put('/api/notas/:id', async (req, res) => {
  const { id } = req.params;
  const { titulo, contenido } = req.body;
  const userId = req.user.userId;

  if (!titulo) {
    return res.status(400).json({ error: 'El título es obligatorio.' });
  }

  try {
    const result = await pool.query(
      'UPDATE notas SET titulo = $1, contenido = $2, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id = $3 AND usuario_id = $4 RETURNING *',
      [titulo, contenido, id, userId]
    );
    if (result.rowCount === 0) {
      // Si no se actualizó ninguna fila, es porque la nota no existe o no pertenece al usuario
      return res.status(404).json({ error: 'Nota no encontrada o no tienes permiso para editarla.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar la nota:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /api/notas/:id - Eliminar una nota del usuario autenticado
app.delete('/api/notas/:id', async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const result = await pool.query('DELETE FROM notas WHERE id = $1 AND usuario_id = $2 RETURNING *', [id, userId]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Nota no encontrada o no tienes permiso para eliminarla.' });
    }
    res.status(200).json({ message: 'Nota eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar la nota:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// --- Iniciar el servidor ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
