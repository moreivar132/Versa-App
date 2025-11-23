require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
const { authenticateToken } = require('./middleware/auth');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middlewares Esenciales ---
app.use(cors());
app.use(express.json());

// --- Servir archivos estáticos del Frontend ---
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));

// --- Rutas de la API ---
app.use('/api/auth', authRoutes);

// --- Rutas Protegidas de la API ---
app.use(authenticateToken);
app.get('/api/notas', async (req, res) => {
  const userId = req.user.userId;
  try {
    const result = await pool.query('SELECT * FROM notas WHERE usuario_id = $1 ORDER BY fecha_creacion DESC', [userId]);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener las notas:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

app.post('/api/notas', async (req, res) => {
  const { titulo, contenido } = req.body;
  const userId = req.user.userId;
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
      return res.status(404).json({ error: 'Nota no encontrada o no tienes permiso para editarla.' });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar la nota:', error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

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

// --- Ruta Catch-all para SPA ---
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'login.html'));
});


// --- Iniciar el servidor ---
app.listen(PORT, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${PORT}`);
});
