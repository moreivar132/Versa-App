// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
const authRouter = require('./routes/auth');
const superAdminRouter = require('./routes/superAdminRoutes');
const proveedoresRouter = require('./routes/proveedores');
const clientesRouter = require('./routes/clientes');
const vehiculosRouter = require('./routes/vehiculos');
const verifyJWT = require('./middleware/auth');

const app = express();
const port = process.env.PORT || 3000;

// --- Middlewares ---
app.use(cors());
app.use(express.json());

// Rutas de autenticación
app.use('/api/auth', authRouter);
app.use('/api/admin', superAdminRouter);
app.use('/api/proveedores', proveedoresRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/vehiculos', vehiculosRouter);
app.use('/api/citas', require('./routes/citas'));
app.use('/api/inventory', require('./routes/inventory'));
app.use('/api/sucursales', require('./routes/sucursales'));
app.use('/api/compras', require('./routes/compras'));
app.use('/api/ordenes', require('./routes/ordenes'));
app.use('/api/impuestos', require('./routes/impuestos'));
app.use('/api/ordenpago', require('./routes/ordenPago'));

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
  app.use((req, res) => {
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
