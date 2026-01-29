/**
 * Contabilidad Routes
 * Router principal del módulo de contabilidad
 * Monta sub-routers y aplica RBAC
 */

const express = require('express');
const router = express.Router();
const verifyJWT = require('../../../../middleware/auth');
const { requirePermission } = require('../../../../middleware/rbac');
const { getTenantDb } = require('../../../../src/core/db/tenant-db');
const { tenantContextMiddleware } = require('../../../../src/core/http/middlewares/tenant-context');

// Controllers
const dashboardController = require('./controllers/dashboard.controller');
const facturasController = require('./controllers/facturas.controller');
const contactosController = require('./controllers/contactos.controller');
const pagosController = require('./controllers/pagos.controller');
const trimestresController = require('./controllers/trimestres.controller');
const categoriasController = require('./controllers/categorias.controller');
const empresaController = require('./controllers/empresa.controller');
const tesoreriaController = require('./controllers/tesoreria.controller');
const fiscalProfileController = require('./controllers/fiscalProfile.controller');
const copilotoController = require('./controllers/copiloto.controller');
const deducibleController = require('./controllers/deducible.controller');

// Test route (Sanity check)
router.get('/ping', (req, res) => res.json({ ok: true, message: 'pong', timestamp: new Date().toISOString() }));

// Egresos controller (OCR via OpenAI - synchronous)
const egresosController = require('./controllers/egresos.controller');

// Documentos controller (Biblioteca de Facturas)
const documentosController = require('./controllers/documentos.controller');

// Todas las rutas siguientes requieren autenticación
router.use(verifyJWT);
router.use(tenantContextMiddleware());

// Inject Tenant DB
router.use((req, res, next) => {
    try {
        req.db = getTenantDb(req.ctx); // Usa el contexto estandarizado
        next();
    } catch (err) {
        console.error('Error injecting Tenant DB:', err);
        res.status(500).json({ error: 'Database context error' });
    }
});


// ===================================================================
// DASHBOARD
// ===================================================================

router.get('/dashboard',
    requirePermission('contabilidad.read'),
    dashboardController.getDashboard
);

// ===================================================================
// FACTURAS
// ===================================================================

router.get('/facturas',
    requirePermission('contabilidad.read'),
    facturasController.list
);

// Export invoices to CSV - MUST be before :id route!
router.get('/facturas/export.csv',
    requirePermission('contabilidad.export'),
    deducibleController.exportCSV
);

router.get('/facturas/:id',
    requirePermission('contabilidad.read'),
    facturasController.getById
);

router.post('/facturas',
    requirePermission('contabilidad.write'),
    facturasController.create
);

router.patch('/facturas/:id',
    requirePermission('contabilidad.write'),
    facturasController.update
);

router.delete('/facturas/:id',
    requirePermission('contabilidad.write'),
    facturasController.remove
);

router.post('/facturas/:id/archivo',
    requirePermission('contabilidad.write'),
    facturasController.uploadArchivo
);

router.get('/facturas/:id/archivos',
    requirePermission('contabilidad.read'),
    facturasController.listArchivos
);

// ===================================================================
// DEDUCIBLE VALIDATION (Validación Fiscal)
// ===================================================================

// Update deducible status - TENANT_ADMIN only
router.patch('/facturas/:id/deducible',
    requirePermission('contabilidad.deducible.approve'),
    deducibleController.updateDeducibleStatus
);

// Get deducible change history for a specific invoice
router.get('/facturas/:id/deducible/history',
    requirePermission('contabilidad.read'),
    deducibleController.getDeducibleHistory
);

// ===================================================================
// DOCUMENTOS (Biblioteca de Facturas)
// ===================================================================

router.get('/documentos',
    requirePermission('contabilidad.read'),
    documentosController.list
);

router.get('/documentos/:facturaId/archivo',
    requirePermission('contabilidad.read'),
    documentosController.serveArchivo
);

router.get('/documentos/intake/:intakeId/archivo',
    requirePermission('contabilidad.read'),
    documentosController.serveIntakeArchivo
);

// ===================================================================
// PAGOS
// ===================================================================

router.post('/facturas/:id/pagos',
    requirePermission('contabilidad.write'),
    pagosController.registrarPago
);

router.get('/facturas/:id/pagos',
    requirePermission('contabilidad.read'),
    pagosController.listByFactura
);

router.delete('/pagos/:id',
    requirePermission('contabilidad.approve'),
    pagosController.remove
);

// ===================================================================
// CONTACTOS
// ===================================================================

router.get('/contactos',
    requirePermission('contabilidad.read'),
    contactosController.list
);

// Find contact by NIF/CIF - MUST be before :id route
router.get('/contactos/by-nif/:nif',
    requirePermission('contabilidad.read'),
    contactosController.findByNif
);

router.get('/contactos/:id',
    requirePermission('contabilidad.read'),
    contactosController.getById
);

router.post('/contactos',
    requirePermission('contabilidad.write'),
    contactosController.create
);

router.patch('/contactos/:id',
    requirePermission('contabilidad.write'),
    contactosController.update
);

router.delete('/contactos/:id',
    requirePermission('contabilidad.write'),
    contactosController.remove
);

// ===================================================================
// TRIMESTRES
// ===================================================================

router.get('/trimestres',
    requirePermission('contabilidad.read'),
    trimestresController.list
);

router.get('/trimestres/:anio/:q',
    requirePermission('contabilidad.read'),
    trimestresController.getByPeriod
);

