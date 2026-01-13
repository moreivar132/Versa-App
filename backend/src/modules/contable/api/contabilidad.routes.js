/**
 * Contabilidad Routes
 * Router principal del módulo de contabilidad
 * Monta sub-routers y aplica RBAC
 */

const express = require('express');
const router = express.Router();
const verifyJWT = require('../../../middleware/auth');
const { requirePermission } = require('../../../middleware/rbac');

// Controllers
const dashboardController = require('./controllers/dashboard.controller');
const facturasController = require('./controllers/facturas.controller');
const contactosController = require('./controllers/contactos.controller');
const pagosController = require('./controllers/pagos.controller');
const trimestresController = require('./controllers/trimestres.controller');
const categoriasController = require('./controllers/categorias.controller');

// Todas las rutas requieren autenticación
router.use(verifyJWT);

// ===================================================================
// DASHBOARD
// ===================================================================

/**
 * GET /api/contabilidad/dashboard
 * Obtiene KPIs del dashboard contable
 */
router.get('/dashboard',
    requirePermission('contabilidad.read'),
    dashboardController.getDashboard
);

// ===================================================================
// FACTURAS
// ===================================================================

/**
 * GET /api/contabilidad/facturas
 * Lista facturas con filtros
 */
router.get('/facturas',
    requirePermission('contabilidad.read'),
    facturasController.list
);

/**
 * GET /api/contabilidad/facturas/:id
 * Obtiene detalle de factura
 */
router.get('/facturas/:id',
    requirePermission('contabilidad.read'),
    facturasController.getById
);

/**
 * POST /api/contabilidad/facturas
 * Crea factura manual
 */
router.post('/facturas',
    requirePermission('contabilidad.write'),
    facturasController.create
);

/**
 * PATCH /api/contabilidad/facturas/:id
 * Actualiza factura
 */
router.patch('/facturas/:id',
    requirePermission('contabilidad.write'),
    facturasController.update
);

/**
 * DELETE /api/contabilidad/facturas/:id
 * Elimina factura (soft delete)
 */
router.delete('/facturas/:id',
    requirePermission('contabilidad.write'),
    facturasController.remove
);

/**
 * POST /api/contabilidad/facturas/:id/archivo
 * Sube archivo adjunto a factura
 */
router.post('/facturas/:id/archivo',
    requirePermission('contabilidad.write'),
    facturasController.uploadArchivo
);

/**
 * GET /api/contabilidad/facturas/:id/archivos
 * Lista archivos de una factura
 */
router.get('/facturas/:id/archivos',
    requirePermission('contabilidad.read'),
    facturasController.listArchivos
);

// ===================================================================
// PAGOS
// ===================================================================

/**
 * POST /api/contabilidad/facturas/:id/pagos
 * Registra pago contra factura
 */
router.post('/facturas/:id/pagos',
    requirePermission('contabilidad.write'),
    pagosController.registrarPago
);

/**
 * GET /api/contabilidad/facturas/:id/pagos
 * Lista pagos de una factura
 */
router.get('/facturas/:id/pagos',
    requirePermission('contabilidad.read'),
    pagosController.listByFactura
);

/**
 * DELETE /api/contabilidad/pagos/:id
 * Elimina pago
 */
router.delete('/pagos/:id',
    requirePermission('contabilidad.approve'),
    pagosController.remove
);

// ===================================================================
// CONTACTOS
// ===================================================================

/**
 * GET /api/contabilidad/contactos
 * Lista contactos fiscales
 */
router.get('/contactos',
    requirePermission('contabilidad.read'),
    contactosController.list
);

/**
 * GET /api/contabilidad/contactos/:id
 * Obtiene detalle de contacto
 */
router.get('/contactos/:id',
    requirePermission('contabilidad.read'),
    contactosController.getById
);

/**
 * POST /api/contabilidad/contactos
 * Crea contacto fiscal
 */
router.post('/contactos',
    requirePermission('contabilidad.write'),
    contactosController.create
);

/**
 * PATCH /api/contabilidad/contactos/:id
 * Actualiza contacto
 */
router.patch('/contactos/:id',
    requirePermission('contabilidad.write'),
    contactosController.update
);

/**
 * DELETE /api/contabilidad/contactos/:id
 * Elimina contacto (soft delete)
 */
router.delete('/contactos/:id',
    requirePermission('contabilidad.write'),
    contactosController.remove
);

// ===================================================================
// TRIMESTRES
// ===================================================================

/**
 * GET /api/contabilidad/trimestres
 * Lista trimestres con estado
 */
router.get('/trimestres',
    requirePermission('contabilidad.read'),
    trimestresController.list
);

/**
 * GET /api/contabilidad/trimestres/:anio/:q
 * Obtiene detalle de trimestre
 */
router.get('/trimestres/:anio/:q',
    requirePermission('contabilidad.read'),
    trimestresController.getByPeriod
);

/**
 * POST /api/contabilidad/trimestres/:anio/:q/cerrar
 * Cierra trimestre
 */
router.post('/trimestres/:anio/:q/cerrar',
    requirePermission('contabilidad.approve'),
    trimestresController.cerrar
);

/**
 * POST /api/contabilidad/trimestres/:anio/:q/reabrir
 * Reabre trimestre (solo admin)
 */
router.post('/trimestres/:anio/:q/reabrir',
    requirePermission('contabilidad.admin'),
    trimestresController.reabrir
);

// ===================================================================
// CATEGORÍAS
// ===================================================================

/**
 * GET /api/contabilidad/categorias
 * Lista categorías contables
 */
router.get('/categorias',
    requirePermission('contabilidad.read'),
    categoriasController.list
);

/**
 * POST /api/contabilidad/categorias
 * Crea categoría
 */
router.post('/categorias',
    requirePermission('contabilidad.admin'),
    categoriasController.create
);

/**
 * PATCH /api/contabilidad/categorias/:id
 * Actualiza categoría
 */
router.patch('/categorias/:id',
    requirePermission('contabilidad.admin'),
    categoriasController.update
);

/**
 * DELETE /api/contabilidad/categorias/:id
 * Desactiva categoría
 */
router.delete('/categorias/:id',
    requirePermission('contabilidad.admin'),
    categoriasController.remove
);

// ===================================================================
// REPORTES
// ===================================================================

/**
 * GET /api/contabilidad/reports/iva
 * Resumen IVA por período
 */
router.get('/reports/iva',
    requirePermission('contabilidad.read'),
    dashboardController.getReporteIVA
);

/**
 * GET /api/contabilidad/reports/gastos-categoria
 * Gastos por categoría
 */
router.get('/reports/gastos-categoria',
    requirePermission('contabilidad.read'),
    dashboardController.getGastosPorCategoria
);

module.exports = router;
