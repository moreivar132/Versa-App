/**
 * VERSA - Portal Cliente: Rutas de Citas
 * 
 * Endpoints:
 * - GET  /api/portal/me     → Cliente + sus vehículos
 * - POST /api/portal/citas  → Crear cita (con alta de vehículo si hace falta)
 * 
 * Requiere autenticación de cliente (customerAuth)
 */

const express = require('express');
const router = express.Router();
const portalCitasService = require('../services/portalCitasService');
const { customerAuth } = require('../middleware/customerAuth');

// Todas las rutas requieren cliente autenticado
router.use(customerAuth);

/**
 * GET /api/portal/me
 * Obtener datos del cliente + lista de vehículos
 */
router.get('/me', async (req, res) => {
    try {
        const idCliente = req.customer.id_cliente;

        const data = await portalCitasService.getClienteConVehiculos(idCliente);

        res.json({
            ok: true,
            data
        });

    } catch (error) {
        console.error('Error en GET /api/portal/me:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message || 'Error al obtener datos del cliente'
        });
    }
});

/**
 * POST /api/portal/citas
 * Crear cita con validación completa
 * 
 * Body esperado:
 * {
 *   id_sucursal: number (obligatorio),
 *   fecha_hora: string ISO (obligatorio),
 *   id_servicio: number (obligatorio),
 *   id_vehiculo: number (opcional - si viene, validar propiedad),
 *   vehiculo_data: { tipo, matricula, marca, modelo, anio, color, cc, numero_chasis } (obligatorio si no hay id_vehiculo),
 *   notas: string (opcional)
 * }
 */
router.post('/citas', async (req, res) => {
    try {
        const idCliente = req.customer.id_cliente;

        const result = await portalCitasService.crearCita(idCliente, req.body);

        res.status(201).json({
            ok: true,
            message: 'Cita creada exitosamente',
            data: result
        });

    } catch (error) {
        console.error('Error en POST /api/portal/citas:', error);
        res.status(error.status || 500).json({
            ok: false,
            error: error.message || 'Error al crear la cita',
            details: error.detail || undefined
        });
    }
});

module.exports = router;
