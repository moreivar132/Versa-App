const ordenPagoService = require('../services/ordenPagoService');

class OrdenPagoController {
    /**
     * Maneja la solicitud para crear un pago de una orden.
     * POST /api/ordenes/:id/pagos
     */
    async crearPago(req, res) {
        try {
            const { id } = req.params;
            const datosPago = req.body;
            const userId = req.user?.id;

            const idOrden = parseInt(id, 10);
            if (isNaN(idOrden)) {
                return res.status(400).json({
                    success: false,
                    message: 'El ID de la orden debe ser un número válido.'
                });
            }

            // Añadir el usuario que registra el pago
            datosPago.createdBy = userId;

            const resultado = await ordenPagoService.registrarPago(idOrden, datosPago);

            res.status(201).json({
                success: true,
                ...resultado
            });
        } catch (error) {
            console.error('Error al crear pago:', error);
            const status = error.status || 500;
            const message = error.message || 'Error interno del servidor al registrar el pago.';
            res.status(status).json({ success: false, message });
        }
    }
}

module.exports = new OrdenPagoController();
