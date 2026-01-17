/**
 * OpenAI OCR Service
 * Analyzes invoices using GPT-4 Vision API or Text Extraction
 */

const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
const pdfParse = require('pdf-parse');

// Helper to get OpenAI client (lazy initialization)
let _openai;
function getOpenAIClient() {
    if (!_openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is not defined');
        }
        _openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    return _openai;
}

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
  "retencion_porcentaje": 0,
  "retencion_importe": 0.00,
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
- Extrae todas las líneas de detalle que puedas identificar
- RETENCIÓN IRPF: Si la factura tiene retención (común en autónomos/profesionales), extrae el porcentaje e importe. La fórmula es: Total = Base + IVA - Retención
- Valores típicos de retención: 15% (normal), 7% (nuevo autónomo), 1%, 2%`;

/**
 * Analyze an invoice image/PDF using GPT-4 Vision or Text
 * @param {string} filePath - Absolute path to the file
 * @param {string} mimeType - MIME type of the file
 * @returns {Promise<{extracted: object, validation: object, error: string|null}>}
 */
async function analyzeInvoice(filePath, mimeType) {
    console.log('[OpenAI OCR] Starting analysis for:', filePath);
    console.log('[OpenAI OCR] MIME type:', mimeType);

    try {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY not configured');
        }

        const fileBuffer = fs.readFileSync(filePath);
        let apiMessages = [];

        if (mimeType === 'application/pdf') {
            console.log('[OpenAI OCR] PDF detected, extracting text with pdf-parse...');
            try {
                const pdfData = await pdfParse(fileBuffer);
                const pdfText = pdfData.text;

                if (!pdfText || pdfText.trim().length < 50) {
                    throw new Error('PDF appears to be scanned/image-only (no text found)');
                }

                console.log('[OpenAI OCR] Text extracted from PDF, length:', pdfText.length);

                apiMessages = [
                    {
                        role: 'user',
                        content: `${INVOICE_PROMPT}\n\nAquí está el contenido extraído del PDF:\n\n${pdfText.substring(0, 15000)}`
                    }
                ];
            } catch (pdfError) {
                console.error('[OpenAI OCR] PDF parsing failed:', pdfError.message);
                throw new Error('No se pudo leer el PDF. Asegúrate de que no sea un escaneo o imagen convertida.');
            }
        } else {
            // It's an image
            const base64Image = fileBuffer.toString('base64');
            const mediaType = mimeType; // e.g., image/jpeg, image/png

            // Validate supported image types
            const supportedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
            if (!supportedTypes.includes(mediaType)) {
                // Fallback: try to just send it if it claims to be an image but be careful
                console.warn('[OpenAI OCR] Warning: MIME type might not be fully supported:', mediaType);
            }

            console.log('[OpenAI OCR] Sending Image to GPT-4 Vision...');
            apiMessages = [
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
            ];
        }

        const startTime = Date.now();
        const openai = getOpenAIClient();

        // Call OpenAI API
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: apiMessages,
            max_tokens: 2000,
            temperature: 0.1
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
        retencion_porcentaje: parseNum(data.retencion_porcentaje) || 0,
        retencion_importe: parseNum(data.retencion_importe) || 0,
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

    // Validate totals (accounting for retention)
    // Formula: Total = Base + IVA - Retención
    let checkTotal = false;
    let checkIva = false;

    if (data.base_imponible > 0 && data.iva_importe >= 0) {
        const retencion = data.retencion_importe || 0;
        const expectedTotal = data.base_imponible + data.iva_importe - retencion;
        checkTotal = Math.abs(expectedTotal - data.total) < 0.10; // Allow 10 cent tolerance for rounding

        const expectedIva = data.base_imponible * (data.iva_porcentaje / 100);
        checkIva = Math.abs(expectedIva - data.iva_importe) < 0.10; // Allow 10 cent tolerance

        // If retention exists, validate it too
        if (data.retencion_porcentaje > 0) {
            const expectedRetencion = data.base_imponible * (data.retencion_porcentaje / 100);
            if (Math.abs(expectedRetencion - retencion) > 0.10) {
                issues.push('La retención no coincide con el porcentaje indicado');
            }
        }
    }

    return {
        check_total: checkTotal,
        check_iva: checkIva,
        check_nif: hasValidNif,
        has_retencion: (data.retencion_importe || 0) > 0,
        issues,
        confidence: issues.length === 0 ? 'high' : (issues.length <= 2 ? 'medium' : 'low')
    };
}

module.exports = {
    analyzeInvoice
};
