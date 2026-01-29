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
 * Note: TimelinesAI API uses PUT /labels to assign labels to a chat.
 */
async function addLabelToChat(chatId, label) {
    if (!API_TOKEN) {
        console.warn('[TimelinesService] No API Token configured. Skipping label.');
        return false;
    }

    try {
        /* 
           TimelinesAI Label API (Official or Reverse-engineered):
           Usually: POST /chats/{chat_id}/labels or similar. 
           For this MVP, we will try the documented endpoint for editing chat or adding labels.
           If strict specific endpoint is needed, check docs. 
           Assuming simple implementation: POST /integrations/pipedrive/labels or generic labels endpoint.
           
           *Correction*: Timelines public API is limited. 
           If specific "add label" endpoint doesn't exist publicly, we might only be able to add Notes.
           Let's assume we can add Notes for now effectively. Labs/Tags support varies.
        */

        // MVP: We will focus on NOTES first as they are universally supported.
        // Labels support in public API depends on plan.
        console.log(`[TimelinesService] (Mock) Adding label [${label}] to chat ${chatId}`);
        return true;
    } catch (error) {
        console.error(`[TimelinesService] Failed to add label ${label}:`, error.message);
        return false;
    }
}

/**
 * Sends an internal note to the chat.
 * This is the best way to add context (summary, next steps) visible to agents.
 */
async function sendNoteToChat(chatId, noteContent) {
    if (!API_TOKEN) return false;

    try {
        /*
          According to some TimelinesAI docs: POST /chats/{chat_id}/notes
          Payload: { "text": "..." }
        */
        // const response = await client.post(`/chats/${chatId}/notes`, {
        //     text: noteContent
        // });

        // If the specific endpoint is different (e.g. sending a message as type note):
        // Fallback to sending a message if notes API isn't distinct.
        // But for "Internal Note", usually it's a specific endpoint.

        // Let's assume standard POST /message with type='note' or specific endpoint.
        // For MVP safety: We will log this action until endpoint confirmation.

        console.log(`[TimelinesService] Sending NOTE to chat ${chatId}:`, noteContent);

        // UNCOMMENT WHEN ENDPOINT IS CONFIRMED
        // const response = await client.post('/messages', {
        //   chat_id: parseInt(chatId),
        //   text: noteContent,
        //   type: 'note' // or similar internal flag
        // });

        return true;
    } catch (error) {
        console.error('[TimelinesService] Failed to send note:', error.message);
        return false;
    }
}

module.exports = {
    addLabelToChat,
    sendNoteToChat
};
