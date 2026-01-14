/**
 * OpenAI OCR Service
 * Analyzes invoices using GPT-4 Vision API
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Structured prompt for invoice extraction
const INVOICE_PROMPT = `Analiza esta factura/ticket y extrae los siguientes datos en formato JSON estricto.
Si no puedes encontrar un campo, usa null. No inventes datos.

Responde ÚNICAMENTE con un objeto JSON válido (sin markdown, sin texto adicional):

{
  "proveedor_nombre": "Nombre o razón social del emisor",
  "proveedor_nif": "NIF/CIF del emisor (formato español: 12345678A o B12345678)",
  "proveedor_direccion": "Dirección completa del emisor",
  "proveedor_cp": "Código postal",
  "numero_factura": "Número de factura/ticket",
  "fecha_emision": "Fecha en formato YYYY-MM-DD",
  "fecha_vencimiento": "Fecha vencimiento en formato YYYY-MM-DD o null",
  "base_imponible": 0.00,
  "iva_porcentaje": 21,
  "iva_importe": 0.00,
  "total": 0.00,
  "moneda": "EUR",
  "concepto": "Descripción general de la factura",
  "lineas": [
    {
      "descripcion": "Descripción del producto/servicio",
      "cantidad": 1,
      "precio_unitario": 0.00,
      "total_linea": 0.00
    }
  ]
}

Notas importantes:
- Los importes deben ser números decimales (ej: 123.45), no strings
- Si hay varios tipos de IVA, usa el principal
- El NIF español tiene 8 dígitos + 1 letra (personas) o 1 letra + 7 dígitos + 1 letra (empresas)
- Extrae todas las líneas de detalle que puedas identificar`;

/**
 * Analyze an invoice image/PDF using GPT-4 Vision
 * @param {string} filePath - Absolute path to the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<{extracted: object, validation: object, error: string|null}>}
 */
async function analyzeInvoice(filePath, mimeType) {
    console.log('[OpenAI OCR] Starting analysis for:', filePath);
    console.log('[OpenAI OCR] MIME type:', mimeType);

    try {
        // Check if OpenAI API key is configured
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY not configured');
        }

        // Read file and convert to base64
        const fileBuffer = fs.readFileSync(filePath);
        const base64Image = fileBuffer.toString('base64');

        // Determine media type for OpenAI
        let mediaType = mimeType;
        if (mimeType === 'application/pdf') {
            // For PDFs, we'll try to send as-is (GPT-4 Vision can handle some PDFs)
            // If this doesn't work well, we'd need pdf-to-image conversion
            mediaType = 'application/pdf';
        }

        console.log('[OpenAI OCR] Sending to GPT-4 Vision...');
        const startTime = Date.now();

        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',  // GPT-4 Omni with vision capabilities
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: INVOICE_PROMPT
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: `data:${mediaType};base64,${base64Image}`,
                                detail: 'high'
                            }
                        }
                    ]
                }
            ],
            max_tokens: 2000,
            temperature: 0.1  // Low temperature for more consistent extraction
        });

        const elapsed = Date.now() - startTime;
        console.log(`[OpenAI OCR] Response received in ${elapsed}ms`);

        // Extract the response content
        const content = response.choices[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }

        console.log('[OpenAI OCR] Raw response:', content.substring(0, 200));

        // Parse JSON from response
        let extracted;
        try {
            // Try to parse directly
            extracted = JSON.parse(content);
        } catch (parseError) {
            // Try to extract JSON from markdown code block
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                extracted = JSON.parse(jsonMatch[1].trim());
            } else {
                // Try to find JSON object in the text
                const objectMatch = content.match(/\{[\s\S]*\}/);
                if (objectMatch) {
                    extracted = JSON.parse(objectMatch[0]);
                } else {
                    throw new Error('Could not parse JSON from response: ' + parseError.message);
                }
            }
        }

        console.log('[OpenAI OCR] Extracted data:', JSON.stringify(extracted).substring(0, 300));

        // Validate and normalize extracted data
        const normalized = normalizeExtractedData(extracted);
        const validation = validateExtractedData(normalized);

        console.log('[OpenAI OCR] Validation result:', JSON.stringify(validation));

        return {
            extracted: normalized,
            validation,
            error: null
        };

    } catch (error) {
        console.error('[OpenAI OCR] Error:', error.message);
        return {
            extracted: null,
            validation: null,
            error: error.message
        };
    }
}

/**
 * Normalize extracted data to ensure consistent types
 */
function normalizeExtractedData(data) {
    const parseNum = (val) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const cleaned = val.replace(/[€$\s]/g, '').replace(',', '.');
            return parseFloat(cleaned) || 0;
        }
        return 0;
    };

    const parseDate = (val) => {
        if (!val) return null;
        try {
            const d = new Date(val);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
            }
        } catch (e) { }
        return val;
    };

    return {
        proveedor_nombre: data.proveedor_nombre || data.proveedor || null,
        proveedor_nif: data.proveedor_nif?.toUpperCase() || null,
        proveedor_direccion: data.proveedor_direccion || null,
        proveedor_cp: data.proveedor_cp || null,
        numero_factura: data.numero_factura || null,
        fecha_emision: parseDate(data.fecha_emision),
        fecha_vencimiento: parseDate(data.fecha_vencimiento),
        base_imponible: parseNum(data.base_imponible),
        iva_porcentaje: parseNum(data.iva_porcentaje) || 21,
        iva_importe: parseNum(data.iva_importe),
        total: parseNum(data.total),
        moneda: data.moneda || 'EUR',
        concepto: data.concepto || null,
        lineas: Array.isArray(data.lineas) ? data.lineas.map(l => ({
            descripcion: l.descripcion || '',
            cantidad: parseNum(l.cantidad) || 1,
            precio_unitario: parseNum(l.precio_unitario),
            total_linea: parseNum(l.total_linea)
        })) : []
    };
}

/**
 * Validate extracted data and return validation results
 */
function validateExtractedData(data) {
    const issues = [];

    // Check required fields
    if (!data.proveedor_nombre) issues.push('Falta nombre del proveedor');
    if (!data.numero_factura) issues.push('Falta número de factura');
    if (!data.fecha_emision) issues.push('Falta fecha de emisión');
    if (!data.total || data.total === 0) issues.push('Falta importe total');

    // Validate NIF format (Spanish)
    const nifRegex = /^[0-9]{8}[A-Z]$|^[A-Z][0-9]{7}[A-Z0-9]$/;
    const hasValidNif = data.proveedor_nif && nifRegex.test(data.proveedor_nif);

    // Validate totals
    let checkTotal = false;
    let checkIva = false;

    if (data.base_imponible > 0 && data.iva_importe >= 0) {
        const expectedTotal = data.base_imponible + data.iva_importe;
        checkTotal = Math.abs(expectedTotal - data.total) < 0.02; // Allow 2 cent tolerance

        const expectedIva = data.base_imponible * (data.iva_porcentaje / 100);
        checkIva = Math.abs(expectedIva - data.iva_importe) < 0.10; // Allow 10 cent tolerance
    }

    return {
        check_total: checkTotal,
        check_iva: checkIva,
        check_nif: hasValidNif,
        issues,
        confidence: issues.length === 0 ? 'high' : (issues.length <= 2 ? 'medium' : 'low')
    };
}

module.exports = {
    analyzeInvoice
};
