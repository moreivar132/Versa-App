const express = require('express');
const router = express.Router();
const ordenesController = require('../controllers/ordenesController');
const verifyJWT = require('../middleware/auth');

const ordenPagoController = require('../controllers/ordenPagoController');
const ordenPDFService = require('../services/ordenPDFService');

// Obtener lista de estados de orden disponibles
router.get('/estados', verifyJWT, ordenesController.getEstadosOrden);

router.post('/', verifyJWT, ordenesController.createOrden);
router.get('/', verifyJWT, ordenesController.getOrdenes);

// Obtener una orden específica con sus líneas y pagos
router.get('/:id', verifyJWT, ordenesController.getOrdenById);

// Actualizar una orden existente
router.put('/:id', verifyJWT, ordenesController.updateOrden);

// Cambio rápido de estado
router.patch('/:id/estado', verifyJWT, ordenesController.updateEstadoOrden);

// Ruta para pagos de órdenes
router.post('/:id/pagos', verifyJWT, ordenPagoController.crearPago);

/**
 * GET /api/ordenes/:id/documento
 * Genera el documento HTML de una orden de trabajo para visualizar/imprimir
 */
router.get('/:id/documento', verifyJWT, async (req, res) => {
    try {
        const ordenId = parseInt(req.params.id);

        if (!ordenId || isNaN(ordenId)) {
            return res.status(400).json({ success: false, error: 'ID de orden inválido' });
        }

        const html = await ordenPDFService.generarDocumentoOrden(ordenId);

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="orden_${ordenId}.html"`);
        res.send(html);

    } catch (error) {
        console.error('Error generando documento de orden:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/ordenes/:id/documento/download
 * Descarga el documento HTML de una orden de trabajo
 */
router.get('/:id/documento/download', verifyJWT, async (req, res) => {
    try {
        const ordenId = parseInt(req.params.id);

        if (!ordenId || isNaN(ordenId)) {
            return res.status(400).json({ success: false, error: 'ID de orden inválido' });
        }

        const html = await ordenPDFService.generarDocumentoOrden(ordenId);

        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="orden_trabajo_${ordenId}.html"`);
        res.send(html);

    } catch (error) {
        console.error('Error descargando documento de orden:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Import pool for config endpoints
const pool = require('../db');

/**
 * GET /api/ordenes/config-tenant
 * Obtiene la configuración de documentos de órdenes para un tenant
 */
router.get('/config-tenant', verifyJWT, async (req, res) => {
    try {
        const tenantId = req.user.id_tenant;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo identificar el tenant del usuario'
            });
        }

        const result = await pool.query(`
            SELECT * FROM ordenconfigtenant
            WHERE id_tenant = $1 AND es_por_defecto = true
            LIMIT 1
        `, [tenantId]);

        if (result.rows.length === 0) {
            // Crear configuración por defecto si no existe
            const insertResult = await pool.query(`
                INSERT INTO ordenconfigtenant (
                    id_tenant, nombre_taller, color_primario, es_por_defecto
                ) VALUES ($1, $2, $3, $4)
                RETURNING *
            `, [tenantId, 'GOVERSA', '#ff652b', true]);

            return res.json({
                success: true,
                data: insertResult.rows[0]
            });
        }

        res.json({
            success: true,
            data: result.rows[0]
        });

    } catch (error) {
        // Si la tabla no existe, devolver configuración por defecto
        if (error.code === '42P01') {
            return res.json({
                success: true,
                data: {
                    nombre_taller: 'GOVERSA',
                    color_primario: '#ff652b',
                    logo_url: '',
                    mostrar_logo: true,
                    mostrar_matricula: true,
                    mostrar_kilometraje: true,
                    mostrar_tecnico: true,
                    mostrar_precios: true,
                    mostrar_iva: true,
                    mostrar_firma_cliente: true
                }
            });
        }
        console.error('Error obteniendo config órdenes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * PUT /api/ordenes/config-tenant
 * Guarda la configuración de documentos de órdenes
 */
router.put('/config-tenant', verifyJWT, async (req, res) => {
    try {
        const {
            nombre_taller,
            logo_url,
            color_primario,
            cabecera_html,
            pie_html,
            condiciones_html,
            mostrar_logo,
            mostrar_matricula,
            mostrar_kilometraje,
            mostrar_tecnico,
            mostrar_precios,
            mostrar_iva,
            mostrar_firma_cliente
        } = req.body;

        const tenantId = req.user.id_tenant;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                error: 'No se pudo identificar el tenant del usuario'
            });
        }

        // Upsert de la configuración
        const result = await pool.query(`
            INSERT INTO ordenconfigtenant (
                id_tenant, nombre_taller, logo_url, color_primario,
                cabecera_html, pie_html, condiciones_html,
                mostrar_logo, mostrar_matricula, mostrar_kilometraje,
                mostrar_tecnico, mostrar_precios, mostrar_iva, mostrar_firma_cliente,
                es_por_defecto
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, true)
            ON CONFLICT (id_tenant) WHERE es_por_defecto = true
            DO UPDATE SET
                nombre_taller = EXCLUDED.nombre_taller,
                logo_url = EXCLUDED.logo_url,
                color_primario = EXCLUDED.color_primario,
                cabecera_html = EXCLUDED.cabecera_html,
                pie_html = EXCLUDED.pie_html,
                condiciones_html = EXCLUDED.condiciones_html,
                mostrar_logo = EXCLUDED.mostrar_logo,
                mostrar_matricula = EXCLUDED.mostrar_matricula,
                mostrar_kilometraje = EXCLUDED.mostrar_kilometraje,
                mostrar_tecnico = EXCLUDED.mostrar_tecnico,
                mostrar_precios = EXCLUDED.mostrar_precios,
                mostrar_iva = EXCLUDED.mostrar_iva,
                mostrar_firma_cliente = EXCLUDED.mostrar_firma_cliente
            RETURNING *
        `, [
            tenantId,
            nombre_taller || 'GOVERSA',
            logo_url || null,
            color_primario || '#ff652b',
            cabecera_html || null,
            pie_html || null,
            condiciones_html || null,
            mostrar_logo !== false,
            mostrar_matricula !== false,
            mostrar_kilometraje !== false,
            mostrar_tecnico !== false,
            mostrar_precios !== false,
            mostrar_iva !== false,
            mostrar_firma_cliente !== false
        ]);

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Configuración guardada correctamente'
        });

    } catch (error) {
        console.error('Error guardando config órdenes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;

