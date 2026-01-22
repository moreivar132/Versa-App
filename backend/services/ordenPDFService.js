/**
 * Servicio de generación de documentos de Órdenes de Trabajo
 * 
 * Genera documentos HTML de órdenes de trabajo con configuración personalizable.
 * Similar al servicio de facturas pero para órdenes.
 */

const { getTenantDb } = require('../src/core/db/tenant-db');

class OrdenPDFService {

    /**
     * Obtiene la configuración de órdenes para un tenant
     * @param {number} tenantId - ID del tenant
     * @returns {Promise<Object>} Configuración de órdenes
     */
    async obtenerConfiguracionOrdenes(tenantId) {
        try {
            const db = getTenantDb({ tenantId });
            const result = await db.query(`
                SELECT * FROM ordenconfigtenant
                WHERE id_tenant = $1 AND es_por_defecto = true
                LIMIT 1
            `, [tenantId]);

            if (result.rows.length > 0) {
                return result.rows[0];
            }

            // Si no existe, devolver configuración por defecto
            return {
                color_primario: '#ff652b',
                nombre_taller: 'GOVERSA',
                logo_url: '',
                cabecera_html: '',
                pie_html: '',
                condiciones_html: '',
                mostrar_logo: true,
                mostrar_matricula: true,
                mostrar_kilometraje: true,
                mostrar_tecnico: true,
                mostrar_precios: true,
                mostrar_iva: true,
                mostrar_firma_cliente: true
            };
        } catch (error) {
            console.error('Error obteniendo configuración de órdenes:', error);
            return {}; // Configuración vacía por defecto
        }
    }

    /**
     * Obtiene los datos completos de una orden para generar el documento
     * @param {number} ordenId - ID de la orden
     * @returns {Promise<Object>} Datos completos de la orden
     */
    async obtenerOrdenCompleta(ordenId, tenantId) {
        const db = getTenantDb({ tenantId });

        // Obtener cabecera de la orden
        const ordenResult = await db.query(`
            SELECT 
                o.*,
                c.nombre as cliente_nombre,
                c.telefono as cliente_telefono,
                c.email as cliente_email,
                c.direccion as cliente_direccion,
                c.documento as cliente_cif,
                v.matricula as vehiculo_matricula,
                v.marca as vehiculo_marca,
                v.modelo as vehiculo_modelo,
                v."year" as vehiculo_anio,
                v."Color" as vehiculo_color,
                v."Serial" as vehiculo_vin,
                s.nombre as sucursal_nombre,
                s.direccion as sucursal_direccion,
                s.id_tenant,
                eo.nombre as estado_nombre,
                eo.codigo as estado_codigo,
                u.nombre as tecnico_nombre
            FROM orden o
            LEFT JOIN clientefinal c ON o.id_cliente = c.id
            LEFT JOIN vehiculo v ON o.id_vehiculo = v.id
            LEFT JOIN sucursal s ON o.id_sucursal = s.id
            LEFT JOIN estadoorden eo ON o.id_estado_orden = eo.id
            LEFT JOIN usuario u ON o.id_mecanico = u.id
            WHERE o.id = $1
        `, [ordenId]);

        if (ordenResult.rows.length === 0) {
            throw new Error('Orden no encontrada');
        }

        const orden = ordenResult.rows[0];

        // Obtener líneas de la orden con porcentaje de impuesto
        const lineasResult = await db.query(`
            SELECT 
                ol.*,
                p.nombre as producto_nombre,
                p.codigo_barras,
                i.porcentaje as impuesto_porcentaje
            FROM ordenlinea ol
            LEFT JOIN producto p ON ol.id_producto = p.id
            LEFT JOIN impuesto i ON ol.id_impuesto = i.id
            WHERE ol.id_orden = $1
            ORDER BY ol.id
        `, [ordenId]);

        // Obtener pagos de la orden
        const pagosResult = await db.query(`
            SELECT 
                op.*,
                mp.nombre as medio_pago_nombre
            FROM ordenpago op
            LEFT JOIN mediopago mp ON op.id_medio_pago = mp.id
            WHERE op.id_orden = $1
            ORDER BY op.created_at
        `, [ordenId]);

        // Obtener configuración del tenant
        const config = await this.obtenerConfiguracionOrdenes(orden.id_tenant);

        return {
            ...orden,
            lineas: lineasResult.rows,
            pagos: pagosResult.rows,
            config
        };
    }

