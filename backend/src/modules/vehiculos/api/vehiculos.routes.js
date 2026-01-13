/**
 * Vehículos Routes
 */

const express = require('express');
const router = express.Router();
const controller = require('./vehiculos.controller');
const verifyJWT = require('../../../../middleware/auth');
const { checkPermission } = require('../../../core/http/middlewares/rbac');

router.use(verifyJWT);

/**
 * @route GET /api/vehiculos/search
 * @desc Buscar vehículos
 * @access Private (VEHICULOS_READ)
 */
router.get('/search', checkPermission('vehiculos.read'), controller.buscarVehiculos);

/**
 * @route GET /api/vehiculos/:id
 * @desc Obtener vehículo por ID
 * @access Private (VEHICULOS_READ)
 */
router.get('/:id', checkPermission('vehiculos.read'), controller.obtenerVehiculo);

/**
 * @route GET /api/vehiculos
 * @desc Listar vehículos
 * @access Private (VEHICULOS_READ)
 */
router.get('/', checkPermission('vehiculos.read'), controller.listarVehiculos);

/**
 * @route POST /api/vehiculos
 * @desc Crear vehículo
 * @access Private (VEHICULOS_WRITE)
 */
router.post('/', checkPermission('vehiculos.write'), controller.crearVehiculo);

/**
 * @route PUT /api/vehiculos/:id
 * @desc Actualizar vehículo
 * @access Private (VEHICULOS_WRITE)
 */
router.put('/:id', checkPermission('vehiculos.write'), controller.actualizarVehiculo);

module.exports = router;
