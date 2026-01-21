// index.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('./db');
const authRouter = require('./routes/auth');
const superAdminRouter = require('./routes/superAdminRoutes');
const proveedoresRouter = require('./routes/proveedores');
const verifyJWT = require('./middleware/auth');

// --- Google OAuth (Passport.js) ---
const passport = require('./config/passport');
const googleAuthRouter = require('./routes/googleAuth');

// --- Core Middlewares (Observabilidad) ---
const { requestIdMiddleware } = require('./src/core/http/middlewares/request-id');
const { errorHandler, notFoundHandler } = require('./src/core/http/middlewares/error-handler');
const { tenantContextMiddleware } = require('./src/core/http/middlewares/tenant-context');
const logger = require('./src/core/logging/logger');

// --- Swagger/OpenAPI Documentation ---
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./src/core/docs/swagger');

// Middleware combinado para rutas privadas: auth + tenant context
const privateRoute = [verifyJWT, tenantContextMiddleware()];

const app = express();
const port = process.env.PORT || 4000;

console.log('---------------------------------------------------');
console.log('   VERSA BACKEND - Modular V2 (with Contabilidad)   ');
console.log('---------------------------------------------------');

// --- Middlewares ---
app.use(cors());

// --- Passport OAuth Initialization ---
app.use(passport.initialize());

// --- API DOCUMENTATION (Swagger) ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customSiteTitle: 'VERSA API Docs',
  customCss: '.swagger-ui .topbar { display: none }'
}));
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// REQUEST ID
app.use(requestIdMiddleware);

// Stripe Webhook (BEFORE express.json)
app.use('/api/stripe/webhook', require('./routes/stripeWebhook'));

// JSON Parser
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request logging
app.use((req, res, next) => {
  logger.info({
    requestId: req.requestId,
    method: req.method,
    url: req.url
  }, 'Incoming request');
  next();
});

// --- Portal Cliente ---
const { customerAuth } = require('./middleware/customerAuth');
app.use('/api/portal', require('./routes/portalCitas'));
app.use('/api/portal/notificaciones', require('./routes/portalNotificaciones'));
app.use('/api/cliente/auth', require('./routes/customerAuth'));
app.use('/api/cliente/auth', require('./routes/customerGoogleAuth'));  // Customer Google OAuth
app.use('/api/cliente', customerAuth, require('./routes/customerPortal'));
app.use('/api/cliente/payment-methods', require('./routes/customerPaymentMethods'));

// --- Rutas principales / Módulos V2 ---
app.use('/api/auth', authRouter);
app.use('/api/auth', googleAuthRouter);  // Google OAuth routes
app.use('/api/saas/invites', require('./routes/saasInvites'));  // SaaS invite management
app.use('/api/invites', require('./routes/invitePublic'));  // Public invite verify/accept
app.use('/api/admin', privateRoute, superAdminRouter);
app.use('/api/access', privateRoute, require('./routes/accessRoutes'));
app.use('/api/me', require('./routes/meRoutes'));  // User access info (includes own auth)
app.use('/api/proveedores', privateRoute, proveedoresRouter);

// Open Banking & Banking
app.use('/api/open-banking', require('./routes/openBankingRoutes'));
app.use('/api/banking', require('./modules/banking/routes/import.routes'));

// Módulos Migrados
app.use('/api/clientes', privateRoute, require('./src/modules/clientes/api/clientes.routes'));
app.use('/api/vehiculos', privateRoute, require('./src/modules/vehiculos/api/vehiculos.routes'));
app.use('/api/ventas', privateRoute, require('./src/modules/ventas/api/ventas.routes'));

// Contabilidad Module V2
app.use('/api/contabilidad', privateRoute, require('./src/modules/contable/api/contabilidad.routes'));

// FinSaaS Admin RBAC (Tenant admin only)
app.use('/api/finsaas/admin/rbac', require('./routes/finsaasRbac.routes'));

// Otras rutas legacy / utilidades
app.use('/api/citas', privateRoute, require('./routes/citas'));
app.use('/api/inventory', privateRoute, require('./routes/inventory'));
app.use('/api/sucursales', privateRoute, require('./routes/sucursales'));
app.use('/api/compras', privateRoute, require('./routes/compras'));
app.use('/api/chat', privateRoute, require('./routes/chat'));
app.use('/api/crm/chat', privateRoute, require('./routes/crm_chat'));
app.use('/api/upload', privateRoute, require('./routes/upload'));
app.use('/api/whatsapp', privateRoute, require('./routes/whatsapp'));
app.use('/api/stripe', privateRoute, require('./routes/stripe'));
app.use('/api/subscriptions', privateRoute, require('./routes/subscriptions'));
app.use('/api/billing', privateRoute, require('./routes/billingRoutes'));
app.use('/api/ordenes', privateRoute, require('./routes/ordenes'));
app.use('/api/ordenpago', privateRoute, require('./routes/ordenPago'));
app.use('/api/medio-pago', privateRoute, require('./routes/medioPago'));
app.use('/api/impuestos', privateRoute, require('./routes/impuestos'));
app.use('/api/caja', privateRoute, require('./routes/caja'));
app.use('/api/tecnicos', privateRoute, require('./routes/tecnicos'));
app.use('/api/trabajadores', privateRoute, require('./routes/trabajadores'));
app.use('/api/facturas', privateRoute, require('./routes/facturas'));
app.use('/api/cuentas-corrientes', privateRoute, require('./routes/cuentasCorrientes'));
app.use('/api/income-events', privateRoute, require('./routes/incomeEvents'));
app.use('/api/dashboard', privateRoute, require('./routes/dashboardPrefs'));

// Marketplace
app.use('/api/marketplace', require('./routes/marketplace'));
app.use('/api/marketplace/admin', privateRoute, require('./routes/marketplaceAdmin'));

// Marketing
app.use('/api/marketing/email', privateRoute, require('./routes/marketingEmail'));
app.use('/api/marketing/campaigns', privateRoute, require('./routes/emailCampaign'));

// Fidelización
app.use('/api/public/fidelizacion', require('./routes/fidelizacionPublic'));
app.use('/api/admin/fidelizacion', privateRoute, require('./routes/fidelizacionAdmin'));

// Static Uploads
app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check / DB status
app.get('/api/health', (req, res) => res.json({ ok: true, timestamp: new Date().toISOString() }));
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW() AS now');
    res.json({ ok: true, now: result.rows[0].now });
  } catch (error) {
    console.error('Error en /api/db-test:', error);
    res.status(500).json({ ok: false, error: 'Error conectando a DB', details: error.message });
  }
});

// --- Error Handlers ---
if (process.env.NODE_ENV !== 'production') {
  app.use('/api', notFoundHandler);
}
app.use(errorHandler);

// Production Static Serving
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.resolve(__dirname, '..', 'frontend', 'dist');
  app.use(express.static(frontendDistPath));
  app.use((req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// Start Server
app.listen(port, '0.0.0.0', () => {
  console.log(`🚀 Servidor escuchando en http://0.0.0.0:${port}`);
});