    /**
     * Genera el HTML del documento de orden de trabajo
     * @param {Object} ordenCompleta - Datos completos de la orden
     * @returns {string} HTML del documento
     */
    generarHTMLOrden(ordenCompleta) {
        const config = ordenCompleta.config || {};
        const colorPrimario = config.color_primario || '#ff652b';
        const nombreTaller = config.nombre_taller || 'GOVERSA';
        const logoUrl = config.logo_url || '';
        const cabeceraHtml = config.cabecera_html || '';
        const pieHtml = config.pie_html || '';
        const condicionesHtml = config.condiciones_html || '';

        const mostrarLogo = config.mostrar_logo !== false;
        const mostrarMatricula = config.mostrar_matricula !== false;
        const mostrarKilometraje = config.mostrar_kilometraje !== false;
        const mostrarTecnico = config.mostrar_tecnico !== false;
        const mostrarPrecios = config.mostrar_precios !== false;
        const mostrarIVA = config.mostrar_iva !== false;
        const mostrarFirmaCliente = config.mostrar_firma_cliente !== false;

        // Formatear fechas
        const fechaIngreso = ordenCompleta.fecha_ingreso
            ? new Date(ordenCompleta.fecha_ingreso).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric'
            })
            : 'Sin fecha';

        const fechaSalida = ordenCompleta.fecha_salida_estimada
            ? new Date(ordenCompleta.fecha_salida_estimada).toLocaleDateString('es-ES', {
                year: 'numeric', month: 'long', day: 'numeric'
            })
            : 'Por determinar';

        // Generar tabla de líneas
        let lineasHTML = '';
        let subtotal = 0;
        let totalIVA = 0;

        ordenCompleta.lineas.forEach((linea, index) => {
            const descripcion = linea.descripcion || linea.producto_nombre || 'Servicio';
            const cantidad = parseFloat(linea.cantidad) || 1;
            const precioUnit = parseFloat(linea.precio) || 0;

            // IMPORTANTE: linea.iva contiene el MONTO del IVA, no el porcentaje
            // El porcentaje viene de impuesto_porcentaje (del JOIN con tabla impuesto)
            let ivaPorcentaje = 0;
            const montoIvaGuardado = parseFloat(linea.iva) || 0;
            const subtotalGuardado = parseFloat(linea.subtotal) || (cantidad * precioUnit);

            // 1. Usar el porcentaje del JOIN si está disponible
            if (linea.impuesto_porcentaje !== null && linea.impuesto_porcentaje !== undefined) {
                ivaPorcentaje = parseFloat(linea.impuesto_porcentaje);
            }
            // 2. Si no, calcular el porcentaje desde el monto guardado
            else if (subtotalGuardado > 0 && montoIvaGuardado > 0) {
                const porcentajeCalculado = (montoIvaGuardado / subtotalGuardado) * 100;
                // Redondear a valores comunes de IVA
                const valoresIvaComunes = [0, 4, 10, 21];
                const ivaRedondeado = valoresIvaComunes.find(v => Math.abs(v - porcentajeCalculado) < 0.5);
                ivaPorcentaje = ivaRedondeado !== undefined ? ivaRedondeado : Math.round(porcentajeCalculado);
            }
            // 3. Si no hay monto de IVA guardado, asumir 0% (exento de IVA)
            else if (montoIvaGuardado === 0) {
                ivaPorcentaje = 0; // Sin IVA registrado = exento
            }

            // Usar los valores guardados en la BD (ya calculados correctamente al crear la orden)
            const baseLinea = subtotalGuardado;
            const ivaLinea = montoIvaGuardado;
            const totalLinea = baseLinea + ivaLinea;

            subtotal += baseLinea;
            totalIVA += ivaLinea;

            lineasHTML += `
                <tr>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${index + 1}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee;">${descripcion}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${cantidad}</td>
                    ${mostrarPrecios ? `
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">${precioUnit.toFixed(2)} €</td>
                        ${mostrarIVA ? `<td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;">${ivaPorcentaje}%</td>` : ''}
                        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${totalLinea.toFixed(2)} €</td>
                    ` : ''}
                </tr>
            `;
        });

        const total = subtotal + totalIVA;

        // HTML completo
        const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Orden de Trabajo #${ordenCompleta.id}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            padding: 30px;
            background: #ffffff;
            color: #333;
            font-size: 14px;
        }
        .orden-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border: 1px solid #ddd;
            padding: 30px;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px solid ${colorPrimario};
        }
        .logo-section {
            flex: 1;
        }
        .logo {
            max-width: 180px;
            max-height: 70px;
        }
        .taller-name {
            font-size: 24px;
            font-weight: bold;
            color: ${colorPrimario};
            margin-bottom: 5px;
        }
        .orden-info {
            text-align: right;
        }
        .orden-numero {
            font-size: 22px;
            font-weight: bold;
            color: ${colorPrimario};
            margin-bottom: 8px;
        }
        .estado-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 15px;
            font-weight: bold;
            font-size: 12px;
            text-transform: uppercase;
            background: ${colorPrimario};
            color: white;
            margin-top: 8px;
        }
        .datos-section {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            margin-bottom: 25px;
        }
        .datos-box {
            flex: 1;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 8px;
            border-left: 4px solid ${colorPrimario};
        }
        .datos-box h3 {
            color: ${colorPrimario};
            margin-bottom: 10px;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .datos-box p {
            margin: 4px 0;
            font-size: 13px;
            line-height: 1.5;
        }
        .vehiculo-section {
            background: #f5f5f5;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 25px;
        }
        .vehiculo-section h3 {
            color: ${colorPrimario};
            margin-bottom: 10px;
            font-size: 13px;
            text-transform: uppercase;
        }
        .vehiculo-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
        }
        .vehiculo-item {
            display: flex;
            flex-direction: column;
        }
        .vehiculo-label {
            font-size: 11px;
            color: #666;
            text-transform: uppercase;
        }
        .vehiculo-value {
            font-weight: bold;
            font-size: 14px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th {
            background: ${colorPrimario};
            color: white;
            padding: 12px 10px;
            text-align: left;
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
        }
        .totales {
            margin-top: 20px;
            text-align: right;
        }
        .totales table {
            margin-left: auto;
            width: 280px;
        }
        .totales td {
            padding: 8px 10px;
            border-bottom: 1px solid #eee;
        }
        .totales .total-final {
            font-size: 16px;
            font-weight: bold;
            background: ${colorPrimario};
            color: white;
        }
        .observaciones {
            margin-top: 25px;
            padding: 15px;
            background: #fffbf0;
            border-left: 4px solid #ffc107;
            border-radius: 4px;
        }
        .observaciones h4 {
            color: #333;
            margin-bottom: 8px;
            font-size: 13px;
        }
        .firma-section {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
            gap: 40px;
        }
        .firma-box {
            flex: 1;
            text-align: center;
        }
        .firma-linea {
            border-top: 1px solid #333;
            margin-top: 60px;
            padding-top: 10px;
            font-size: 12px;
            color: #666;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            font-size: 11px;
            color: #666;
            text-align: center;
        }
        .condiciones {
            margin-top: 20px;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 4px;
            font-size: 11px;
            color: #666;
        }
        @media print {
            body { padding: 0; }
            .orden-container { border: none; box-shadow: none; }
        }
    </style>
</head>
<body>
    <div class="orden-container">
        <!-- CABECERA -->
        <div class="header">
            <div class="logo-section">
                ${mostrarLogo && logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo">` : ''}
                <div class="taller-name">${nombreTaller}</div>
                ${cabeceraHtml ? `<div style="font-size: 12px; margin-top: 5px;">${cabeceraHtml}</div>` : `
                    <div style="font-size: 12px; color: #666;">
                        ${ordenCompleta.sucursal_direccion || ''}<br>
                        ${ordenCompleta.sucursal_telefono ? `Tel: ${ordenCompleta.sucursal_telefono}` : ''}
                    </div>
                `}
            </div>
            <div class="orden-info">
                <div class="orden-numero">ORDEN DE TRABAJO #${ordenCompleta.id}</div>
                <div><strong>Fecha Ingreso:</strong> ${fechaIngreso}</div>
                <div><strong>Salida Estimada:</strong> ${fechaSalida}</div>
                <span class="estado-badge">${ordenCompleta.estado_nombre || 'Pendiente'}</span>
            </div>
        </div>

        <!-- DATOS CLIENTE Y TALLER -->
        <div class="datos-section">
            <div class="datos-box">
                <h3>Datos del Cliente</h3>
                <p><strong>${ordenCompleta.cliente_nombre || 'Sin cliente'}</strong></p>
                ${ordenCompleta.cliente_cif ? `<p>CIF/NIF: ${ordenCompleta.cliente_cif}</p>` : ''}
                ${ordenCompleta.cliente_direccion ? `<p>${ordenCompleta.cliente_direccion}</p>` : ''}
                ${ordenCompleta.cliente_telefono ? `<p>Tel: ${ordenCompleta.cliente_telefono}</p>` : ''}
                ${ordenCompleta.cliente_email ? `<p>Email: ${ordenCompleta.cliente_email}</p>` : ''}
            </div>
            <div class="datos-box">
                <h3>Datos del Taller</h3>
                <p><strong>${ordenCompleta.sucursal_nombre || nombreTaller}</strong></p>
                ${ordenCompleta.sucursal_direccion ? `<p>${ordenCompleta.sucursal_direccion}</p>` : ''}
                ${mostrarTecnico && ordenCompleta.tecnico_nombre ? `<p><strong>Técnico:</strong> ${ordenCompleta.tecnico_nombre}</p>` : ''}
            </div>
        </div>

        <!-- DATOS DEL VEHÍCULO -->
        ${mostrarMatricula ? `
        <div class="vehiculo-section">
            <h3>Datos del Vehículo</h3>
            <div class="vehiculo-grid">
                <div class="vehiculo-item">
                    <span class="vehiculo-label">Matrícula</span>
                    <span class="vehiculo-value">${ordenCompleta.vehiculo_matricula || 'N/A'}</span>
                </div>
                <div class="vehiculo-item">
                    <span class="vehiculo-label">Marca / Modelo</span>
                    <span class="vehiculo-value">${ordenCompleta.vehiculo_marca || ''} ${ordenCompleta.vehiculo_modelo || ''}</span>
                </div>
                <div class="vehiculo-item">
                    <span class="vehiculo-label">Año</span>
                    <span class="vehiculo-value">${ordenCompleta.vehiculo_anio || 'N/A'}</span>
                </div>
                ${mostrarKilometraje ? `
                <div class="vehiculo-item">
                    <span class="vehiculo-label">Kilometraje</span>
                    <span class="vehiculo-value">${ordenCompleta.kilometraje ? `${ordenCompleta.kilometraje} km` : 'N/A'}</span>
                </div>
                ` : ''}
                ${ordenCompleta.vehiculo_vin ? `
                <div class="vehiculo-item">
                    <span class="vehiculo-label">VIN</span>
                    <span class="vehiculo-value">${ordenCompleta.vehiculo_vin}</span>
                </div>
                ` : ''}
                ${ordenCompleta.vehiculo_color ? `
                <div class="vehiculo-item">
                    <span class="vehiculo-label">Color</span>
                    <span class="vehiculo-value">${ordenCompleta.vehiculo_color}</span>
                </div>
                ` : ''}
            </div>
        </div>
        ` : ''}

        <!-- TRABAJOS / LÍNEAS -->
        <h3 style="color: ${colorPrimario}; margin-bottom: 10px; font-size: 14px; text-transform: uppercase;">Trabajos Realizados</h3>
        <table>
            <thead>
                <tr>
                    <th style="width: 40px;">#</th>
                    <th>Descripción</th>
                    <th style="width: 80px; text-align: center;">Cant.</th>
                    ${mostrarPrecios ? `
                        <th style="width: 100px; text-align: right;">Precio Unit.</th>
                        ${mostrarIVA ? '<th style="width: 60px; text-align: center;">IVA</th>' : ''}
                        <th style="width: 100px; text-align: right;">Total</th>
                    ` : ''}
                </tr>
            </thead>
            <tbody>
                ${lineasHTML || '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #666;">Sin líneas registradas</td></tr>'}
            </tbody>
        </table>

        <!-- TOTALES -->
        ${mostrarPrecios ? `
        <div class="totales">
            <table>
                <tr>
                    <td>Subtotal:</td>
                    <td style="text-align: right;"><strong>${subtotal.toFixed(2)} €</strong></td>
                </tr>
                ${mostrarIVA ? `
                <tr>
                    <td>IVA:</td>
                    <td style="text-align: right;"><strong>${totalIVA.toFixed(2)} €</strong></td>
                </tr>
                ` : ''}
                <tr class="total-final">
                    <td>TOTAL:</td>
                    <td style="text-align: right;"><strong>${total.toFixed(2)} €</strong></td>
                </tr>
            </table>
        </div>
        ` : ''}

        <!-- OBSERVACIONES -->
        ${ordenCompleta.observaciones ? `
        <div class="observaciones">
            <h4>Observaciones</h4>
            <p>${ordenCompleta.observaciones}</p>
        </div>
        ` : ''}

        <!-- CONDICIONES -->
        ${condicionesHtml ? `
        <div class="condiciones">
            ${condicionesHtml}
        </div>
        ` : ''}

        <!-- FIRMAS -->
        ${mostrarFirmaCliente ? `
        <div class="firma-section">
            <div class="firma-box">
                <div class="firma-linea">Firma del Taller</div>
            </div>
            <div class="firma-box">
                <div class="firma-linea">Firma del Cliente</div>
            </div>
        </div>
        ` : ''}

        <!-- PIE -->
        <div class="footer">
            ${pieHtml || `<p>Gracias por confiar en ${nombreTaller}</p>`}
            <p style="margin-top: 10px;">Documento generado el ${new Date().toLocaleDateString('es-ES')} - ${nombreTaller} © ${new Date().getFullYear()}</p>
        </div>
    </div>
</body>
</html>
        `;

        return html;
    }

    /**
     * Genera el documento HTML de una orden
     * @param {number} ordenId - ID de la orden
     * @returns {Promise<string>} HTML del documento
     */
    async generarDocumentoOrden(ordenId, tenantId) {
        if (!tenantId) throw new Error('TenantID required for generarDocumentoOrden');
        const ordenCompleta = await this.obtenerOrdenCompleta(ordenId, tenantId);
        return this.generarHTMLOrden(ordenCompleta);
    }
}

module.exports = new OrdenPDFService();
