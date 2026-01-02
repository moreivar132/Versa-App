const pool = require('../db');

class VentaPDFService {
    /**
     * Genera el HTML del documento de venta (ticket/factura)
     */
    async generarDocumentoVenta(idVenta, tenantId) {
        // Obtener datos de la venta
        const ventaQuery = `
            SELECT 
                v.*,
                c.nombre as cliente_nombre,
                c.documento as cliente_documento,
                c.telefono as cliente_telefono,
                c.email as cliente_email,
                c.direccion as cliente_direccion,
                s.nombre as sucursal_nombre
            FROM venta v
            JOIN clientefinal c ON v.id_cliente = c.id
            JOIN sucursal s ON v.id_sucursal = s.id
            WHERE v.id = $1 AND v.id_tenant = $2
        `;
        const ventaResult = await pool.query(ventaQuery, [idVenta, tenantId]);

        if (ventaResult.rows.length === 0) {
            throw new Error('Venta no encontrada');
        }

        const venta = ventaResult.rows[0];

        // Obtener líneas de la venta
        const lineasQuery = `
            SELECT vl.*, p.nombre as producto_nombre, p.codigo_barras
            FROM ventalinea vl
            LEFT JOIN producto p ON vl.id_producto = p.id
            WHERE vl.id_venta = $1
            ORDER BY vl.id
        `;
        const lineasResult = await pool.query(lineasQuery, [idVenta]);
        const lineas = lineasResult.rows;

        // Obtener pagos de la venta
        const pagosQuery = `
            SELECT vp.*, mp.nombre as medio_pago_nombre
            FROM ventapago vp
            JOIN mediopago mp ON vp.id_medio_pago = mp.id
            WHERE vp.id_venta = $1
        `;
        const pagosResult = await pool.query(pagosQuery, [idVenta]);
        const pagos = pagosResult.rows;

        // Generar HTML del documento
        return this.generarHTML(venta, lineas, pagos);
    }

    generarHTML(venta, lineas, pagos) {
        const fecha = new Date(venta.fecha);
        const fechaFormateada = fecha.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        const formatCurrency = (num) => {
            return parseFloat(num || 0).toLocaleString('es-ES', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }) + ' €';
        };

        const lineasHTML = lineas.map(l => `
            <tr>
                <td style="padding: 10px; border-bottom: 1px solid #333;">${l.descripcion || l.producto_nombre || 'Producto'}</td>
                <td style="padding: 10px; border-bottom: 1px solid #333; text-align: center;">${l.cantidad}</td>
                <td style="padding: 10px; border-bottom: 1px solid #333; text-align: right;">${formatCurrency(l.precio)}</td>
                <td style="padding: 10px; border-bottom: 1px solid #333; text-align: center;">${l.descuento || 0}%</td>
                <td style="padding: 10px; border-bottom: 1px solid #333; text-align: right; font-weight: bold;">${formatCurrency(l.subtotal)}</td>
            </tr>
        `).join('');

        const pagosHTML = pagos.map(p => `
            <div style="display: flex; justify-content: space-between; padding: 5px 0;">
                <span>${p.medio_pago_nombre}</span>
                <span style="font-weight: bold;">${formatCurrency(p.importe)}</span>
            </div>
        `).join('');

        const totalPagado = pagos.reduce((sum, p) => sum + parseFloat(p.importe || 0), 0);
        const pendiente = parseFloat(venta.total_neto) - totalPagado;
        const estadoPago = pendiente <= 0 ? 'PAGADO' : 'PENDIENTE';
        const estadoColor = pendiente <= 0 ? '#22c55e' : '#f59e0b';

