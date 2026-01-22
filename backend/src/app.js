/**
 * Express Application Factory
 * 
 * Exporta la aplicación Express configurada SIN iniciar el servidor.
 * Esto permite:
 * - Tests con supertest sin abrir puerto
 * - Reutilización en diferentes entornos
 * 
 * Para producción/desarrollo, usar index.js que importa esto y hace app.listen()
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const pool = require('../db');

// --- Routers ---
const authRouter = require('../routes/auth');
const superAdminRouter = require('../routes/superAdminRoutes');
const proveedoresRouter = require('../routes/proveedores');
const clientesRouter = require('./modules/clientes/api/clientes.routes');
const vehiculosRouter = require('./modules/vehiculos/api/vehiculos.routes');
const verifyJWT = require('../middleware/auth');

// --- Core Middlewares (Observabilidad) ---
const { requestIdMiddleware } = require('./core/http/middlewares/request-id');
const { errorHandler, notFoundHandler } = require('./core/http/middlewares/error-handler');
const { tenantContextMiddleware } = require('./core/http/middlewares/tenant-context');
const logger = require('./core/logging/logger');

// --- Swagger/OpenAPI Documentation ---
const swaggerUi = require('swagger-ui-express');
const { swaggerSpec } = require('./core/docs/swagger');

// Middleware combinado para rutas privadas: auth + tenant context
const privateRoute = [verifyJWT, tenantContextMiddleware()];

/**
 * Crea y configura la aplicación Express
 * @returns {express.Application}
 */
function createApp() {
    const app = express();

    // --- Middlewares ---
    app.use(cors());

    // --- API DOCUMENTATION (Swagger) ---
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customSiteTitle: 'VERSA API Docs',
        customCss: '.swagger-ui .topbar { display: none }'
    }));
    app.get('/api-docs.json', (req, res) => {
        res.setHeader('Content-Type', 'application/json');
        res.send(swaggerSpec);
    });

    // REQUEST ID: Primero de todo para trazabilidad
    app.use(requestIdMiddleware);

    // IMPORTANTE: El webhook de Stripe debe ir ANTES de express.json()
    app.use('/api/stripe/webhook', require('../routes/stripeWebhook'));

    // Parser JSON
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
    const { customerAuth } = require('../middleware/customerAuth');
    app.use('/api/portal', require('../routes/portalCitas'));
    app.use('/api/portal/notificaciones', require('../routes/portalNotificaciones'));
    app.use('/api/cliente/auth', require('../routes/customerAuth'));
    app.use('/api/cliente', customerAuth, require('../routes/customerPortal'));
    app.use('/api/cliente/payment-methods', require('../routes/customerPaymentMethods'));

    // --- Rutas principales ---
    app.use('/api/auth', authRouter);
    app.use('/api/admin', superAdminRouter);

    // Módulo Contable V2 (NEW - Priority)
    console.log('[App] Registrando módulo contable en /api/contabilidad');
    app.use('/api/contabilidad', require('./modules/contable/api/contabilidad.routes'));
    app.use('/api/me', require('../routes/meRoutes'));
    app.use('/api/access', require('../routes/accessRoutes'));
    app.use('/api/proveedores', proveedoresRouter);
    app.use('/api/clientes', clientesRouter);
    app.use('/api/vehiculos', vehiculosRouter);
    app.use('/api/citas', require('../routes/citas'));
    app.use('/api/inventory', require('../routes/inventory'));
    app.use('/api/sucursales', require('../routes/sucursales'));
    app.use('/api/compras', require('../routes/compras'));
    app.use('/api/chat', require('../routes/chat'));
    app.use('/api/crm/chat', require('../routes/crm_chat'));
    app.use('/api/upload', require('../routes/upload'));
    app.use('/api/whatsapp', require('../routes/whatsapp'));
    app.use('/api/stripe', require('../routes/stripe'));
    app.use('/api/subscriptions', require('../routes/subscriptions'));
    app.use('/api/billing', require('../routes/billingRoutes'));
    app.use('/api/ordenes', require('../routes/ordenes'));
    app.use('/api/ordenpago', require('../routes/ordenPago'));
    app.use('/api/medio-pago', require('../routes/medioPago'));
    app.use('/api/impuestos', require('../routes/impuestos'));
    app.use('/api/caja', require('../routes/caja'));
    app.use('/api/tecnicos', require('../routes/tecnicos'));
    app.use('/api/trabajadores', require('../routes/trabajadores'));
    app.use('/api/facturas', require('../routes/facturas'));
    app.use('/api/cuentas-corrientes', require('../routes/cuentasCorrientes'));

    // Módulo Ventas (MIGRADO)
    app.use('/api/ventas', require('./modules/ventas/api/ventas.routes'));

    // Módulo Contable V2 - MOVED UP

    app.use('/api/income-events', privateRoute, require('../routes/incomeEvents'));
    app.use('/api/dashboard', privateRoute, require('../routes/dashboardPrefs'));

    // Marketplace
    app.use('/api/marketplace', require('../routes/marketplace'));
    app.use('/api/marketplace/admin', privateRoute, require('../routes/marketplaceAdmin'));

    // Marketing
    app.use('/api/marketing/email', privateRoute, require('../routes/marketingEmail'));
    app.use('/api/marketing/campaigns', privateRoute, require('../routes/emailCampaign'));

    // Fidelización
    app.use('/api/public/fidelizacion', require('../routes/fidelizacionPublic'));
    app.use('/api/admin/fidelizacion', privateRoute, require('../routes/fidelizacionAdmin'));

    // Open Banking
    app.use('/api/open-banking', require('../routes/openBankingRoutes'));

    // Uploads estáticos
    app.use('/api/uploads', express.static(path.join(__dirname, '..', 'uploads')));

    // Health check
    app.get('/api/health', (req, res) => {
        res.json({ ok: true, timestamp: new Date().toISOString() });
    });

    app.get('/api/db-test', async (req, res) => {
        try {
            const result = await pool.query('SELECT NOW() AS now');
            res.json({ ok: true, now: result.rows[0].now });
        } catch (error) {
            console.error('Error en /api/db-test:', error);
            res.status(500).json({ ok: false, error: 'Error conectando a DB', details: error.message });
        }
    });

    // --- ERROR HANDLERS ---
    if (process.env.NODE_ENV !== 'production') {
        app.use('/api', notFoundHandler);
    }
    app.use(errorHandler);

    return app;
}

// Crear instancia por defecto
const app = createApp();

module.exports = { app, createApp };
