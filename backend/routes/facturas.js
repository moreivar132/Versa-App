/**
 * Rutas API para el módulo de Facturación
 * 
 * Endpoints para gestionar facturas, series de facturación,
 * y configuración de facturas por tenant.
 */

const express = require('express');
const router = express.Router();
const facturacionService = require('../services/facturacionService');
const facturaPDFService = require('../services/facturaPDFService');
const { getTenantDb } = require('../src/core/db/tenant-db');

// Inyectar db en req desde el contexto
router.use((req, res, next) => {
    if (req.ctx) {
        req.db = getTenantDb(req.ctx);
    }
    next();
});

const pool = {
    query: (sql, params) => {
        throw new Error('Uso directo de pool detectado en facturas.js. Usa req.db.query instead.');
    }
};

// =====================================================
// ENDPOINTS DE FACTURAS
// =====================================================

/**
 * DEBUG: Ver estados de órdenes para diagnósticos
 */
router.get('/debug-pendientes', async (req, res) => {
    try {
        const tenantId = req.query.tenantId || 1;

        // 1. Ver todos los estados disponibles
        const estados = await req.db.query('SELECT * FROM estadoorden');

        // 2. Ver conteo de órdenes sin factura por estado
        const conteo = await req.db.query(`
            SELECT eo.nombre as estado, eo.id as id_estado, COUNT(*) as cantidad
            FROM orden o
            INNER JOIN sucursal s ON o.id_sucursal = s.id
            LEFT JOIN estadoorden eo ON o.id_estado_orden = eo.id
            WHERE o.id_factura IS NULL AND s.id_tenant = $1
            GROUP BY eo.nombre, eo.id
        `, [tenantId]);

        // 3. Ver 5 ejemplos de órdenes recientes sin factura
        const ejemplos = await req.db.query(`
            SELECT o.id, o.numero_orden, o.id_estado_orden, eo.nombre as estado, o.requiere_factura 
            FROM orden o
            INNER JOIN sucursal s ON o.id_sucursal = s.id
            LEFT JOIN estadoorden eo ON o.id_estado_orden = eo.id
            WHERE o.id_factura IS NULL AND s.id_tenant = $1
            ORDER BY o.id DESC LIMIT 5
        `, [tenantId]);

        res.json({
            estados: estados.rows,
            ordenes_sin_factura_por_estado: conteo.rows,
            ejemplos_recientes: ejemplos.rows
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/facturas/ordenes/:id/emitir
 * Emite una factura desde una orden de taller
 */
router.post('/ordenes/:id/emitir', async (req, res) => {
    try {
        const idOrden = parseInt(req.params.id);
        const idUsuario = req.body.id_usuario || req.user?.id; // Asumiendo middleware de autenticación

        if (!idUsuario) {
            return res.status(401).json({
                success: false,
                error: 'Usuario no autenticado'
            });
        }

        const opciones = {
            idSerie: req.body.id_serie || null,
            fechaEmision: req.body.fecha_emision || null,
            observaciones: req.body.observaciones || null
        };

        const resultado = await facturacionService.emitirFacturaDesdeOrden(
            req.ctx,
            idOrden,
            idUsuario,
            opciones
        );

        res.json({
            success: true,
            data: resultado,
            message: `Factura ${resultado.factura.numero_factura} emitida correctamente`
        });

    } catch (error) {
        console.error('Error al emitir factura:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas
 * Lista facturas con filtros
 */
router.get('/', async (req, res) => {
    try {
        const filtros = {
            tenantId: req.query.tenantId ? parseInt(req.query.tenantId) : null,
            id_sucursal: req.query.id_sucursal ? parseInt(req.query.id_sucursal) : null,
            estado: req.query.estado || null,
            fecha_desde: req.query.fecha_desde || null,
            fecha_hasta: req.query.fecha_hasta || null,
            texto: req.query.texto || null,
            limit: req.query.limit ? parseInt(req.query.limit) : 100,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        };

        const facturas = await facturacionService.listarFacturas(req.ctx, filtros);

        res.json({
            success: true,
            data: facturas,
            total: facturas.length
        });

    } catch (error) {
        console.error('Error al listar facturas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/ordenes/pendientes
 * Lista órdenes que requieren factura y aún no la tienen
 */
router.get('/ordenes/pendientes', async (req, res) => {
    try {
        const filtros = {
            tenantId: req.query.tenantId ? parseInt(req.query.tenantId) : null,
            id_sucursal: req.query.id_sucursal ? parseInt(req.query.id_sucursal) : null,
            limit: req.query.limit ? parseInt(req.query.limit) : 100,
            offset: req.query.offset ? parseInt(req.query.offset) : 0
        };

        const ordenes = await facturacionService.listarOrdenesPendientesFactura(req.ctx, filtros);

        res.json({
            success: true,
            data: ordenes,
            total: ordenes.length
        });

    } catch (error) {
        console.error('Error al listar órdenes pendientes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/stats/general
 * Estadísticas generales para el dashboard
 */
router.get('/stats/general', async (req, res) => {
    try {
        const tenantId = req.query.tenantId ? parseInt(req.query.tenantId) : null;
        const idSucursal = req.query.idSucursal ? parseInt(req.query.idSucursal) : null;

        if (!tenantId) {
            return res.status(400).json({ success: false, error: 'Tenant ID requerido' });
        }

        const stats = await facturacionService.obtenerEstadisticasGeneral(req.ctx, idSucursal);

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /api/facturas/:id/pdf
 * Genera o devuelve el PDF de una factura
 */
router.get('/:id/pdf', async (req, res) => {
    try {
        const idFactura = parseInt(req.params.id);

        // Obtener factura completa
        const facturaCompleta = await facturacionService.obtenerFacturaCompleta(req.ctx, idFactura);

        // Generar HTML
        const html = facturaPDFService.generarHTMLFactura(facturaCompleta);

        // Devolver HTML directamente
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `inline; filename="factura_${facturaCompleta.numero_factura}.html"`);
        res.send(html);

    } catch (error) {
        console.error('Error al generar PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/facturas/:id/download
 * Descarga el HTML de una factura como archivo
 */
router.get('/:id/download', async (req, res) => {
    try {
        const idFactura = parseInt(req.params.id);

        // Obtener factura completa
        const facturaCompleta = await facturacionService.obtenerFacturaCompleta(idFactura);

        // Generar HTML
        const html = facturaPDFService.generarHTMLFactura(facturaCompleta);

        // Devolver como descarga
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename="factura_${facturaCompleta.numero_factura}.html"`);
        res.send(html);

    } catch (error) {
        console.error('Error al descargar factura:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/facturas/:id/regenerar-pdf
 * Fuerza la regeneración del PDF de una factura
 */
router.post('/:id/regenerar-pdf', async (req, res) => {
    try {
        const idFactura = parseInt(req.params.id);
        const pdfUrl = await facturaPDFService.generarPDF(req.ctx, idFactura);

        res.json({
            success: true,
            data: {
                pdf_url: pdfUrl
            },
            message: 'PDF regenerado correctamente'
        });

    } catch (error) {
        console.error('Error al regenerar PDF:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// ENDPOINTS DE SERIES DE FACTURACIÓN
// =====================================================

/**
 * GET /api/facturas/series
 * Lista series de facturación
 */
router.get('/series', async (req, res) => {
    try {
        const idSucursal = req.query.id_sucursal ? parseInt(req.query.id_sucursal) : null;

        let query = 'SELECT * FROM facturaserie WHERE activo = true';
        const valores = [];

        if (idSucursal) {
            query += ' AND id_sucursal = $1';
            valores.push(idSucursal);
        }

        query += ' ORDER BY nombre_serie';

        const result = await req.db.query(query, valores);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        console.error('Error al listar series:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * POST /api/facturas/series
 * Crea una nueva serie de facturación
 */
router.post('/series', async (req, res) => {
    try {
        const {
            id_sucursal,
            nombre_serie,
            prefijo,
            sufijo,
            tipo_documento,
            es_por_defecto,
            id_usuario
        } = req.body;

        // Validaciones
        if (!id_sucursal || !nombre_serie || !prefijo) {
            return res.status(400).json({
                success: false,
                error: 'Faltan campos obligatorios: id_sucursal, nombre_serie, prefijo'
            });
        }

        const query = `
      INSERT INTO facturaserie (
        id_sucursal,
        nombre_serie,
        prefijo,
        sufijo,
        tipo_documento,
        activo,
        es_por_defecto,
        creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

        const result = await req.db.query(query, [
            id_sucursal,
            nombre_serie,
            prefijo,
            sufijo || null,
            tipo_documento || 'FACTURA',
            true,
            es_por_defecto || false,
            id_usuario || null
        ]);

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Serie de facturación creada correctamente'
        });

    } catch (error) {
        console.error('Error al crear serie:', error);

        // Manejar error de duplicado
        if (error.code === '23505') {
            return res.status(400).json({
                success: false,
                error: 'Ya existe una serie con ese nombre en esta sucursal'
            });
        }

        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/facturas/series/:id
 * Actualiza una serie de facturación
 */
router.put('/series/:id', async (req, res) => {
    try {
        const idSerie = parseInt(req.params.id);
        const {
            nombre_serie,
            prefijo,
            sufijo,
            activo,
            es_por_defecto
        } = req.body;

        const campos = [];
        const valores = [];
        let paramIndex = 1;

        if (nombre_serie !== undefined) {
            campos.push(`nombre_serie = $${paramIndex}`);
            valores.push(nombre_serie);
            paramIndex++;
        }

        if (prefijo !== undefined) {
            campos.push(`prefijo = $${paramIndex}`);
            valores.push(prefijo);
            paramIndex++;
        }

        if (sufijo !== undefined) {
            campos.push(`sufijo = $${paramIndex}`);
            valores.push(sufijo);
            paramIndex++;
        }

        if (activo !== undefined) {
            campos.push(`activo = $${paramIndex}`);
            valores.push(activo);
            paramIndex++;
        }

        if (es_por_defecto !== undefined) {
            campos.push(`es_por_defecto = $${paramIndex}`);
            valores.push(es_por_defecto);
            paramIndex++;
        }

        if (campos.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No hay campos para actualizar'
            });
        }

        valores.push(idSerie);

        const query = `
      UPDATE facturaserie
      SET ${campos.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

        const result = await req.db.query(query, valores);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Serie no encontrada'
            });
        }

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Serie actualizada correctamente'
        });

    } catch (error) {
        console.error('Error al actualizar serie:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// ENDPOINTS DE CONFIGURACIÓN DE FACTURAS POR TENANT
// =====================================================

/**
 * GET /api/facturas/config-tenant
 * Obtiene la configuración de facturación del tenant
 */
router.get('/config-tenant', async (req, res) => {
    try {
        const tenantId = req.query.tenantId ? parseInt(req.query.tenantId) : null;

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere tenantId'
            });
        }

        const query = `
      SELECT * FROM facturaconfigtenant
      WHERE id_tenant = $1 AND es_por_defecto = true
      LIMIT 1
    `;

        const result = await req.db.query(query, [tenantId]);

        // console.log('GET /config-tenant result:', result.rows[0]); // DEBUG

        if (result.rows.length === 0) {
            // Si no existe, crear una configuración por defecto
            const insertQuery = `
        INSERT INTO facturaconfigtenant (
          id_tenant,
          nombre_plantilla,
          color_primario,
          es_por_defecto
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

            const insertResult = await req.db.query(insertQuery, [
                tenantId,
                'Por defecto',
                '#ff4400',
                true
            ]);

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
        console.error('Error al obtener config de facturación:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * PUT /api/facturas/config-tenant
 * Actualiza la configuración de facturación del tenant
 */
router.put('/config-tenant', async (req, res) => {
    try {
        const {
            tenantId,
            logo_url,
            color_primario,
            cabecera_html,
            pie_html,
            texto_legal,
            mostrar_columna_iva,
            mostrar_columna_descuento,
            mostrar_domicilio_cliente,
            mostrar_matricula_vehiculo,
            config_json,
            id_usuario
        } = req.body;

        console.log('PUT /config-tenant body:', req.body); // DEBUG

        if (!tenantId) {
            return res.status(400).json({
                success: false,
                error: 'Se requiere tenantId'
            });
        }

        // Verificar si existe configuración
        const checkQuery = `
      SELECT id FROM facturaconfigtenant
      WHERE id_tenant = $1 AND es_por_defecto = true
      LIMIT 1
    `;

        const checkResult = await req.db.query(checkQuery, [tenantId]);

        if (checkResult.rows.length === 0) {
            // Crear nueva configuración
            const insertQuery = `
        INSERT INTO facturaconfigtenant (
          id_tenant,
          logo_url,
          color_primario,
          cabecera_html,
          pie_html,
          texto_legal,
          mostrar_columna_iva,
          mostrar_columna_descuento,
          mostrar_domicilio_cliente,
          mostrar_matricula_vehiculo,
          config_json,
          es_por_defecto,
          creado_por
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

            const result = await req.db.query(insertQuery, [
                tenantId,
                logo_url || null,
                color_primario || '#ff4400',
                cabecera_html || null,
                pie_html || null,
                texto_legal || null,
                mostrar_columna_iva !== undefined ? mostrar_columna_iva : true,
                mostrar_columna_descuento !== undefined ? mostrar_columna_descuento : true,
                mostrar_domicilio_cliente !== undefined ? mostrar_domicilio_cliente : true,
                mostrar_matricula_vehiculo !== undefined ? mostrar_matricula_vehiculo : true,
                config_json || {},
                true,
                id_usuario || null
            ]);

            return res.json({
                success: true,
                data: result.rows[0],
                message: 'Configuración de facturación creada correctamente'
            });
        }

        // Actualizar configuración existente
        const campos = [];
        const valores = [];
        let paramIndex = 1;

        if (logo_url !== undefined) {
            campos.push(`logo_url = $${paramIndex}`);
            valores.push(logo_url);
            paramIndex++;
        }

        if (color_primario !== undefined) {
            campos.push(`color_primario = $${paramIndex}`);
            valores.push(color_primario);
            paramIndex++;
        }

        if (cabecera_html !== undefined) {
            campos.push(`cabecera_html = $${paramIndex}`);
            valores.push(cabecera_html);
            paramIndex++;
        }

        if (pie_html !== undefined) {
            campos.push(`pie_html = $${paramIndex}`);
            valores.push(pie_html);
            paramIndex++;
        }

        if (texto_legal !== undefined) {
            campos.push(`texto_legal = $${paramIndex}`);
            valores.push(texto_legal);
            paramIndex++;
        }

        if (mostrar_columna_iva !== undefined) {
            campos.push(`mostrar_columna_iva = $${paramIndex}`);
            valores.push(mostrar_columna_iva);
            paramIndex++;
        }

        if (mostrar_columna_descuento !== undefined) {
            campos.push(`mostrar_columna_descuento = $${paramIndex}`);
            valores.push(mostrar_columna_descuento);
            paramIndex++;
        }

        if (mostrar_domicilio_cliente !== undefined) {
            campos.push(`mostrar_domicilio_cliente = $${paramIndex}`);
            valores.push(mostrar_domicilio_cliente);
            paramIndex++;
        }

        if (mostrar_matricula_vehiculo !== undefined) {
            campos.push(`mostrar_matricula_vehiculo = $${paramIndex}`);
            valores.push(mostrar_matricula_vehiculo);
            paramIndex++;
        }

        if (config_json !== undefined) {
            campos.push(`config_json = $${paramIndex}`);
            valores.push(config_json);
            paramIndex++;
        }

        valores.push(checkResult.rows[0].id);

        const updateQuery = `
      UPDATE facturaconfigtenant
      SET ${campos.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

        const result = await req.db.query(updateQuery, valores);

        res.json({
            success: true,
            data: result.rows[0],
            message: 'Configuración de facturación actualizada correctamente'
        });

    } catch (error) {
        console.error('Error al actualizar config de facturación:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// =====================================================
// RUTA GENÉRICA /:id - DEBE IR AL FINAL
// para no capturar rutas específicas como /series, /config-tenant
// =====================================================

/**
 * GET /api/facturas/:id
 * Obtiene una factura completa por ID
 */
router.get('/:id', async (req, res) => {
    try {
        const idFactura = parseInt(req.params.id);

        // Validar que es un número
        if (isNaN(idFactura)) {
            return res.status(400).json({
                success: false,
                error: 'ID de factura inválido'
            });
        }

        const factura = await facturacionService.obtenerFacturaCompleta(req.ctx, idFactura);

        res.json({
            success: true,
            data: factura
        });

    } catch (error) {
        console.error('Error al obtener factura:', error);
        res.status(404).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;
