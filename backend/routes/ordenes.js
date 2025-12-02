const express = require('express');
const router = express.Router();
const ordenesController = require('../controllers/ordenesController');
const verifyJWT = require('../middleware/auth');

router.post('/', verifyJWT, ordenesController.createOrden);

module.exports = router;
