const express = require('express');
const router = express.Router();
const ordenesController = require('../controllers/ordenesController');
const verifyJWT = require('../middleware/auth');

const ordenPagoController = require('../controllers/ordenPagoController');
const ordenPDFService = require('../services/ordenPDFService');

// Obtener lista de estados de orden disponibles
router.get('/estados', verifyJWT, ordenesController.getEstadosOrden);

// Actualizar un estado de orden específico (nombre, color, orden)
router.put('/estados/:id', verifyJWT, async (req, res) => {
    try {
        const ordenesService = require('../services/ordenesService');
        const idEstado = parseInt(req.params.id);
        const { nombre, color, orden } = req.body;

        if (!idEstado || isNaN(idEstado)) {
            return res.status(400).json({ success: false, error: 'ID de estado inválido' });
        }

        const estado = await ordenesService.updateEstadoOrdenConfig(idEstado, { nombre, color, orden });
        res.json({ success: true, data: estado });
    } catch (error) {
        console.error('Error actualizando estado:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Actualizar múltiples estados a la vez (batch update)
router.put('/estados', verifyJWT, async (req, res) => {
    try {
        const ordenesService = require('../services/ordenesService');
        const { estados } = req.body;

        if (!estados || !Array.isArray(estados)) {
            return res.status(400).json({ success: false, error: 'Se requiere un array de estados' });
        }

        const results = await ordenesService.updateEstadosOrdenBatch(estados);
        res.json({ success: true, data: results, message: 'Estados actualizados correctamente' });
    } catch (error) {
        console.error('Error actualizando estados:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Import pool for config endpoints
const pool = require('../db');

/**
 * GET /api/ordenes/config-tenant
 * Obtiene la configuración de documentos de órdenes para un tenant
 * IMPORTANTE: Esta ruta debe estar ANTES de las rutas con :id
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
 * IMPORTANTE: Esta ruta debe estar ANTES de las rutas con :id
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

/**
 * DELETE /api/ordenes/:id
 * Elimina una orden COMPLETAMENTE, revirtiendo todos sus efectos en el sistema:
 * - Devuelve el stock de productos usados
 * - Elimina movimientos de cuenta corriente y actualiza saldo
 * - Elimina pagos de la orden
 * - Elimina líneas de la orden
 * - Elimina cualquier referencia relacionada
 */
router.delete('/:id', verifyJWT, async (req, res) => {
    const client = await pool.connect();

    try {
        const ordenId = parseInt(req.params.id);
        const tenantId = req.user?.id_tenant;

        if (!ordenId || isNaN(ordenId)) {
            return res.status(400).json({ success: false, error: 'ID de orden inválido' });
        }

        await client.query('BEGIN');

        // Verificar que la orden existe y pertenece al tenant
        const ordenCheck = await client.query(`
            SELECT o.id, o.id_sucursal, o.id_cuenta_corriente, o.en_cuenta_corriente, s.id_tenant
            FROM orden o
            JOIN sucursal s ON o.id_sucursal = s.id
            WHERE o.id = $1
        `, [ordenId]);

        if (ordenCheck.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'Orden no encontrada' });
        }

        if (ordenCheck.rows[0].id_tenant !== tenantId) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'No tienes permisos para eliminar esta orden' });
        }

        const orden = ordenCheck.rows[0];

        // =====================================================
        // 1. REVERTIR INVENTARIO - Devolver stock de productos
        // =====================================================
        // La tabla movimientoinventario usa: tipo, origen_tipo, origen_id
        // El stock se guarda en producto.stock
        // Hay que buscar tanto ORDEN como ORDEN_EDICION
        const movimientosInventario = await client.query(`
            SELECT mi.id, mi.id_producto, mi.cantidad, mi.tipo
            FROM movimientoinventario mi
            WHERE mi.origen_tipo IN ('ORDEN', 'ORDEN_EDICION') AND mi.origen_id = $1
        `, [ordenId]);

        // Revertir cada movimiento: SALIDA -> devolver stock, ENTRADA -> quitar stock
        for (const mov of movimientosInventario.rows) {
            if (mov.tipo === 'SALIDA') {
                // La orden sacó productos, hay que devolverlos al stock
                await client.query(`
                    UPDATE producto 
                    SET stock = COALESCE(stock, 0) + $1
                    WHERE id = $2
                `, [mov.cantidad, mov.id_producto]);
            } else if (mov.tipo === 'ENTRADA') {
                // La orden metió productos (devolución?), hay que quitarlos del stock
                await client.query(`
                    UPDATE producto 
                    SET stock = COALESCE(stock, 0) - $1
                    WHERE id = $2
                `, [mov.cantidad, mov.id_producto]);
            }
        }

        // Eliminar los movimientos de inventario (ambos tipos)
        await client.query(`DELETE FROM movimientoinventario WHERE origen_tipo IN ('ORDEN', 'ORDEN_EDICION') AND origen_id = $1`, [ordenId]);

        // =====================================================
        // 2. REVERTIR CUENTA CORRIENTE
        // =====================================================
        // Buscar movimientos en cuenta corriente relacionados con esta orden
        // (puede haber aunque la orden no tenga id_cuenta_corriente asignado)
        const movimientosCC = await client.query(`
            SELECT mc.id, mc.importe, mc.tipo_movimiento, mc.id_cuenta_corriente
            FROM movimientocuenta mc
            WHERE mc.id_orden = $1
        `, [ordenId]);

        // Revertir el saldo de cada cuenta corriente afectada
        for (const mov of movimientosCC.rows) {
            if (mov.tipo_movimiento === 'CARGO') {
                await client.query(`
                    UPDATE cuentacorriente 
                    SET saldo_actual = saldo_actual - $1, updated_at = NOW()
                    WHERE id = $2
                `, [mov.importe, mov.id_cuenta_corriente]);
            } else if (mov.tipo_movimiento === 'ABONO') {
                await client.query(`
                    UPDATE cuentacorriente 
                    SET saldo_actual = saldo_actual + $1, updated_at = NOW()
                    WHERE id = $2
                `, [mov.importe, mov.id_cuenta_corriente]);
            }
        }

        // Eliminar movimientos de cuenta corriente
        await client.query(`DELETE FROM movimientocuenta WHERE id_orden = $1`, [ordenId]);

        // =====================================================
        // 3. ELIMINAR PAGOS DE LA ORDEN
        // =====================================================
        // Los pagos en ordenpago afectan la caja, al eliminarlos se revierte
        await client.query(`DELETE FROM ordenpago WHERE id_orden = $1`, [ordenId]);

        // =====================================================
        // 4. ELIMINAR LÍNEAS DE LA ORDEN
        // =====================================================
        await client.query(`DELETE FROM ordenlinea WHERE id_orden = $1`, [ordenId]);

        // =====================================================
        // 5. LIMPIAR REFERENCIAS EN FACTURAS (si existe)
        // =====================================================
        // Quitar la referencia de la orden en facturas (no eliminar la factura)
        // Usamos SAVEPOINT porque si la tabla/columna no existe, no queremos abortar toda la transacción
        await client.query('SAVEPOINT before_factura');
        try {
            await client.query(`
                UPDATE factura SET id_orden = NULL WHERE id_orden = $1
            `, [ordenId]);
        } catch (e) {
            await client.query('ROLLBACK TO SAVEPOINT before_factura');
        }

        // Limpiar facturacabecera
        await client.query('SAVEPOINT before_facturacabecera');
        try {
            await client.query(`
                UPDATE facturacabecera SET id_orden = NULL WHERE id_orden = $1
            `, [ordenId]);
        } catch (e) {
            await client.query('ROLLBACK TO SAVEPOINT before_facturacabecera');
        }

        // =====================================================
        // 6. LIMPIAR MARKETPLACE REVIEWS (si existe)
        // =====================================================
        await client.query('SAVEPOINT before_marketplace');
        try {
            await client.query(`
                DELETE FROM marketplace_review WHERE id_orden = $1
            `, [ordenId]);
        } catch (e) {
            await client.query('ROLLBACK TO SAVEPOINT before_marketplace');
        }

        // =====================================================
        // 7. ELIMINAR LA ORDEN
        // =====================================================
        await client.query(`DELETE FROM orden WHERE id = $1`, [ordenId]);

        await client.query('COMMIT');

        res.json({
            success: true,
            message: `Orden #${ordenId} eliminada correctamente. Todos los efectos han sido revertidos.`
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error eliminando orden:', error);
        res.status(500).json({ success: false, error: error.message });
    } finally {
        client.release();
    }
});

module.exports = router;
