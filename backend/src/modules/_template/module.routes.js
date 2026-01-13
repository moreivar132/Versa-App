/**
 * Module Routes Template
 * Define las rutas del módulo y las conecta con el controller.
 * 
 * COPIAR Y RENOMBRAR:
 * 1. Copiar toda la carpeta _template a modules/[nombre-modulo]
 * 2. Renombrar archivos: module.* -> [nombre].* (ej: ordenes.routes.js)
 * 3. Actualizar los requires
 */

const express = require('express');
const router = express.Router();
const controller = require('./module.controller');
const verifyJWT = require('../../../middleware/auth'); // Reutilizar auth existente

// Todas las rutas requieren autenticación
router.use(verifyJWT);

/**
 * GET /
 * Listar recursos
 */
router.get('/', controller.list);

/**
 * GET /:id
 * Obtener un recurso por ID
 */
router.get('/:id', controller.getById);

/**
 * POST /
 * Crear un nuevo recurso
 */
router.post('/', controller.create);

/**
 * PUT /:id
 * Actualizar un recurso
 */
router.put('/:id', controller.update);

/**
 * DELETE /:id
 * Eliminar un recurso
 */
router.delete('/:id', controller.remove);

module.exports = router;