        return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ticket de Venta #${venta.id}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: #fff;
            min-height: 100vh;
            padding: 40px 20px;
        }
        .ticket {
            max-width: 450px;
            margin: 0 auto;
            background: #1e1e2e;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
        }
        .header {
            background: linear-gradient(135deg, #ff652b 0%, #ff8a5c 100%);
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 5px;
        }
        .header .ticket-number {
            font-size: 14px;
            opacity: 0.9;
        }
        .content {
            padding: 25px;
        }
        .info-section {
            margin-bottom: 20px;
            padding-bottom: 20px;
            border-bottom: 1px dashed #333;
        }
        .info-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 14px;
        }
        .info-label {
            color: #9ca3af;
        }
        .info-value {
            font-weight: 500;
        }
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        .items-table th {
            background: #2a2a3e;
            padding: 12px 10px;
            text-align: left;
            font-size: 12px;
            text-transform: uppercase;
            color: #9ca3af;
        }
        .totals {
            background: #2a2a3e;
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 20px;
        }
        .total-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            font-size: 14px;
        }
        .total-row.grand-total {
            font-size: 20px;
            font-weight: 700;
            color: #ff652b;
            border-top: 1px solid #444;
            padding-top: 15px;
            margin-top: 15px;
        }
        .estado-badge {
            display: inline-block;
            padding: 8px 20px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            background: ${estadoColor}20;
            color: ${estadoColor};
            margin-top: 10px;
        }
        .pagos-section {
            margin-top: 20px;
            padding: 15px;
            background: #2a2a3e;
            border-radius: 12px;
        }
        .pagos-section h3 {
            font-size: 14px;
            color: #9ca3af;
            margin-bottom: 10px;
        }
        .footer {
            text-align: center;
            padding: 20px;
            border-top: 1px dashed #333;
            color: #666;
            font-size: 12px;
        }
        @media print {
            body { background: white; color: black; padding: 0; }
            .ticket { box-shadow: none; }
            .header { background: #ff652b; -webkit-print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <div class="ticket">
        <div class="header">
            <h1>TICKET DE VENTA</h1>
            <div class="ticket-number">#${String(venta.id).padStart(6, '0')}</div>
        </div>
        
        <div class="content">
            <div class="info-section">
                <div class="info-row">
                    <span class="info-label">Fecha:</span>
                    <span class="info-value">${fechaFormateada}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Sucursal:</span>
                    <span class="info-value">${venta.sucursal_nombre || 'Principal'}</span>
                </div>
                <div class="info-row">
                    <span class="info-label">Cliente:</span>
                    <span class="info-value">${venta.cliente_nombre}</span>
                </div>
                ${venta.cliente_documento ? `
                <div class="info-row">
                    <span class="info-label">NIF/CIF:</span>
                    <span class="info-value">${venta.cliente_documento}</span>
                </div>
                ` : ''}
            </div>

            <table class="items-table">
                <thead>
                    <tr>
                        <th>Descripción</th>
                        <th style="text-align: center;">Cant.</th>
                        <th style="text-align: right;">Precio</th>
                        <th style="text-align: center;">Dto.</th>
                        <th style="text-align: right;">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${lineasHTML}
                </tbody>
            </table>

            <div class="totals">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>${formatCurrency(venta.total_bruto)}</span>
                </div>
                <div class="total-row">
                    <span>IVA (21%):</span>
                    <span>${formatCurrency(venta.total_iva)}</span>
                </div>
                <div class="total-row grand-total">
                    <span>TOTAL:</span>
                    <span>${formatCurrency(venta.total_neto)}</span>
                </div>
                <div style="text-align: center;">
                    <span class="estado-badge">${estadoPago}</span>
                </div>
            </div>

            ${pagos.length > 0 ? `
            <div class="pagos-section">
                <h3>Forma de Pago</h3>
                ${pagosHTML}
            </div>
            ` : ''}
        </div>

        <div class="footer">
            <p>Gracias por su compra</p>
            <p style="margin-top: 5px;">Documento generado el ${new Date().toLocaleString('es-ES')}</p>
        </div>
    </div>

    <script>
        // Auto-print if opened for printing
        if (window.location.search.includes('print=true')) {
            window.onload = () => setTimeout(() => window.print(), 500);
        }
    </script>
</body>
</html>
        `;
    }
}

module.exports = new VentaPDFService();
