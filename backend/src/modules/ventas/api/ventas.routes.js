/**
 * Ventas API Routes
 * Define endpoints del módulo de ventas.
 * 
 * @module ventas
 * @see docs/API.md para guía de documentación
 */

const express = require('express');
const router = express.Router();
const controller = require('./ventas.controller');
const verifyJWT = require('../../../../middleware/auth');
const { tenantContextMiddleware } = require('../../../core/http/middlewares/tenant-context');

// Todas las rutas requieren autenticación + tenant
router.use(verifyJWT);
router.use(tenantContextMiddleware());

// ============================================================
// DOCUMENTACIÓN SWAGGER
// ============================================================

/**
 * @openapi
 * /api/ventas:
 *   post:
 *     tags: [Ventas]
 *     summary: Crear nueva venta
 *     description: |
 *       Crea una venta con líneas de productos y pagos.
 *       Descuenta automáticamente el stock y registra movimientos de caja.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VentaInput'
 *           example:
 *             idSucursal: 1
 *             idCliente: 1
 *             observaciones: "Venta mostrador"
 *             lineas:
 *               - descripcion: "Aceite 5W40"
 *                 cantidad: 2
 *                 precio: 25.00
 *                 iva: 21
 *             pagos:
 *               - codigoMedioPago: "EFECTIVO"
 *                 importe: 60.50
 *     responses:
 *       201:
 *         description: Venta creada exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VentaCreateResponse'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: No autenticado
 *       403:
 *         description: Sin permisos
 *       500:
 *         description: Error interno
 */
router.post('/', controller.create);

/**
 * @openapi
 * /api/ventas:
 *   get:
 *     tags: [Ventas]
 *     summary: Listar ventas
 *     description: Obtiene lista de ventas con filtros y paginación
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: idSucursal
 *         schema:
 *           type: integer
 *         description: Filtrar por sucursal
 *       - in: query
 *         name: idCliente
 *         schema:
 *           type: integer
 *         description: Filtrar por cliente
 *       - in: query
 *         name: fechaDesde
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha inicial (YYYY-MM-DD)
 *       - in: query
 *         name: fechaHasta
 *         schema:
 *           type: string
 *           format: date
 *         description: Fecha final (YYYY-MM-DD)
 *       - in: query
 *         name: estado
 *         schema:
 *           type: string
 *           enum: [COMPLETADA, ANULADA]
 *         description: Filtrar por estado
 *       - in: query
 *         name: busqueda
 *         schema:
 *           type: string
 *         description: Buscar por nombre de cliente o ID de venta
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Cantidad de resultados por página
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Número de resultados a saltar
 *     responses:
 *       200:
 *         description: Lista de ventas
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/VentasListResponse'
 *       401:
 *         description: No autenticado
 */
router.get('/', controller.list);

/**
 * @openapi
 * /api/ventas/{id}:
 *   get:
 *     tags: [Ventas]
 *     summary: Obtener venta por ID
 *     description: Obtiene detalle de una venta incluyendo líneas y pagos
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la venta
 *     responses:
 *       200:
 *         description: Detalle de la venta
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 venta:
 *                   $ref: '#/components/schemas/Venta'
 *                 lineas:
 *                   type: array
 *                   items:
 *                     type: object
 *                 pagos:
 *                   type: array
 *                   items:
 *                     type: object
 *       404:
 *         description: Venta no encontrada
 *       401:
 *         description: No autenticado
 */
router.get('/:id', controller.getById);

/**
 * @openapi
 * /api/ventas/{id}/pdf:
 *   get:
 *     tags: [Ventas]
 *     summary: Generar documento de venta
 *     description: Genera un documento HTML de la venta para impresión
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: ID de la venta
 *     responses:
 *       200:
 *         description: Documento HTML
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *       400:
 *         description: ID inválido
 *       404:
 *         description: Venta no encontrada
 */
router.get('/:id/pdf', controller.getPdf);

/**
 * @openapi
 * /api/ventas/{id}:
 *   put:
 *     tags: [Ventas]
 *     summary: Actualizar venta
 *     description: |
 *       Actualiza una venta existente.
 *       Revierte stock anterior e inserta nuevas líneas.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/VentaInput'
 *     responses:
 *       200:
 *         description: Venta actualizada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 idVenta:
 *                   type: integer
 *                 message:
 *                   type: string
 *       400:
 *         description: No se puede editar venta anulada
 *       404:
 *         description: Venta no encontrada
 */
router.put('/:id', controller.update);

/**
 * @openapi
 * /api/ventas/{id}:
 *   delete:
 *     tags: [Ventas]
 *     summary: Eliminar venta
 *     description: Elimina una venta y revierte el stock
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Venta eliminada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Venta no encontrada
 */
router.delete('/:id', controller.remove);

/**
 * @openapi
 * /api/ventas/{id}/anular:
 *   post:
 *     tags: [Ventas]
 *     summary: Anular venta
 *     description: |
 *       Marca la venta como ANULADA y revierte el stock.
 *       No elimina la venta, solo cambia su estado.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Venta anulada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Venta anulada correctamente
 *       400:
 *         description: La venta ya está anulada
 *       404:
 *         description: Venta no encontrada
 */
router.post('/:id/anular', controller.anular);

module.exports = router;
