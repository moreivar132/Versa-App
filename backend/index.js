// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./db');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ruta para probar servidor
app.get('/', (req, res) => {
  res.send('Servidor Versa-Backend funcionando en local 🚀');
});

// Ruta para registrar clientes desde el frontend
app.post('/api/clientes', async (req, res) => {
  const payload = req.body || {};

  try {
    // Obtener columnas válidas de la tabla clientes
    const { rows: columnRows } = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clientes'`
    );

    const validColumns = new Set(columnRows.map((row) => row.column_name));
    const usedColumns = new Set();
    const columns = [];
    const values = [];

    const toSnakeCase = (value = '') =>
      value
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[-\s]+/g, '_')
        .toLowerCase();

    Object.entries(payload).forEach(([key, value]) => {
      if (value === undefined) return;

      const possibleColumns = [key, key.toLowerCase(), toSnakeCase(key)];
      const columnName = possibleColumns.find((candidate) => validColumns.has(candidate));

      if (!columnName || usedColumns.has(columnName)) {
        return;
      }

      usedColumns.add(columnName);
      columns.push(`"${columnName}"`);
      values.push(value === '' ? null : value);
    });

    if (columns.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'No se recibieron campos válidos para registrar al cliente.',
      });
    }

    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const insertQuery = `INSERT INTO clientes (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;

    const result = await pool.query(insertQuery, values);

    return res.status(201).json({
      ok: true,
      cliente: result.rows[0],
    });
  } catch (error) {
    console.error('Error al registrar cliente:', error);
    return res.status(500).json({
      ok: false,
      error: 'Error al registrar el cliente en la base de datos.',
      details: error.message,
    });
  }
});

// Ruta para probar conexión con Neon
app.get('/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({
      ok: true,
      now: result.rows[0].now,
    });
  } catch (error) {
    console.error('Error en /db-test:', error);
    res.status(500).json({
      ok: false,
      error: 'Error conectando a Neon',
      details: error.message,
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${port}`);
});
