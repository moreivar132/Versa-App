// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
const authRouter = require('./routes/auth');
const verifyJWT = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// Rutas de autenticación
app.use('/api/auth', authRouter);

const toSnakeCase = (value = '') =>
  String(value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();

const stripAccents = (value = '') =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeKey = (value = '') => toSnakeCase(stripAccents(value));

const COLUMN_SYNONYM_GROUPS = [
  ['matricula', 'placa', 'patente'],
  ['anio', 'ano', 'año', 'year'],
  ['numero_chasis', 'numero_de_chasis', 'chasis', 'vin'],
  ['cilindrada', 'cilindraje', 'cc', 'cilindrada_motor'],
];

const SYNONYM_LOOKUP = COLUMN_SYNONYM_GROUPS.reduce((lookup, group) => {
  const normalizedGroup = group.map((item) => normalizeKey(item));
  normalizedGroup.forEach((item) => {
    lookup.set(item, normalizedGroup);
  });
  return lookup;
}, new Map());

const buildInsertParts = (payload = {}, validColumns = new Set()) => {
  const usedColumns = new Set();
  const columns = [];
  const values = [];

  const normalizedColumnLookup = new Map();
  validColumns.forEach((column) => {
    const normalized = normalizeKey(column);
    if (!normalizedColumnLookup.has(normalized)) {
      normalizedColumnLookup.set(normalized, column);
    }
  });

  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return;

    const sanitizedValue = typeof value === 'string' ? value.trim() : value;
    if (sanitizedValue === '') return;

    const possibleKeys = new Set([
      key,
      key.toLowerCase(),
      toSnakeCase(key),
      stripAccents(key),
      normalizeKey(key),
    ]);

    let columnName;
    for (const candidateKey of possibleKeys) {
      if (!candidateKey) {
        continue;
      }

      if (validColumns.has(candidateKey) && !usedColumns.has(candidateKey)) {
        columnName = candidateKey;
        break;
      }

      const normalizedCandidate = normalizeKey(candidateKey);
      const synonymGroup = SYNONYM_LOOKUP.get(normalizedCandidate) || [normalizedCandidate];
      const matchedColumn = synonymGroup
        .map((synonym) => normalizedColumnLookup.get(synonym))
        .find((column) => column && !usedColumns.has(column));

      if (matchedColumn) {
        columnName = matchedColumn;
        break;
      }
    }

    if (!columnName) {
      return;
    }

    usedColumns.add(columnName);
    columns.push(`"${columnName}"`);
    values.push(sanitizedValue);
  });

  return { columns, values };
};

const getTableMetadata = async (possibleNames = []) => {
  if (!Array.isArray(possibleNames) || possibleNames.length === 0) {
    throw new Error('No se proporcionaron nombres de tabla para resolver.');
  }

  const { rows: tableRows } = await pool.query(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY($1::text[])
   ORDER BY array_position($1::text[], table_name)
      LIMIT 1`,
    [possibleNames]
  );

  if (tableRows.length === 0) {
    throw new Error(`No se encontró ninguna tabla válida entre: ${possibleNames.join(', ')}`);
  }

  const tableName = tableRows[0].table_name;

  const { rows: columnRows } = await pool.query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1`,
    [tableName]
  );

  return {
    tableName,
    validColumns: new Set(columnRows.map((row) => row.column_name)),
  };
};

// Ruta protegida para registrar clientes
app.post('/api/clientes', verifyJWT, async (req, res) => {
  const payload = req.body || {};
  try {
    const { tableName, validColumns } = await getTableMetadata(['clientes']);
    const { columns, values } = buildInsertParts(payload, validColumns);
    if (columns.length === 0) {
      return res.status(400).json({ ok: false, error: 'No se recibieron campos válidos para registrar al cliente.' });
    }
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const insertQuery = `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(insertQuery, values);
    return res.status(201).json({ ok: true, cliente: result.rows[0] });
  } catch (error) {
    console.error('Error al registrar cliente:', error);
    return res.status(500).json({ ok: false, error: 'Error al registrar el cliente en la base de datos.', details: error.message });
  }
});

// Ruta para registrar vehículos (Nota: No está protegida con JWT)
app.post('/api/vehiculos', async (req, res) => {
  const payload = req.body || {};
  try {
    const { tableName, validColumns } = await getTableMetadata(['vehiculos', 'vehículos']);
    const { columns, values } = buildInsertParts(payload, validColumns);
    if (columns.length === 0) {
      return res.status(400).json({ ok: false, error: 'No se recibieron campos válidos para registrar el vehículo.' });
    }
    const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');
    const insertQuery = `INSERT INTO "${tableName}" (${columns.join(', ')}) VALUES (${placeholders}) RETURNING *`;
    const result = await pool.query(insertQuery, values);
    return res.status(201).json({ ok: true, vehiculo: result.rows[0] });
  } catch (error) {
    console.error('Error al registrar vehículo:', error);
    return res.status(500).json({ ok: false, error: 'Error al registrar el vehículo en la base de datos.', details: error.message });
  }
});

// Ruta de test para la base de datos
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ ok: true, now: result.rows[0].now });
  } catch (error) {
    console.error('Error en /api/db-test:', error);
    res.status(500).json({ ok: false, error: 'Error conectando a Neon', details: error.message });
  }
});


// --- Lógica para Producción ---
// Este bloque solo se ejecuta cuando el servidor está en modo producción
if (process.env.NODE_ENV === 'production') {
    // 1. Define la ruta a la carpeta de build del frontend
    const frontendDistPath = path.resolve(__dirname, '..', 'frontend', 'dist');
    
    // 2. Sirve los archivos estáticos (CSS, JS, imágenes) desde esa carpeta
    app.use(express.static(frontendDistPath));

    // 3. Para cualquier otra petición (que no sea a la API), envía el index.html
    // Esto es clave para que el enrutamiento del lado del cliente (SPA) funcione.
    app.get('*', (req, res) => {
        res.sendFile(path.join(frontendDistPath, 'index.html'));
    });
}

// --- Iniciar Servidor ---
app.listen(port, () => {
  console.log(`🚀 Servidor escuchando en http://localhost:${port}`);
  if (process.env.NODE_ENV !== 'production') {
      console.log('-> Modo de Desarrollo: El backend solo funciona como API.');
      console.log('-> El frontend debe correr en su propio servidor (Vite).');
  } else {
      console.log('-> Modo de Producción: Sirviendo API y archivos del frontend desde /frontend/dist.');
  }
});
