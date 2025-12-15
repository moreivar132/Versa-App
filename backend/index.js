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

// IMPORTANTE: El webhook de Stripe debe ir ANTES de express.json()
// porque necesita acceso al raw body para verificar la firma
app.use('/api/stripe/webhook', require('./routes/stripeWebhook'));

// Ahora sí, aplicar el parser JSON para el resto de rutas
app.use(express.json());

// Logger Middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

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
app.use('/api/chat', require('./routes/chat'));
app.use('/api/crm/chat', require('./routes/crm_chat'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/stripe', require('./routes/stripe'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/ordenes', require('./routes/ordenes'));
app.use('/api/ordenpago', require('./routes/ordenPago'));
app.use('/api/medio-pago', require('./routes/medioPago'));
app.use('/api/impuestos', require('./routes/impuestos'));
app.use('/api/caja', require('./routes/caja'));
app.use('/api/tecnicos', require('./routes/tecnicos'));
app.use('/api/trabajadores', require('./routes/trabajadores'));
app.use('/api/facturas', require('./routes/facturas'));
app.use('/api/cuentas-corrientes', require('./routes/cuentasCorrientes'));

// Servir archivos estáticos subidos (ahora bajo /api/uploads para consistencia)
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor escuchando en http://0.0.0.0:${port}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log('-> Modo de Desarrollo: El backend solo funciona como API.');
    console.log('-> El frontend debe correr en su propio servidor (Vite).');
  } else {
    console.log('-> Modo de Producción: Sirviendo API y archivos del frontend desde /frontend/dist.');
  }
});
