/**
 * ChatGPT Integration Service
 * Orquesta conversaciones con ChatGPT usando function calling
 */

const OpenAI = require('openai');
const toolsService = require('./tools.service');

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Definiciones de herramientas para ChatGPT (function calling)
const TOOL_DEFINITIONS = [
    {
        type: 'function',
        function: {
            name: 'get_spend_by_category',
            description: 'Obtiene el gasto desglosado por categorías contables en un periodo',
            parameters: {
                type: 'object',
                properties: {
                    dateFrom: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
                    dateTo: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
                    limit: { type: 'number', description: 'Top N categorías', default: 10 }
                },
                required: ['dateFrom', 'dateTo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_spend_by_vendor',
            description: 'Obtiene el gasto desglosado por proveedores en un periodo',
            parameters: {
                type: 'object',
                properties: {
                    dateFrom: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
                    dateTo: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
                    limit: { type: 'number', description: 'Top N proveedores', default: 10 }
                },
                required: ['dateFrom', 'dateTo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_top_invoices',
            description: 'Obtiene las facturas más grandes (ingresos o gastos) en un periodo',
            parameters: {
                type: 'object',
                properties: {
                    dateFrom: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
                    dateTo: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
                    tipo: { type: 'string', enum: ['INGRESO', 'GASTO'], description: 'Tipo de factura' },
                    limit: { type: 'number', description: 'Número de facturas', default: 20 }
                },
                required: ['dateFrom', 'dateTo', 'tipo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_outliers',
            description: 'Detecta gastos anómalos (outliers) que exceden significativamente el promedio',
            parameters: {
                type: 'object',
                properties: {
                    dateFrom: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
                    dateTo: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
                    threshold: { type: 'number', description: 'Multiplicador de desviación estándar', default: 2.0 }
                },
                required: ['dateFrom', 'dateTo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_iva_summary',
            description: 'Obtiene resumen de IVA (repercutido vs soportado) para un trimestre',
            parameters: {
                type: 'object',
                properties: {
                    year: { type: 'number', description: 'Año (ej: 2026)' },
                    quarter: { type: 'number', enum: [1, 2, 3, 4], description: 'Trimestre (1-4)' }
                },
                required: ['year', 'quarter']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_profit_loss',
            description: 'Calcula el resultado contable (beneficio o pérdida) en un periodo',
            parameters: {
                type: 'object',
                properties: {
                    dateFrom: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
                    dateTo: { type: 'string', description: 'Fecha fin YYYY-MM-DD' }
                },
                required: ['dateFrom', 'dateTo']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_hygiene_issues',
            description: 'Obtiene problemas de higiene contable (facturas sin categoría o sin adjunto)',
            parameters: {
                type: 'object',
                properties: {},
                required: []
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_unpaid_invoices',
            description: 'Obtiene facturas impagadas y vencidas',
            parameters: {
                type: 'object',
                properties: {
                    daysOverdue: { type: 'number', description: 'Días de antigüedad mínima', default: 30 }
                },
                required: []
            }
        }
    }
];

const SYSTEM_PROMPT = `Eres el Copiloto Contable de FinSaaS, un asistente experto en contabilidad y finanzas españolas.

REGLAS ESTRICTAS:
1. NUNCA inventes datos. Solo usa información de las herramientas (tools) disponibles.
2. SIEMPRE incluye números específicos y períodos exactos en tus respuestas.
3. Cita SIEMPRE la evidencia: periodo consultado, empresa, y 3-10 items que sustentan tu respuesta.
4. Si no tienes datos, di "No tengo información para ese periodo" y sugiere alternativas.
5. Sé conciso pero completo. Usa bullets para claridad.
6. Habla en tono profesional pero cercano, como un asesor contable.
7. Cuando menciones importes, usa formato español (1.234,56€).
8. Si detectas anomalías o riesgos, mencionálos claramente.

FORMATO DE RESPUESTA:
- Resumen ejecutivo (2-3 líneas)
- Datos clave en bullets
- Evidencia (periodo, empresa, items)
- Recomendaciones (si aplica)`;

/**
 * Ejecutar una herramienta
 */
async function executeTool(toolName, args, empresaId) {
    console.log(`[Copilot] Executing tool: ${toolName}`, args);

    switch (toolName) {
        case 'get_spend_by_category':
            return await toolsService.getSpendByCategory(
                empresaId,
                args.dateFrom,
                args.dateTo,
                args.limit || 10
            );
        case 'get_spend_by_vendor':
            return await toolsService.getSpendByVendor(
                empresaId,
                args.dateFrom,
                args.dateTo,
                args.limit || 10
            );
        case 'get_top_invoices':
            return await toolsService.getTopInvoices(
                empresaId,
                args.dateFrom,
                args.dateTo,
                args.tipo,
                args.limit || 20
            );
        case 'get_outliers':
            return await toolsService.getOutliers(
                empresaId,
                args.dateFrom,
                args.dateTo,
                args.threshold || 2.0
            );
        case 'get_iva_summary':
            return await toolsService.getIVASummary(
                empresaId,
                args.year,
                args.quarter
            );
        case 'get_profit_loss':
            return await toolsService.getProfitLoss(
                empresaId,
                args.dateFrom,
                args.dateTo
            );
        case 'get_hygiene_issues':
            return await toolsService.getHygieneIssues(empresaId);
        case 'get_unpaid_invoices':
            return await toolsService.getUnpaidInvoices(
                empresaId,
                args.daysOverdue || 30
            );
        default:
            throw new Error(`Unknown tool: ${toolName}`);
    }
}

/**
 * Conversar con el copiloto
 * @param {string} userMessage - Mensaje del usuario
 * @param {object} context - { empresaId, empresaNombre, periodoInicio, periodoFin, conversationHistory }
 * @returns {object} - { content, evidence, toolsUsed, tokensUsed }
 */
async function askCopilot(userMessage, context) {
    const { empresaId, empresaNombre, periodoInicio, periodoFin, conversationHistory = [] } = context;

    // Construir historial de mensajes
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        {
            role: 'system',
            content: `Contexto actual:
- Empresa: ${empresaNombre} (ID: ${empresaId})
- Periodo por defecto: ${periodoInicio} a ${periodoFin}
Si el usuario no especifica un periodo, usa este por defecto.`
        },
        ...conversationHistory,
        { role: 'user', content: userMessage }
    ];

    let toolsUsed = [];
    let evidenceCollected = [];
    let iterations = 0;
    const MAX_ITERATIONS = 5; // Evitar loops infinitos

    while (iterations < MAX_ITERATIONS) {
        iterations++;

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
            tools: TOOL_DEFINITIONS,
            tool_choice: 'auto',
            temperature: 0.3
        });

        const assistantMessage = response.choices[0].message;
        const finishReason = response.choices[0].finish_reason;

        // Si la IA quiere llamar herramientas
        if (finishReason === 'tool_calls' && assistantMessage.tool_calls) {
            messages.push(assistantMessage); // Agregar mensaje del asistente

            // Ejecutar todas las herramientas solicitadas
            for (const toolCall of assistantMessage.tool_calls) {
                const toolName = toolCall.function.name;
                const toolArgs = JSON.parse(toolCall.function.arguments);

                try {
                    const toolResult = await executeTool(toolName, toolArgs, empresaId);

                    toolsUsed.push({
                        tool: toolName,
                        params: toolArgs,
                        executed_at: new Date().toISOString()
                    });

                    evidenceCollected.push({
                        tool: toolName,
                        data: toolResult
                    });

                    // Agregar resultado de herramienta a mensajes
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify(toolResult)
                    });
                } catch (error) {
                    console.error(`[Copilot] Tool error: ${toolName}`, error);
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: JSON.stringify({ error: error.message })
                    });
                }
            }
        } else {
            // IA ha terminado, tiene respuesta final
            return {
                content: assistantMessage.content,
                evidence: {
                    periodo: { inicio: periodoInicio, fin: periodoFin },
                    empresa: { id: empresaId, nombre: empresaNombre },
                    tools_used: toolsUsed,
                    items: evidenceCollected
                },
                toolsUsed: toolsUsed.map(t => t.tool),
                tokensUsed: response.usage.total_tokens
            };
        }
    }

    throw new Error('Max iterations reached in copilot conversation');
}

/**
 * Generar título para sesión basado en primer mensaje
 */
async function generateSessionTitle(firstMessage) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: 'Genera un título corto (máximo 60 caracteres) para esta conversación contable.'
                },
                { role: 'user', content: firstMessage }
            ],
            temperature: 0.5,
            max_tokens: 20
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error('[Copilot] Error generating title:', error);
        return firstMessage.substring(0, 60) + (firstMessage.length > 60 ? '...' : '');
    }
}

module.exports = {
    askCopilot,
    generateSessionTitle,
    TOOL_DEFINITIONS
};
