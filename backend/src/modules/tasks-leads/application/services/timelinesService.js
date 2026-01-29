/**
 * Service to interact with TimelinesAI API
 * Docs: https://timelines.ai/api-reference/
 */
const axios = require('axios');

const API_BASE = 'https://app.timelines.ai/api/v1';
const API_TOKEN = process.env.TIMELINES_API_TOKEN;

const client = axios.create({
    baseURL: API_BASE,
    headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
    },
    timeout: 10000
});

/**
 * Adds a label to a chat in TimelinesAI.
 */
async function addLabelToChat(chatId, label) {
    if (!API_TOKEN) {
        console.warn('[TimelinesService] No API Token configured. Skipping label.');
        return false;
    }

    try {
        console.log(`[TimelinesService] Adding label [${label}] to chat ${chatId}...`);

        // Attempt strict Label API first
        await client.post('/labels', {
            chat_id: parseInt(chatId),
            name: label,
            background_color: '#3b82f6', // Optional color
            text_color: '#ffffff'
        });

        console.log(`[TimelinesService] Label [${label}] added OK.`);
        return true;
    } catch (error) {
        // Log as warning, don't crash flow
        // 404 means endpoint doesn't exist or chat not found
        const msg = error.response?.data?.detail || error.message;
        console.warn(`[TimelinesService] Failed to add label ${label}: ${msg}`);
        return false;
    }
}

/**
 * Sends an internal note to the chat.
 */
async function sendNoteToChat(chatId, noteContent) {
    if (!API_TOKEN) return false;

    try {
        console.log(`[TimelinesService] Sending NOTE to chat ${chatId}...`);

        // Endpoint standard de notes
        await client.post('/notes', {
            chat_id: parseInt(chatId),
            text: noteContent
        });

        console.log(`[TimelinesService] Note sent OK.`);
        return true;
    } catch (error) {
        const msg = error.response?.data?.detail || error.message;
        console.error(`[TimelinesService] Failed to send note: ${msg}`);
        return false;
    }
}

module.exports = {
    addLabelToChat,
    sendNoteToChat
};
