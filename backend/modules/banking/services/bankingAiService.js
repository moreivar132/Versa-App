/**
 * Banking AI Service
 * Proporciona análisis e insights sobre movimientos bancarios usando OpenAI
 */

const OpenAI = require('openai');

let _openai;
function getOpenAIClient() {
    if (!_openai) {
        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY no configurada');
        }
        _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return _openai;
}

/**
 * Analiza una lista de transacciones bancarias
 * @param {Array} transactions 
 * @returns {Promise<Object>}
 */
async function analyzeTransactions(transactions) {
    try {
        const openai = getOpenAIClient();

        // Preparar la data para la IA (reducir campos innecesarios para ahorrar tokens)
        const summary = transactions.map(t => ({
            fecha: t.booking_date,
            descripcion: t.description,
            importe: t.amount,
            moneda: t.currency,
            categoria_actual: t.category
        }));

        const prompt = `Actúa como un Director Financiero (CFO) y Experto Contable Senior. 
Analiza los siguientes movimientos bancarios de la empresa y genera un informe estratégico profundo.

Tu objetivo es:
1. Identificar patrones de gasto: ¿Por qué estamos gastando en esto? ¿Es recurrente? ¿Es optimizable?
2. Análisis por Categorías: Agrupa los movimientos por su naturaleza y comenta la relevancia de cada categoría en el flujo de caja.
3. Alertas Críticas: Detecta duplicados, comisiones bancarias excesivas, o pagos que parecen fuera de lo normal.
4. Estrategia de Tesorería: Da consejos accionables de un experto para mejorar el "runway" o la rentabilidad.
5. Deducción Fiscal: Identifica qué movimientos son oro puro para deducir IVA/Sociedades y cuáles requieren factura urgente.

Responde ÚNICAMENTE en formato JSON:
{
  "resumen_ejecutivo": "Un análisis narrativo de alto nivel sobre la salud financiera actual.",
  "analisis_categorias": [
    {"categoria": "...", "total": 0, "porcentaje": "...", "comentario_experto": "Explicación de por qué se gasta tanto aquí y si es normal."}
  ],
  "alertas": ["Alerta detallada sobre riesgos o anomalías"],
  "sugerencias_contables": [
    {"descripcion": "...", "categoria_sugerida": "...", "razon_contable": "Explicación técnica de por qué va en esa cuenta."}
  ],
  "consejos_estrategicos": ["Consejo de nivel directivo para mejorar finanzas"],
  "plan_accion_deducibles": "Instrucciones claras sobre qué facturas conseguir para ahorrar impuestos."
}

Movimientos a analizar:
${JSON.stringify(summary, null, 2)}`;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: "json_object" },
            temperature: 0.7
        });

        return JSON.parse(response.choices[0].message.content);

    } catch (error) {
        console.error('[Banking AI] Error:', error);
        throw error;
    }
}

module.exports = {
    analyzeTransactions
};
