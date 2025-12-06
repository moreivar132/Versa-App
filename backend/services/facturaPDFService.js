/**
 * Servicio de generación de PDFs de facturas
 * 
 * Genera PDFs de facturas usando HTML y la librería puppeteer o similar.
 * Por ahora, generaremos el HTML de la factura y lo guardaremos como archivo.
 * 
 * NOTA: Para generar PDFs reales, instalará puppeteer:
 * npm install puppeteer
 */

const fs = require('fs');
const path = require('path');
const facturacionService = require('./facturacionService');
const pool = require('../db');

class FacturaPDFService {

  /**
   * Genera el HTML de una factura
   * @param {object} facturaCompleta - Factura con líneas y pagos
   * @returns {string} HTML de la factura
   */
  generarHTMLFactura(facturaCompleta) {
    const config = facturaCompleta.config_snapshot || {};
    const colorPrimario = config.color_primario || '#ff4400';
    const logoUrl = config.logo_url || '';
    const cabeceraHtml = config.cabecera_html || '';
    const pieHtml = config.pie_html || '';
    const textoLegal = config.texto_legal || '';

    const mostrarIVA = config.mostrar_columna_iva !== false;
    const mostrarDescuento = config.mostrar_columna_descuento !== false;
    const mostrarDomicilio = config.mostrar_domicilio_cliente !== false;
    const mostrarMatricula = config.mostrar_matricula_vehiculo !== false;

    // Formatear fecha
    const fechaEmision = new Date(facturaCompleta.fecha_emision).toLocaleDateString('es-ES');

    // Generar tabla de líneas
    let lineasHTML = '';
    facturaCompleta.lineas.forEach((linea, index) => {
      lineasHTML += `
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${index + 1}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${linea.descripcion}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${linea.cantidad}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${parseFloat(linea.precio_unitario).toFixed(2)} €</td>
          ${mostrarDescuento ? `<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${parseFloat(linea.porcentaje_descuento).toFixed(2)}%</td>` : ''}
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${parseFloat(linea.base_imponible).toFixed(2)} €</td>
          ${mostrarIVA ? `<td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${parseFloat(linea.importe_iva).toFixed(2)} €</td>` : ''}
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${parseFloat(linea.total_linea).toFixed(2)} €</td>
        </tr>
      `;
    });

    // Generar HTML de pagos
    let pagosHTML = '';
    if (facturaCompleta.pagos && facturaCompleta.pagos.length > 0) {
      pagosHTML = '<div style="margin-top: 30px;"><h3 style="color: ' + colorPrimario + ';">Medios de Pago</h3><table style="width: 100%; border-collapse: collapse;">';
      facturaCompleta.pagos.forEach(pago => {
        pagosHTML += `
          <tr>
            <td style="padding: 5px;">${pago.medio_pago_nombre}</td>
            <td style="padding: 5px; text-align: right;">${parseFloat(pago.importe).toFixed(2)} €</td>
            <td style="padding: 5px; text-align: right;">${new Date(pago.fecha_pago).toLocaleDateString('es-ES')}</td>
          </tr>
        `;
      });
      pagosHTML += '</table></div>';
    }

    // Información del vehículo
    let vehiculoHTML = '';
    if (mostrarMatricula && facturaCompleta.vehiculo_matricula) {
      vehiculoHTML = `
        <div style="margin-top: 10px;">
          <strong>Vehículo:</strong> ${facturaCompleta.vehiculo_marca || ''} ${facturaCompleta.vehiculo_modelo || ''} - Matrícula: ${facturaCompleta.vehiculo_matricula}
        </div>
      `;
    }

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${facturaCompleta.numero_factura}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      padding: 40px;
      background: #ffffff;
      color: #333;
    }
    .factura-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      border: 1px solid #ddd;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 3px solid ${colorPrimario};
    }
    .logo {
      max-width: 200px;
      max-height: 80px;
    }
    .factura-info {
      text-align: right;
    }
    .factura-numero {
      font-size: 24px;
      font-weight: bold;
      color: ${colorPrimario};
      margin-bottom: 10px;
    }
    .datos-section {
      display: flex;
      justify-content: space-between;
      margin-bottom: 30px;
    }
    .datos-box {
      width: 48%;
      padding: 15px;
      background: #f9f9f9;
      border-radius: 5px;
    }
    .datos-box h3 {
      color: ${colorPrimario};
      margin-bottom: 10px;
      font-size: 14px;
      text-transform: uppercase;
    }
    .datos-box p {
      margin: 5px 0;
      font-size: 14px;
      line-height: 1.6;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background: ${colorPrimario};
      color: white;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
    }
    .totales {
      margin-top: 30px;
      text-align: right;
    }
    .totales table {
      margin-left: auto;
      width: 300px;
    }
    .totales td {
      padding: 10px;
      border-bottom: 1px solid #eee;
    }
    .totales .total-final {
      font-size: 18px;
      font-weight: bold;
      background: ${colorPrimario};
      color: white;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      font-size: 12px;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="factura-container">
    <!-- CABECERA -->
    <div class="header">
      <div>
        ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo">` : ''}
        ${cabeceraHtml ? `<div style="margin-top: 10px;">${cabeceraHtml}</div>` : `
          <div style="margin-top: 10px;">
            <strong style="font-size: 18px;">${facturaCompleta.sucursal_nombre || 'Taller'}</strong><br>
            ${facturaCompleta.sucursal_direccion || ''}
          </div>
        `}
      </div>
      <div class="factura-info">
        <div class="factura-numero">FACTURA ${facturaCompleta.numero_factura}</div>
        <div><strong>Fecha Emisión:</strong> ${fechaEmision}</div>
        ${facturaCompleta.numero_orden ? `<div><strong>Orden:</strong> ${facturaCompleta.numero_orden}</div>` : ''}
        <div style="margin-top: 10px; padding: 8px; background: ${facturaCompleta.estado === 'EMITIDA' ? '#4CAF50' : '#FF9800'}; color: white; border-radius: 3px; font-weight: bold;">
          ${facturaCompleta.estado}
        </div>
      </div>
    </div>

    <!-- DATOS CLIENTE Y SUCURSAL -->
    <div class="datos-section">
      <div class="datos-box">
        <h3>Datos del Cliente</h3>
        <p><strong>${facturaCompleta.cliente_nombre}</strong></p>
        ${facturaCompleta.cliente_cif ? `<p>CIF/NIF: ${facturaCompleta.cliente_cif}</p>` : ''}
        ${mostrarDomicilio && facturaCompleta.cliente_direccion ? `<p>${facturaCompleta.cliente_direccion}</p>` : ''}
        ${facturaCompleta.cliente_telefono ? `<p>Tel: ${facturaCompleta.cliente_telefono}</p>` : ''}
        ${facturaCompleta.cliente_email ? `<p>Email: ${facturaCompleta.cliente_email}</p>` : ''}
        ${vehiculoHTML}
      </div>
      <div class="datos-box">
        <h3>Datos del Taller</h3>
        <p><strong>${facturaCompleta.sucursal_nombre}</strong></p>
        <p>${facturaCompleta.sucursal_direccion || ''}</p>
      </div>
    </div>

    <!-- LÍNEAS DE FACTURA -->
    <table>
      <thead>
        <tr>
          <th style="width: 40px;">#</th>
          <th>Descripción</th>
          <th style="width: 80px; text-align: center;">Cant.</th>
          <th style="width: 100px; text-align: right;">Precio Unit.</th>
          ${mostrarDescuento ? '<th style="width: 80px; text-align: right;">Dto.</th>' : ''}
          <th style="width: 100px; text-align: right;">Base Imp.</th>
          ${mostrarIVA ? '<th style="width: 80px; text-align: right;">IVA</th>' : ''}
          <th style="width: 100px; text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${lineasHTML}
      </tbody>
    </table>

    <!-- TOTALES -->
    <div class="totales">
      <table>
        <tr>
          <td>Base Imponible:</td>
          <td style="text-align: right;"><strong>${parseFloat(facturaCompleta.base_imponible).toFixed(2)} €</strong></td>
        </tr>
        ${mostrarIVA ? `
        <tr>
          <td>IVA:</td>
          <td style="text-align: right;"><strong>${parseFloat(facturaCompleta.importe_iva).toFixed(2)} €</strong></td>
        </tr>
        ` : ''}
        <tr class="total-final">
          <td>TOTAL:</td>
          <td style="text-align: right;"><strong>${parseFloat(facturaCompleta.total).toFixed(2)} €</strong></td>
        </tr>
      </table>
    </div>

    <!-- PAGOS -->
    ${pagosHTML}

    <!-- OBSERVACIONES -->
    ${facturaCompleta.observaciones ? `
      <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-left: 4px solid ${colorPrimario};">
        <strong>Observaciones:</strong><br>
        ${facturaCompleta.observaciones}
      </div>
    ` : ''}

    <!-- PIE Y TEXTO LEGAL -->
    <div class="footer">
      ${pieHtml || '<p>Gracias por confiar en nuestro taller</p>'}
      ${textoLegal ? `<div style="margin-top: 15px; font-size: 10px;">${textoLegal}</div>` : ''}
    </div>
  </div>
</body>
</html>
    `;

    return html;
  }

  /**
   * Genera y guarda el PDF de una factura
   * @param {number} idFactura - ID de la factura
   * @returns {Promise<string>} URL del PDF generado
   */
  async generarPDF(idFactura) {
    try {
      // Obtener factura completa
      const facturaCompleta = await facturacionService.obtenerFacturaCompleta(idFactura);

      // Generar HTML
      const html = this.generarHTMLFactura(facturaCompleta);

      // Crear directorio para PDFs si no existe
      const pdfsDir = path.join(__dirname, '..', 'uploads', 'facturas');
      if (!fs.existsSync(pdfsDir)) {
        fs.mkdirSync(pdfsDir, { recursive: true });
      }

      // Guardar HTML temporalmente (puedes usar puppeteer aquí para generar PDF real)
      const nombreArchivo = `factura_${facturaCompleta.numero_factura.replace(/[^a-zA-Z0-9]/g, '_')}.html`;
      const rutaArchivo = path.join(pdfsDir, nombreArchivo);

      fs.writeFileSync(rutaArchivo, html, 'utf-8');

      // URL pública del archivo
      const pdfUrl = `/uploads/facturas/${nombreArchivo}`;

      // Actualizar la factura con la URL del PDF
      await pool.query(
        'UPDATE facturacabecera SET pdf_url = $1 WHERE id = $2',
        [pdfUrl, idFactura]
      );

      return pdfUrl;

      /* 
      // ALTERNATIVA CON PUPPETEER (descomentar si instalas puppeteer):
      const puppeteer = require('puppeteer');
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html);
      
      const nombreArchivoPDF = `factura_${facturaCompleta.numero_factura.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      const rutaPDF = path.join(pdfsDir, nombreArchivoPDF);
      
      await page.pdf({
        path: rutaPDF,
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });
      
      await browser.close();
      
      const pdfUrl = `/uploads/facturas/${nombreArchivoPDF}`;
      
      await pool.query(
        'UPDATE facturacabecera SET pdf_url = $1 WHERE id = $2',
        [pdfUrl, idFactura]
      );
      
      return pdfUrl;
      */

    } catch (error) {
      console.error('Error al generar PDF:', error);
      throw error;
    }
  }

  /**
   * Obtiene o genera el PDF de una factura
   * @param {number} idFactura - ID de la factura
   * @returns {Promise<string>} URL del PDF
   */
  async obtenerOGenerarPDF(idFactura) {
    // Verificar si ya existe PDF
    const result = await pool.query(
      'SELECT pdf_url FROM facturacabecera WHERE id = $1',
      [idFactura]
    );

    if (result.rows.length === 0) {
      throw new Error('Factura no encontrada');
    }

    const pdfUrl = result.rows[0].pdf_url;

    // Si ya existe, devolverlo
    if (pdfUrl) {
      return pdfUrl;
    }

    // Si no existe, generarlo
    return await this.generarPDF(idFactura);
  }
}

module.exports = new FacturaPDFService();
