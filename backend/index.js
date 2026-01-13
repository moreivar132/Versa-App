// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
const authRouter = require('./routes/auth');
const superAdminRouter = require('./routes/superAdminRoutes');
const proveedoresRouter = require('./routes/proveedores');
// LEGACY (movidos a legacy/backend/) - ahora usamos módulos V2
// const clientesRouter = require('./routes/clientes');
// const vehiculosRouter = require('./routes/vehiculos');
const clientesRouterV2 = require('./src/modules/clientes/api/clientes.routes');
const vehiculosRouterV2 = require('./src/modules/vehiculos/api/vehiculos.routes');
const verifyJWT = require('./middleware/auth');

// --- Core Middlewares (Observabilidad) ---
const { requestIdMiddleware } = require('./src/core/http/middlewares/request-id');
const { errorHandler, notFoundHandler } = require('./src/core/http/middlewares/error-handler');
const { tenantContextMiddleware, getTenantId } = require('./src/core/http/middlewares/tenant-context');
const logger = require('./src/core/logging/logger');

// --- Swagger/OpenAPI Documentation ---
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./src/core/docs/swagger');

// Middleware combinado para rutas privadas: auth + tenant context
// Uso: app.use('/api/ruta-privada', privateRoute, require('./routes/...'))
const privateRoute = [verifyJWT, tenantContextMiddleware()];

const app = express();
const port = process.env.PORT || 4000;

console.log('---------------------------------------------------');
console.log('   VERSA BACKEND - VERSION CHECK: v2026.01.07.2      ');
console.log('   (If you do not see this, code is OLD)             ');
console.log('---------------------------------------------------');

// --- Middlewares ---
app.use(cors());

// --- API DOCUMENTATION (Swagger) ---
// Acceder a /api-docs para ver la documentación interactiva
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'VERSA API Docs',
  customCss: '.swagger-ui .topbar { display: none }'
}));
// Endpoint JSON para integraciones
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// REQUEST ID: Primero de todo para trazabilidad
app.use(requestIdMiddleware);

// IMPORTANTE: El webhook de Stripe debe ir ANTES de express.json()
// porque necesita acceso al raw body para verificar la firma
app.use('/api/stripe/webhook', require('./routes/stripeWebhook'));

// Ahora sí, aplicar el parser JSON para el resto de rutas
// Límite aumentado para permitir subida de imágenes en base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging (usa el logger estructurado con requestId)
app.use((req, res, next) => {
  logger.info({
    requestId: req.requestId,
    method: req.method,
    url: req.url
  }, 'Incoming request');
  next();
});

console.log('Customer Portal Routes loading...');
const { customerAuth, customerAuthOptional } = require('./middleware/customerAuth');

// --- RUTAS PRIORITARIAS DEL PORTAL ---
app.use('/api/portal', require('./routes/portalCitas')); // Portal cliente (Citas/Perfil)
app.use('/api/portal/notificaciones', require('./routes/portalNotificaciones')); // Notificaciones
app.use('/api/cliente/auth', require('./routes/customerAuth'));
app.use('/api/cliente', customerAuth, require('./routes/customerPortal'));
app.use('/api/cliente/payment-methods', require('./routes/customerPaymentMethods')); // Payment Methods (Stripe)

// Rutas de autenticación general
app.use('/api/auth', authRouter);
app.use('/api/admin', superAdminRouter);
app.use('/api/access', require('./routes/accessRoutes')); // RBAC Access Management
app.use('/api/proveedores', proveedoresRouter);
// Usando módulos V2 (mismos endpoints, nueva arquitectura)
app.use('/api/clientes', clientesRouterV2);
app.use('/api/vehiculos', vehiculosRouterV2);
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
app.use('/api/billing', require('./routes/billingRoutes'));
app.use('/api/ordenes', require('./routes/ordenes'));
app.use('/api/ordenpago', require('./routes/ordenPago'));
app.use('/api/medio-pago', require('./routes/medioPago'));
app.use('/api/impuestos', require('./routes/impuestos'));
app.use('/api/caja', require('./routes/caja'));
app.use('/api/tecnicos', require('./routes/tecnicos'));
app.use('/api/trabajadores', require('./routes/trabajadores'));
app.use('/api/facturas', require('./routes/facturas'));
app.use('/api/cuentas-corrientes', require('./routes/cuentasCorrientes'));
app.use('/api/ventas', require('./src/modules/ventas/api/ventas.routes')); // MIGRADO a modular
app.use('/api/income-events', privateRoute, require('./routes/incomeEvents'));
app.use('/api/dashboard', privateRoute, require('./routes/dashboardPrefs'));

// Contabilidad Module (V3 - Facturas, Pagos, Trimestres, IVA)
app.use('/api/contabilidad', privateRoute, require('./src/modules/contable/api/contabilidad.routes'));


// Marketplace routes (público y admin)
app.use('/api/marketplace', require('./routes/marketplace'));
app.use('/api/marketplace/admin', privateRoute, require('./routes/marketplaceAdmin'));

// Marketing / Email Automations (admin)
app.use('/api/marketing/email', privateRoute, require('./routes/marketingEmail'));
app.use('/api/marketing/campaigns', privateRoute, require('./routes/emailCampaign'));

// Fidelización - Public (tarjeta wallet, sin auth)
app.use('/api/public/fidelizacion', require('./routes/fidelizacionPublic'));

// Fidelización - Admin (gestión miembros/puntos/promos, con JWT)
app.use('/api/admin/fidelizacion', privateRoute, require('./routes/fidelizacionAdmin'));

// Open Banking (TrueLayer Data API)
app.use('/api/open-banking', require('./routes/openBankingRoutes'));

// Customer Portal routes (Moved to top)
// const { customerAuth, customerAuthOptional } = require('./middleware/customerAuth');
// app.use('/api/cliente/auth', require('./routes/customerAuth'));
// app.use('/api/cliente', customerAuth, require('./routes/customerPortal'));

// Portal Citas - Nuevos endpoints (Moved to top)
// app.use('/api/portal', require('./routes/portalCitas'));

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

// --- ERROR HANDLERS (deben ir DESPUÉS de todas las rutas) ---
// 404 para rutas API no encontradas (solo en desarrollo, producción sirve SPA)
if (process.env.NODE_ENV !== 'production') {
  app.use('/api', notFoundHandler);
}
// Error handler global centralizado
app.use(errorHandler);

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