router.post('/trimestres/:anio/:q/cerrar',
    requirePermission('contabilidad.approve'),
    trimestresController.cerrar
);

router.post('/trimestres/:anio/:q/reabrir',
    requirePermission('contabilidad.admin'),
    trimestresController.reabrir
);

// ===================================================================
// CATEGORÍAS
// ===================================================================

router.get('/categorias',
    requirePermission('contabilidad.read'),
    categoriasController.list
);

router.post('/categorias',
    requirePermission('contabilidad.admin'),
    categoriasController.create
);

router.patch('/categorias/:id',
    requirePermission('contabilidad.admin'),
    categoriasController.update
);

router.delete('/categorias/:id',
    requirePermission('contabilidad.admin'),
    categoriasController.remove
);

// ===================================================================
// REPORTES
// ===================================================================

router.get('/reports/iva',
    requirePermission('contabilidad.read'),
    dashboardController.getReporteIVA
);

router.get('/reports/gastos-categoria',
    requirePermission('contabilidad.read'),
    dashboardController.getGastosPorCategoria
);

router.get('/reports/evolucion',
    requirePermission('contabilidad.read'),
    dashboardController.getEvolucionFinanciera
);

// ===================================================================
// EMPRESAS (Multi-Tenant)
// ===================================================================

router.get('/empresas',
    requirePermission('contabilidad.empresa.read'),
    empresaController.list
);

router.get('/empresas/:id',
    requirePermission('contabilidad.empresa.read'),
    empresaController.getById
);

router.post('/empresas',
    requirePermission('finsaas.empresa.manage'),  // TENANT_ADMIN only
    empresaController.create
);

router.patch('/empresas/:id',
    requirePermission('contabilidad.empresa.write'),
    empresaController.update
);

router.delete('/empresas/:id',
    requirePermission('finsaas.empresa.manage'),  // TENANT_ADMIN only
    empresaController.remove
);

router.get('/empresas/:id/usuarios',
    requirePermission('contabilidad.empresa.read'),
    empresaController.listUsuarios
);

router.post('/empresas/:id/usuarios',
    requirePermission('contabilidad.empresa.write'),
    empresaController.addUsuario
);

router.delete('/empresas/:id/usuarios/:userId',
    requirePermission('contabilidad.empresa.write'),
    empresaController.removeUsuario
);

// Fiscal Configuration
router.get('/empresas/:id/fiscal-config',
    requirePermission('contabilidad.empresa.read'),
    fiscalProfileController.getFiscalConfig
);

router.post('/empresas/:id/fiscal-config',
    requirePermission('contabilidad.empresa.write'),
    fiscalProfileController.upsertFiscalConfig
);

// ===================================================================
// TESORERÍA
// ===================================================================

router.get('/tesoreria/cuentas',
    requirePermission('contabilidad.tesoreria.read'),
    tesoreriaController.listCuentas
);

router.post('/tesoreria/cuentas',
    requirePermission('contabilidad.tesoreria.write'),
    tesoreriaController.createCuenta
);

router.patch('/tesoreria/cuentas/:id',
    requirePermission('contabilidad.tesoreria.write'),
    tesoreriaController.updateCuenta
);

router.get('/tesoreria/transacciones',
    requirePermission('contabilidad.tesoreria.read'),
    tesoreriaController.listTransacciones
);

router.post('/tesoreria/transacciones',
    requirePermission('contabilidad.tesoreria.write'),
    tesoreriaController.createTransaccion
);

router.delete('/tesoreria/transacciones/:id',
    requirePermission('contabilidad.tesoreria.write'),
    tesoreriaController.removeTransaccion
);

router.get('/tesoreria/cashflow',
    requirePermission('contabilidad.tesoreria.read'),
    tesoreriaController.getCashflow
);

// ===================================================================
// EGRESOS (Facturas de Gasto con OCR/IA)
// ===================================================================



// Intakes - Procesamiento OCR
router.post('/egresos/intakes',
    requirePermission('contabilidad.write'),
    egresosController.createIntake
);

router.get('/egresos/intakes/:id',
    requirePermission('contabilidad.read'),
    egresosController.getIntake
);

router.delete('/egresos/intakes/:id',
    requirePermission('contabilidad.write'),
    egresosController.deleteIntake
);

// Gastos
router.get('/egresos',
    requirePermission('contabilidad.read'),
    egresosController.listGastos
);

router.post('/egresos',
    requirePermission('contabilidad.write'),
    egresosController.createGasto
);

// ===================================================================
// COPILOTO IA
// ===================================================================

// Chat con copiloto
router.post('/copiloto/chat',
    requirePermission('copiloto.read'),
    copilotoController.chat
);

// Insights automáticos
router.get('/copiloto/insights',
    requirePermission('copiloto.read'),
    copilotoController.getInsights
);

// Alertas
router.get('/copiloto/alerts',
    requirePermission('copiloto.read'),
    copilotoController.listAlerts
);

router.post('/copiloto/alerts',
    requirePermission('copiloto.write'),
    copilotoController.createAlertRule
);

router.patch('/copiloto/alerts/:id',
    requirePermission('copiloto.write'),
    copilotoController.updateAlert
);

// Sesiones de chat
router.get('/copiloto/sessions',
    requirePermission('copiloto.read'),
    copilotoController.listSessions
);

router.get('/copiloto/sessions/:id/messages',
    requirePermission('copiloto.read'),
    copilotoController.getSessionMessages
);

// Callback de Make ya está registrado ANTES del middleware de auth (línea ~28)

module.exports = router;
