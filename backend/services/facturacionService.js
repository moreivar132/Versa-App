/**
 * Servicio de Facturación
 * 
 * Maneja la lógica de negocio para emitir facturas desde órdenes de taller,
 * garantizando numeración correlativa continua mediante transacciones.
 */

const { getTenantDb } = require('../src/core/db/tenant-db');

class FacturacionService {

    /**
     * Genera el número de factura formateado
     * @param {string} prefijo - Prefijo de la serie
     * @param {number} correlativo - Número correlativo
     * @param {string|null} sufijo - Sufijo de la serie (opcional)
     * @returns {string} Número de factura formateado
     */
    generarNumeroFactura(prefijo, correlativo, sufijo = null) {
        const correlativoFormateado = String(correlativo).padStart(8, '0');
        let numeroFactura = `${prefijo}${correlativoFormateado}`;
        if (sufijo) {
            numeroFactura += sufijo;
        }
        return numeroFactura;
    }

    /**
     * Emite una factura desde una orden de taller
     * 
     * @param {Object} ctx - Contexto de la request
     * @param {number} idOrden - ID de la orden
     * @param {number} idUsuario - ID del usuario que emite la factura (opcional, se usa ctx.userId si no viene)
     * @param {object} opciones - Opciones adicionales (idSerie, fechaEmision, etc.)
     * @returns {Promise<object>} Factura creada con sus líneas y pagos
     * @throws {Error} Si la orden no es válida o no se puede emitir la factura
     */
    async emitirFacturaDesdeOrden(ctx, idOrden, idUsuario, opciones = {}) {
        const db = getTenantDb(ctx);
        const userId = idUsuario || ctx.userId;

        return db.txWithRLS(async (tx) => {
            // 1. BUSCAR LA ORDEN CON TODOS SUS DATOS
            const ordenQuery = `
        SELECT 
          o.*,
          s.id as sucursal_id,
          s.nombre as sucursal_nombre,
          cf.id as cliente_id,
          cf.nombre as cliente_nombre,
          cf.email as cliente_email,
          cf.telefono as cliente_telefono,
          cf.direccion as cliente_direccion,
          v.matricula as vehiculo_matricula,
          eo.nombre as estado_nombre
        FROM orden o
        INNER JOIN sucursal s ON o.id_sucursal = s.id
        INNER JOIN clientefinal cf ON o.id_cliente = cf.id
        LEFT JOIN vehiculo v ON o.id_vehiculo = v.id
        LEFT JOIN estadoorden eo ON o.id_estado_orden = eo.id
        WHERE o.id = $1
      `;

            const ordenResult = await tx.query(ordenQuery, [idOrden]);

            if (ordenResult.rows.length === 0) {
                throw new Error('Orden no encontrada');
            }

            const orden = ordenResult.rows[0];

            // VALIDACIONES DE NEGOCIO

            // Validar que no tenga ya una factura asignada
            if (orden.id_factura) {
                throw new Error('Esta orden ya tiene una factura generada');
            }

            // Validar estado de la orden (debe estar finalizada/cerrada)
            const estadosValidos = ['FINALIZADA', 'CERRADA', 'COMPLETADA', 'ENTREGADA'];
            const estadoActual = orden.estado_nombre?.toUpperCase() || 'DESCONOCIDO';

            if (!estadosValidos.includes(estadoActual)) {
                throw new Error(`La orden debe estar en estado FINALIZADA, CERRADA, COMPLETADA o ENTREGADA para emitir factura. Estado actual: ${orden.estado_nombre || 'desconocido'}`);
            }

            // 2. OBTENER LÍNEAS DE LA ORDEN
            const lineasQuery = `
        SELECT 
          ol.*,
          p.nombre as producto_nombre,
          p.id_impuesto,
          imp.porcentaje as impuesto_porcentaje
        FROM ordenlinea ol
        LEFT JOIN producto p ON ol.id_producto = p.id
        LEFT JOIN impuesto imp ON p.id_impuesto = imp.id
        WHERE ol.id_orden = $1
        ORDER BY ol.id
      `;

            const lineasResult = await tx.query(lineasQuery, [idOrden]);

            if (lineasResult.rows.length === 0) {
                throw new Error('La orden no tiene líneas para facturar');
            }

            const lineasOrden = lineasResult.rows;

            // 3. OBTENER PAGOS DE LA ORDEN (si existen)
            const pagosQuery = `
        SELECT 
          op.*,
          mp.nombre as medio_pago_nombre
        FROM ordenpago op
        INNER JOIN mediopago mp ON op.id_medio_pago = mp.id
        WHERE op.id_orden = $1
      `;

            const pagosResult = await tx.query(pagosQuery, [idOrden]);
            const pagosOrden = pagosResult.rows;

            // 4. DETERMINAR LA SERIE DE FACTURA A USAR
            let idSerie = opciones.idSerie;

            if (!idSerie) {
                // Buscar la serie por defecto de la sucursal
                const serieQuery = `
          SELECT * FROM facturaserie
          WHERE id_sucursal = $1
            AND tipo_documento = 'FACTURA'
            AND es_por_defecto = true
            AND activo = true
          LIMIT 1
        `;

                const serieResult = await tx.query(serieQuery, [orden.sucursal_id]);

                if (serieResult.rows.length === 0) {
                    throw new Error('No hay serie de facturación configurada para esta sucursal');
                }

                idSerie = serieResult.rows[0].id;
            }

            // 5. BLOQUEAR LA SERIE Y OBTENER EL SIGUIENTE NÚMERO (CRITICAL SECTION)
            const serieBloqueoQuery = `
        SELECT * FROM facturaserie
        WHERE id = $1
        FOR UPDATE
      `;

            const serieResult = await tx.query(serieBloqueoQuery, [idSerie]);

            if (serieResult.rows.length === 0) {
                throw new Error('Serie de facturación no encontrada');
            }

            const serie = serieResult.rows[0];

            // Calcular el nuevo número correlativo
            const nuevoCorrelativo = parseInt(serie.ultimo_numero, 10) + 1;

            // Generar el número de factura formateado
            const numeroFactura = this.generarNumeroFactura(
                serie.prefijo,
                nuevoCorrelativo,
                serie.sufijo
            );

            // Actualizar el último número de la serie
            await tx.query(
                `UPDATE facturaserie SET ultimo_numero = $1 WHERE id = $2`,
                [nuevoCorrelativo, idSerie]
            );

            // 6. CALCULAR TOTALES DE LA FACTURA
            let totalBaseImponible = 0;
            let totalImpuestoIVA = 0;
            let totalFactura = 0;

            const lineasFactura = lineasOrden.map((linea, index) => {
                const cantidad = parseFloat(linea.cantidad || 0);
                const precioUnitario = parseFloat(linea.precio || 0);
                const porcentajeDescuento = parseFloat(linea.descuento || 0);

                let baseImponible = parseFloat(linea.subtotal || 0);
                if (baseImponible === 0 && precioUnitario > 0) {
                    const subtotal = cantidad * precioUnitario;
                    const descuento = subtotal * (porcentajeDescuento / 100);
                    baseImponible = subtotal - descuento;
                }

                const importeIVA = parseFloat(linea.iva || 0);
                const totalLinea = baseImponible + importeIVA;

                totalBaseImponible += baseImponible;
                totalImpuestoIVA += importeIVA;
                totalFactura += totalLinea;

                return {
                    id_producto: linea.id_producto,
                    descripcion: linea.descripcion || linea.producto_nombre || 'Sin descripción',
                    cantidad,
                    precio_unitario: precioUnitario,
                    porcentaje_descuento: porcentajeDescuento,
                    base_imponible: baseImponible,
                    importe_iva: importeIVA,
                    total_linea: totalLinea,
                    id_impuesto: linea.id_impuesto,
                    posicion: index + 1
                };
            });

            totalBaseImponible = Math.round(totalBaseImponible * 100) / 100;
            totalImpuestoIVA = Math.round(totalImpuestoIVA * 100) / 100;
            totalFactura = Math.round(totalFactura * 100) / 100;

            // 7. OBTENER CONFIGURACIÓN DE FACTURA DEL TENANT
            const configQuery = `
        SELECT * FROM facturaconfigtenant
        WHERE id_tenant = $1 AND es_por_defecto = true
        LIMIT 1
      `;

            const configResult = await tx.query(configQuery, [orden.id_tenant]);
            let facturaConfig = null;
            let configSnapshot = null;

            if (configResult.rows.length > 0) {
                facturaConfig = configResult.rows[0];
                configSnapshot = {
                    logo_url: facturaConfig.logo_url,
                    color_primario: facturaConfig.color_primario,
                    cabecera_html: facturaConfig.cabecera_html,
                    pie_html: facturaConfig.pie_html,
                    texto_legal: facturaConfig.texto_legal,
                    mostrar_columna_iva: facturaConfig.mostrar_columna_iva,
                    mostrar_columna_descuento: facturaConfig.mostrar_columna_descuento,
                    mostrar_domicilio_cliente: facturaConfig.mostrar_domicilio_cliente,
                    mostrar_matricula_vehiculo: facturaConfig.mostrar_matricula_vehiculo,
                    config_json: facturaConfig.config_json
                };
            }

            // 8. INSERTAR LA CABECERA DE LA FACTURA
            const fechaEmision = opciones.fechaEmision || new Date().toISOString().split('T')[0];

            let idUsuarioValidado = null;
            if (userId) {
                const userCheck = await tx.query('SELECT id FROM usuario WHERE id = $1', [userId]);
                if (userCheck.rows.length > 0) {
                    idUsuarioValidado = userId;
                }
            }

            const insertFacturaQuery = `
        INSERT INTO facturacabecera (
          id_sucursal,
          id_cliente,
          id_orden,
          id_serie,
          correlativo,
          numero_factura,
          fecha_emision,
          base_imponible,
          importe_iva,
          total,
          estado,
          observaciones,
          id_config_tenant,
          config_snapshot,
          creado_por
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;

            const facturaResult = await tx.query(insertFacturaQuery, [
                orden.sucursal_id,
                orden.cliente_id,
                idOrden,
                idSerie,
                nuevoCorrelativo,
                numeroFactura,
                fechaEmision,
                totalBaseImponible,
                totalImpuestoIVA,
                totalFactura,
                'EMITIDA',
                opciones.observaciones || null,
                facturaConfig?.id || null,
                configSnapshot ? JSON.stringify(configSnapshot) : null,
                idUsuarioValidado
            ]);

            const factura = facturaResult.rows[0];

            // 9. INSERTAR LAS LÍNEAS DE LA FACTURA
            const insertLineaQuery = `
        INSERT INTO facturalinea (
          id_factura,
          id_producto,
          descripcion,
          cantidad,
          precio_unitario,
          porcentaje_descuento,
          base_imponible,
          importe_iva,
          total_linea,
          id_impuesto,
          posicion
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

            const lineasInsertadas = [];
            for (const linea of lineasFactura) {
                const lineaResult = await tx.query(insertLineaQuery, [
                    factura.id,
                    linea.id_producto,
                    linea.descripcion,
                    linea.cantidad,
                    linea.precio_unitario,
                    linea.porcentaje_descuento,
                    linea.base_imponible,
                    linea.importe_iva,
                    linea.total_linea,
                    linea.id_impuesto,
                    linea.posicion
                ]);
                lineasInsertadas.push(lineaResult.rows[0]);
            }

            // 10. INSERTAR LOS PAGOS DE LA FACTURA
            const pagosInsertados = [];
            if (pagosOrden.length > 0) {
                const insertPagoQuery = `
          INSERT INTO facturapago (
            id_factura,
            id_orden_pago,
            id_medio_pago,
            importe,
            fecha_pago,
            referencia_externa
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;

                for (const pago of pagosOrden) {
                    const pagoResult = await tx.query(insertPagoQuery, [
                        factura.id,
                        pago.id,
                        pago.id_medio_pago,
                        pago.monto || 0,
                        pago.fecha || new Date().toISOString().split('T')[0],
                        pago.referencia || null
                    ]);
                    pagosInsertados.push(pagoResult.rows[0]);
                }
            }

            // 11. ACTUALIZAR LA ORDEN CON EL ID DE LA FACTURA
            await tx.query(
                `UPDATE orden SET id_factura = $1 WHERE id = $2`,
                [factura.id, idOrden]
            );

            return {
                factura,
                lineas: lineasInsertadas,
                pagos: pagosInsertados,
                orden: {
                    id: orden.id,
                    numero_orden: orden.numero_orden,
                    cliente: orden.cliente_nombre,
                    vehiculo: orden.vehiculo_matricula
                }
            };
        });
    }

    /**
     * Obtiene una factura por ID con todas sus líneas y pagos
     * @param {number} idFactura - ID de la factura
     * @returns {Promise<object>} Factura completa
     */
    async obtenerFacturaCompleta(ctx, idFactura) {
        const db = getTenantDb(ctx);

        // Obtener cabecera de la factura
        const facturaQuery = `
        SELECT 
          fc.*,
          s.nombre as sucursal_nombre,
          s.direccion as sucursal_direccion,
          cf.nombre as cliente_nombre,
          cf.email as cliente_email,
          cf.telefono as cliente_telefono,
          cf.direccion as cliente_direccion,
          cf.documento as cliente_cif,
          fs.prefijo as serie_prefijo,
          fs.nombre_serie as serie_nombre,
          o.id as numero_orden,
          v.matricula as vehiculo_matricula,
          v.marca as vehiculo_marca,
          v.modelo as vehiculo_modelo
        FROM facturacabecera fc
        INNER JOIN sucursal s ON fc.id_sucursal = s.id
        INNER JOIN clientefinal cf ON fc.id_cliente = cf.id
        INNER JOIN facturaserie fs ON fc.id_serie = fs.id
        LEFT JOIN orden o ON fc.id_orden = o.id
        LEFT JOIN vehiculo v ON o.id_vehiculo = v.id
        WHERE fc.id = $1
      `;

        const facturaResult = await db.query(facturaQuery, [idFactura]);

        if (facturaResult.rows.length === 0) {
            throw new Error('Factura no encontrada');
        }

        const factura = facturaResult.rows[0];

        // Obtener líneas
        const lineasQuery = `
        SELECT 
          fl.*,
          p.nombre as producto_nombre,
          imp.nombre as impuesto_nombre,
          imp.porcentaje as impuesto_porcentaje
        FROM facturalinea fl
        LEFT JOIN producto p ON fl.id_producto = p.id
        LEFT JOIN impuesto imp ON fl.id_impuesto = imp.id
        WHERE fl.id_factura = $1
        ORDER BY fl.posicion
      `;

        const lineasResult = await db.query(lineasQuery, [idFactura]);

        // Obtener pagos
        const pagosQuery = `
        SELECT 
          fp.*,
          mp.nombre as medio_pago_nombre
        FROM facturapago fp
        INNER JOIN mediopago mp ON fp.id_medio_pago = mp.id
        WHERE fp.id_factura = $1
      `;

        const pagosResult = await db.query(pagosQuery, [idFactura]);

        // Si no hay config_snapshot, obtener la configuración actual del tenant
        let configSnapshot = factura.config_snapshot;
        if (!configSnapshot || Object.keys(configSnapshot).length === 0) {
            // Con RLS, podemos consultar facturaconfigtenant directamente si existe una por defecto
            const configQuery = await db.query(
                'SELECT * FROM facturaconfigtenant WHERE es_por_defecto = true LIMIT 1'
            );
            if (configQuery.rows.length > 0) {
                const cfg = configQuery.rows[0];
                configSnapshot = {
                    logo_url: cfg.logo_url,
                    color_primario: cfg.color_primario,
                    cabecera_html: cfg.cabecera_html,
                    pie_html: cfg.pie_html,
                    texto_legal: cfg.texto_legal,
                    mostrar_columna_iva: cfg.mostrar_columna_iva,
                    mostrar_columna_descuento: cfg.mostrar_columna_descuento,
                    mostrar_domicilio_cliente: cfg.mostrar_domicilio_cliente,
                    mostrar_matricula_vehiculo: cfg.mostrar_matricula_vehiculo,
                    config_json: cfg.config_json
                };
            }
        }

        return {
            ...factura,
            config_snapshot: configSnapshot,
            lineas: lineasResult.rows,
            pagos: pagosResult.rows
        };
    }

    /**
     * Lista facturas con filtros
     * @param {object} filtros - Filtros de búsqueda
     * @returns {Promise<Array>} Lista de facturas
     */
    async listarFacturas(ctx, filtros = {}) {
        const db = getTenantDb(ctx);

        const condiciones = ['1=1'];
        const valores = [];
        let paramIndex = 1;

        if (filtros.id_sucursal) {
            condiciones.push(`fc.id_sucursal = $${paramIndex}`);
            valores.push(filtros.id_sucursal);
            paramIndex++;
        }

        if (filtros.estado) {
            condiciones.push(`fc.estado = $${paramIndex}`);
            valores.push(filtros.estado);
            paramIndex++;
        }

        if (filtros.fecha_desde) {
            condiciones.push(`fc.fecha_emision >= $${paramIndex}`);
            valores.push(filtros.fecha_desde);
            paramIndex++;
        }

        if (filtros.fecha_hasta) {
            condiciones.push(`fc.fecha_emision <= $${paramIndex}`);
            valores.push(filtros.fecha_hasta);
            paramIndex++;
        }

        if (filtros.texto) {
            condiciones.push(`(
          fc.numero_factura ILIKE $${paramIndex} OR
          cf.nombre ILIKE $${paramIndex} OR
          v.matricula ILIKE $${paramIndex}
        )`);
            valores.push(`%${filtros.texto}%`);
            paramIndex++;
        }

        const query = `
        SELECT 
          fc.*,
          s.nombre as sucursal_nombre,
          cf.nombre as cliente_nombre,
          v.matricula as vehicular_matricula,
          CASE WHEN fc.pdf_url IS NOT NULL THEN true ELSE false END as tiene_pdf
        FROM facturacabecera fc
        INNER JOIN sucursal s ON fc.id_sucursal = s.id
        INNER JOIN clientefinal cf ON fc.id_cliente = cf.id
        LEFT JOIN orden o ON fc.id_orden = o.id
        LEFT JOIN vehiculo v ON o.id_vehiculo = v.id
        WHERE ${condiciones.join(' AND ')}
        ORDER BY fc.fecha_emision DESC, fc.id DESC
        LIMIT ${filtros.limit || 100}
        OFFSET ${filtros.offset || 0}
      `;

        const result = await db.query(query, valores);
        return result.rows;
    }

    /**
     * Lista órdenes pendientes de facturar
     * @param {object} filtros - Filtros de búsqueda
     * @returns {Promise<Array>} Lista de órdenes
     */
    async listarOrdenesPendientesFactura(ctx, filtros = {}) {
        const db = getTenantDb(ctx);

        const condiciones = [
            'o.id_factura IS NULL',
            "eo.nombre IN ('Completada', 'Entregada', 'COMPLETADA', 'ENTREGADA', 'CERRADA', 'Cerrada')"
        ];
        const valores = [];
        let paramIndex = 1;

        if (filtros.id_sucursal) {
            condiciones.push(`o.id_sucursal = $${paramIndex}`);
            valores.push(filtros.id_sucursal);
            paramIndex++;
        }

        const query = `
        SELECT 
          o.id,
          o.numero_orden,
          o.fecha_creacion,
          o.total as importe_total,
          cf.nombre as cliente_nombre,
          v.matricula as vehiculo_matricula,
          v.marca as vehiculo_marca,
          v.modelo as vehiculo_modelo,
          s.nombre as sucursal_nombre,
          eo.nombre as estado_nombre
        FROM orden o
        INNER JOIN sucursal s ON o.id_sucursal = s.id
        INNER JOIN clientefinal cf ON o.id_cliente = cf.id
        LEFT JOIN vehiculo v ON o.id_vehiculo = v.id
        LEFT JOIN estadoorden eo ON o.id_estado_orden = eo.id
        WHERE ${condiciones.join(' AND ')}
        ORDER BY o.fecha_creacion DESC
        LIMIT ${filtros.limit || 100}
        OFFSET ${filtros.offset || 0}
      `;

        const result = await db.query(query, valores);
        return result.rows;
    }
    /**
    * Obtiene estadísticas generales de facturación
    */
    async obtenerEstadisticasGeneral(ctx, idSucursal = null) {
        const db = getTenantDb(ctx);
        const params = [];
        let sucursalFiltro = '';
        if (idSucursal) {
            params.push(idSucursal);
            sucursalFiltro = `AND fc.id_sucursal = $1`;
        }

        // 1. Total Facturado (Facturas Emitidas, no anuladas)
        const facturadoQuery = `
            SELECT 
                COUNT(*) as cantidad, 
                COALESCE(SUM(fc.total), 0) as total 
            FROM facturacabecera fc
            WHERE fc.estado = 'EMITIDA'
            ${sucursalFiltro}
        `;
        const facturadoResult = await db.query(facturadoQuery, params);

        // 2. Pendiente de Facturar
        let pendientesSucursalFiltro = '';
        if (idSucursal) {
            pendientesSucursalFiltro = `AND o.id_sucursal = $1`;
        }
        const pendientesQuery = `
            SELECT 
                COUNT(*) as cantidad, 
                COALESCE(SUM(o.total_neto), 0) as total 
            FROM orden o
            JOIN estadoorden eo ON o.id_estado_orden = eo.id
            WHERE o.id_factura IS NULL 
            AND eo.nombre IN ('Completada', 'Entregada', 'COMPLETADA', 'ENTREGADA', 'CERRADA', 'Cerrada')
            ${pendientesSucursalFiltro}
        `;
        const pendientesResult = await db.query(pendientesQuery, params);

        // 3. Facturas del mes actual
        const mesQuery = `
            SELECT COUNT(*) as cantidad
            FROM facturacabecera fc
            WHERE fc.estado = 'EMITIDA'
            AND EXTRACT(MONTH FROM fc.fecha_emision) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM fc.fecha_emision) = EXTRACT(YEAR FROM CURRENT_DATE)
            ${sucursalFiltro}
        `;
        const mesResult = await db.query(mesQuery, params);

        return {
            total_facturado: parseFloat(facturadoResult.rows[0].total),
            cantidad_facturas: parseInt(facturadoResult.rows[0].cantidad),
            total_pendiente: parseFloat(pendientesResult.rows[0].total),
            cantidad_pendientes: parseInt(pendientesResult.rows[0].cantidad),
            facturas_mes: parseInt(mesResult.rows[0].cantidad)
        };
    }
}

module.exports = new FacturacionService();
