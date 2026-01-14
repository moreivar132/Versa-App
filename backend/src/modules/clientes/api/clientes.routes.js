/**
 * Clientes Routes
 * 
 * Rutas HTTP para el módulo de clientes.
 * MANTIENE LOS MISMOS ENDPOINTS que el legacy para compatibilidad.
 */

const express = require('express');
const router = express.Router();
const controller = require('./clientes.controller');
const verifyJWT = require('../../../../middleware/auth');
const { requirePermission: checkPermission } = require('../../../../middleware/rbac');

// Todas las rutas requieren autenticación
router.use(verifyJWT);

/**
 * @route GET /api/clientes/search
 * @desc Buscar clientes por término
 * @access Private (CLIENTES_READ)
 */
router.get('/search', checkPermission('clientes.read'), controller.buscarClientes);

/**
 * @route GET /api/clientes/count
 * @desc Contar total de clientes
 * @access Private (CLIENTES_READ)
 */
router.get('/count', checkPermission('clientes.read'), controller.contarClientes);

/**
 * @route GET /api/clientes/:id
 * @desc Obtener cliente por ID
 * @access Private (CLIENTES_READ)
 */
router.get('/:id', checkPermission('clientes.read'), controller.obtenerCliente);

/**
 * @route GET /api/clientes
 * @desc Listar últimos 3 clientes
 * @access Private (CLIENTES_READ)
 */
router.get('/', checkPermission('clientes.read'), controller.listarClientes);

/**
 * @route POST /api/clientes
 * @desc Crear nuevo cliente
 * @access Private (CLIENTES_WRITE)
 */
router.post('/', checkPermission('clientes.write'), controller.crearCliente);

/**
 * @route PUT /api/clientes/:id
 * @desc Actualizar cliente existente
 * @access Private (CLIENTES_WRITE)
 */
router.put('/:id', checkPermission('clientes.write'), controller.actualizarCliente);

module.exports = router;
