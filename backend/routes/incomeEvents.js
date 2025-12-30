/**
 * VERSA - Income Events Routes
 * API endpoints para gestión y consulta del ledger de ingresos
 */
const express = require('express');
const router = express.Router();
const incomeService = require('../services/incomeService');
const authMiddleware = require('../middleware/auth');

// Todas las rutas requieren autenticación
router.use(authMiddleware);

/**
 * GET /api/income-events
 * Obtener lista de eventos de ingreso con filtros
 * 
 * Query params:
 * - idSucursal: Filtrar por sucursal
 * - origen: 'marketplace' | 'crm' | 'subscription' | 'manual'
 * - status: 'pending' | 'paid' | 'failed' | 'refunded' | 'canceled'
 * - dateFrom: YYYY-MM-DD
 * - dateTo: YYYY-MM-DD
 * - limit: número (default 50)
 * - offset: número (default 0)
 */
router.get('/', async (req, res) => {
    try {
        const filters = {
            idTenant: req.user.id_tenant,
            idSucursal: req.query.idSucursal ? parseInt(req.query.idSucursal) : null,
            origen: req.query.origen || null,
            status: req.query.status || null,
            dateFrom: req.query.dateFrom || null,
            dateTo: req.query.dateTo || null,
            limit: parseInt(req.query.limit) || 50,
            offset: parseInt(req.query.offset) || 0
        };

        const result = await incomeService.getIncomeEvents(filters);
        res.json(result);

    } catch (error) {
        console.error('Error en GET /income-events:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/income-events/report
 * Obtener reporte de ingresos agrupado
 * 
 * Query params:
 * - idSucursal: Filtrar por sucursal
 * - dateFrom: YYYY-MM-DD
 * - dateTo: YYYY-MM-DD
 * - groupBy: 'origen' | 'sucursal' | 'day' | 'month'
 */
router.get('/report', async (req, res) => {
    try {
        const options = {
            idTenant: req.user.id_tenant,
            idSucursal: req.query.idSucursal ? parseInt(req.query.idSucursal) : null,
            dateFrom: req.query.dateFrom || null,
            dateTo: req.query.dateTo || null,
            groupBy: req.query.groupBy || 'origen'
        };

        const report = await incomeService.getRevenueReport(options);
        res.json(report);

    } catch (error) {
        console.error('Error en GET /income-events/report:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/income-events/summary
 * Obtener resumen rápido de ingresos (para dashboard)
 * 
 * Query params:
 * - period: 'today' | 'week' | 'month' | 'year'
 * - idSucursal: Filtrar por sucursal
 */
router.get('/summary', async (req, res) => {
    try {
        const period = req.query.period || 'month';
        const idSucursal = req.query.idSucursal ? parseInt(req.query.idSucursal) : null;

        // Calcular fechas según período
        const now = new Date();
        let dateFrom;

        switch (period) {
            case 'today':
                dateFrom = now.toISOString().split('T')[0];
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(weekAgo.getDate() - 7);
                dateFrom = weekAgo.toISOString().split('T')[0];
                break;
            case 'year':
                const yearAgo = new Date(now);
                yearAgo.setFullYear(yearAgo.getFullYear() - 1);
                dateFrom = yearAgo.toISOString().split('T')[0];
                break;
            case 'month':
            default:
                const monthAgo = new Date(now);
                monthAgo.setMonth(monthAgo.getMonth() - 1);
                dateFrom = monthAgo.toISOString().split('T')[0];
                break;
        }

        const report = await incomeService.getRevenueReport({
            idTenant: req.user.id_tenant,
            idSucursal,
            dateFrom,
            dateTo: now.toISOString().split('T')[0],
            groupBy: 'origen'
        });

        // Formatear respuesta para el dashboard
        res.json({
            period,
            dateRange: {
                from: dateFrom,
                to: now.toISOString().split('T')[0]
            },
            totals: report.totals,
            breakdown: report.data
        });

    } catch (error) {
        console.error('Error en GET /income-events/summary:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/income-events/:id
 * Obtener un evento específico
 */
router.get('/:id', async (req, res) => {
    try {
        const result = await incomeService.getIncomeEvents({
            idTenant: req.user.id_tenant,
            limit: 1,
            offset: 0
        });

        const event = result.events.find(e => e.id === parseInt(req.params.id));

        if (!event) {
            return res.status(404).json({ error: 'Evento no encontrado' });
        }

        res.json(event);

    } catch (error) {
        console.error('Error en GET /income-events/:id:', error.message);
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/income-events
 * Crear un evento de ingreso manual
 * Solo para uso administrativo o ajustes
 */
router.post('/', async (req, res) => {
    try {
        const {
            idSucursal,
            origen = 'manual',
            originType = 'manual',
            originId,
            idCliente,
            amount,
            currency = 'EUR',
            status = 'paid',
            provider = 'internal',
            description,
            metadata
        } = req.body;

        // Validar que sea manual o que tenga permisos especiales
        if (origen !== 'manual' && !req.user?.isAdmin) {
            return res.status(403).json({
                error: 'Solo se pueden crear eventos manuales desde esta API'
            });
        }

        // Generar reference única
        const reference = `manual:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;

        const result = await incomeService.createIncomeEvent({
            idTenant: req.user.id_tenant,
            idSucursal,
            origen,
            originType,
            originId,
            idCliente,
            amount,
            currency,
            status,
            provider,
            reference,
            description,
            metadata
        });

        res.status(201).json(result);

    } catch (error) {
        console.error('Error en POST /income-events:', error.message);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
