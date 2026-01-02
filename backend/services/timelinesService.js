// services/timelinesService.js
require('dotenv').config();

// Compatibility: Use global fetch if available (Node 18+), otherwise use node-fetch
const fetch = global.fetch || require('node-fetch');

const TIMELINES_API_BASE_URL = 'https://app.timelines.ai/integrations/api';
const TIMELINES_API_TOKEN = process.env.TIMELINES_API_TOKEN || '812176d7-1392-431e-9df5-20966f2fa49f';
const LABEL_ORIGEN = 'Manager';

/**
 * Realiza una petición a la API de TimelinesAI
 * @param {string} endpoint - Endpoint de la API (sin la base URL)
 * @param {string} method - Método HTTP (GET, POST, PUT, DELETE)
 * @param {object} body - Cuerpo de la petición (opcional)
 * @returns {Promise<object>} - Respuesta de la API
 */
async function timelinesRequest(endpoint, method = 'GET', body = null) {
    const url = `${TIMELINES_API_BASE_URL}${endpoint}`;

    const options = {
        method,
        headers: {
            'Authorization': `Bearer ${TIMELINES_API_TOKEN}`,
            'Content-Type': 'application/json',
        },
    };

    if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`TimelinesAI API error: ${response.status} - ${errorText}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error en petición a TimelinesAI:', error);
        throw error;
    }
}

/**
 * Envía el primer mensaje a un cliente (crea la conversación)
 * @param {string} phone - Teléfono del cliente en formato internacional (+34...)
 * @param {string} customerMessage - Mensaje que el cliente escribió en el formulario
 * @param {string} whatsappAccountPhone - (Opcional) Número de WhatsApp desde el que enviar
 * @returns {Promise<object>} - Respuesta de la API con el chat_id
 */
async function sendInitialMessage(phone, customerMessage, whatsappAccountPhone = null) {
    const text = `Hola, soy VERSA. Has enviado este mensaje desde la web: "${customerMessage}". Te respondo por aquí.`;

    const body = {
        phone,
        text,
        label: LABEL_ORIGEN,
    };

    if (whatsappAccountPhone) {
        body.whatsapp_account_phone = whatsappAccountPhone;
    }

    return await timelinesRequest('/messages', 'POST', body);
}

/**
 * Envía un mensaje de respuesta al cliente
 * @param {string} chatId - ID del chat en TimelinesAI
 * @param {string} message - Mensaje a enviar
 * @returns {Promise<object>} - Respuesta de la API
 */
async function sendMessage(chatId, message) {
    const body = {
        message,
        label: LABEL_ORIGEN,
    };

    return await timelinesRequest(`/chats/${chatId}/messages`, 'POST', body);
}

/**
 * Añade o actualiza las etiquetas de un chat
 * @param {string} chatId - ID del chat en TimelinesAI
 * @param {array<string>} labels - Array de etiquetas a añadir
 * @returns {Promise<object>} - Respuesta de la API
 */
async function updateChatLabels(chatId, labels = [LABEL_ORIGEN]) {
    const body = { labels };
    return await timelinesRequest(`/chats/${chatId}/labels`, 'PUT', body);
}

/**
 * Obtiene información de un chat específico
 * @param {string} chatId - ID del chat en TimelinesAI
 * @returns {Promise<object>} - Información del chat
 */
async function getChat(chatId) {
    return await timelinesRequest(`/chats/${chatId}`, 'GET');
}

/**
 * Obtiene los mensajes de un chat
 * @param {string} chatId - ID del chat en TimelinesAI
 * @returns {Promise<object>} - Mensajes del chat
 */
async function getChatMessages(chatId) {
    return await timelinesRequest(`/chats/${chatId}/messages`, 'GET');
}

module.exports = {
    sendInitialMessage,
    sendMessage,
    updateChatLabels,
    getChat,
    getChatMessages,
    LABEL_ORIGEN,
};
