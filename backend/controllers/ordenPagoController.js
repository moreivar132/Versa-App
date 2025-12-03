const ordenPagoService = require('../services/ordenPagoService');

class OrdenPagoController {
    /**
     * Maneja la solicitud para crear un pago de una orden.
     * POST /api/ordenes/:id/pagos
     */
    async crearPago(req, res) {
        try {
            const { id } = req.params; // idOrden desde la URL
            const datosPago = req.body;

            // Asegurar que el ID de la orden sea numérico
            const idOrden = parseInt(id, 10);
            if (isNaN(idOrden)) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de la orden debe ser un número válido.'
                });
            }

            const pago = await ordenPagoService.registrarPago(idOrden, datosPago);

            res.status(201).json({
                success: true,
                pago
            });
        } catch (error) {
            console.error('Error al crear pago:', error);

            // Manejo de errores controlados (con status) vs errores inesperados
            const status = error.status || 500;
            const message = error.message || 'Error interno del servidor al registrar el pago.';

            res.status(status).json({
                success: false,
                message
            });
        }
    }
}

module.exports = new OrdenPagoController();
