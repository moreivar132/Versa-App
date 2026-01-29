/**
 * Lead Classification Service (MVP)
 * Classifies incoming messages based on keywords and simple heuristics.
 */

const KEYWORDS = {
    BICI: ['bici', 'bicicleta', 'ebike', 'e-bike', 'alquiler', 'paseo', 'montaña', 'road'],
    TALLER: ['taller', 'reparar', 'reparación', 'freno', 'pinchazo', 'rueda', 'mantenimiento', 'averia', 'avería', 'roto', 'tesoro'],
    MOTO: ['moto', 'scooter', 'matricula', 'matrícula', '125', 'cc', 'sym', 'honda', 'yamaha', 'pcx', 'nmax'],
    SAAS: ['factura', 'contabilidad', 'crm', 'empresa', 'tenant', 'software', 'acceso', 'login'],
    MARKETPLACE: ['cita', 'reserva', 'hora', 'agenda', 'disponible', 'hueco'],
    SOPORTE: ['ayuda', 'problema', 'error', 'no funciona', 'duda', 'consulta'],
    URGENTE: ['hoy', 'ahora', 'urgente', 'ya', 'inmediato', 'pronto'],
    REPARTIDOR: ['reparto', 'entrega', 'pedido', 'rider', 'glovo', 'uber'],
    COBRANZA: ['cobro', 'deuda', 'pago', 'pendiente', 'moroso', 'no pagado'],
    PAQUETERIA: ['paquete', 'envio', 'seguimiento'],
    CONTRATADO: ['contrato', 'alta', 'firmar', 'empleo', 'trabajo']
};

/**
 * Analyzes a message and returns classification tags and AI profile data.
 * @param {string} messageText 
 */
function classifyMessage(messageText) {
    if (!messageText) return { tags: [], aiProfile: {} };

    const lowerText = messageText.toLowerCase();
    const tags = new Set();
    const matches = {};

    // 1. Keyword Matching
    for (const [category, words] of Object.entries(KEYWORDS)) {
        for (const word of words) {
            if (lowerText.includes(word)) {
                tags.add(category);
                matches[category] = (matches[category] || 0) + 1;
            }
        }
    }

    // 2. Determine Primary Category
    let primaryCategory = 'GENERAL';
    let maxMatches = 0;

    // Prioritize business verticals over generic tags like URGENTE/SOPORTE
    const verticals = ['BICI', 'TALLER', 'MOTO', 'SAAS', 'MARKETPLACE', 'REPARTIDOR', 'COBRANZA', 'PAQUETERIA', 'CONTRATADO'];

    for (const cat of verticals) {
        if (matches[cat] && matches[cat] > maxMatches) {
            primaryCategory = cat;
            maxMatches = matches[cat];
        }
    }

    // 3. Determine Intention & Urgency
    const intention = determineIntention(lowerText, tags);
    const urgency = tags.has('URGENTE') ? 'ALTA' : 'MEDIA';
    const finalTags = Array.from(tags);

    // 4. Generate AI Profile object
    const aiProfile = {
        categoria_principal: primaryCategory,
        verticales_interes: finalTags.filter(t => verticals.includes(t)),
        intencion: intention,
        urgencia: urgency,
        resumen: generateSummary(primaryCategory, intention, finalTags),
        confianza: 80 // Hardcoded for rule-based matching
    };

    return {
        tags: finalTags,
        aiProfile
    };
}

function determineIntention(text, tags) {
    if (tags.has('TALLER')) return 'REPARACION';
    if (tags.has('BICI') || tags.has('MOTO')) {
        if (text.includes('alquiler') || text.includes('quiero') || text.includes('necesito')) return 'ALQUILER/COMPRA';
    }
    if (tags.has('SOPORTE')) return 'SOPORTE';

    if (text.includes('precio') || text.includes('cuanto') || text.includes('€')) return 'INFORMACION_PRECIO';

    return 'CONSULTA_GENERAL';
}

function generateSummary(category, intention, tags) {
    return `Lead interesado en ${category} (${intention}). Tags detectados: ${tags.join(', ')}.`;
}

module.exports = {
    classifyMessage
};
