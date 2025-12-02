import { getApiBaseUrl } from './auth.js';

const API_BASE_URL = getApiBaseUrl();
const API_URL = `${API_BASE_URL}/api/crm/chat`;
let currentConversationId = null;
let pollingIntervalId = null;
let conversations = [];

// Elementos DOM
const conversationsList = document.getElementById('conversations-list');
const chatArea = document.getElementById('chat-area');
const chatMessages = document.getElementById('chat-messages');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const filterStatus = document.getElementById('filter-status');
const filterSearch = document.getElementById('filter-search');
const chatHeaderInfo = document.getElementById('chat-header-info');
const closeChatBtn = document.getElementById('close-chat-btn');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadConversations();

    // Event Listeners
    filterStatus.addEventListener('change', loadConversations);
    filterSearch.addEventListener('input', debounce(loadConversations, 500));

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    closeChatBtn.addEventListener('click', closeConversation);
});

// Cargar conversaciones
async function loadConversations() {
    try {
        const status = filterStatus.value;
        const search = filterSearch.value;

        // Construir URL con params
        const url = new URL(`${API_URL}/conversaciones`);
        if (status) url.searchParams.append('estado', status);
        if (search) url.searchParams.append('search', search);

        // Auth headers (simulados o reales si hay login implementado)
        // Aquí asumimos que el navegador envía cookies o que hay un token en localStorage
        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // NOTA: Para desarrollo local sin auth completa, el backend podría necesitar ajustes
        // o asumimos que el usuario está logueado si hay sesión.
        // En el backend implementé verifyJWT. Necesitamos un token válido.
        // Si no hay login flow completo en frontend, esto fallará con 401.
        // VOY A ASUMIR QUE EL USUARIO YA SE LOGUEÓ Y TIENE TOKEN.

        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (data.conversaciones) {
            conversations = data.conversaciones;
            renderConversations();
        }
    } catch (error) {
        console.error('Error cargando conversaciones:', error);
        conversationsList.innerHTML = '<div class="p-4 text-center text-red-500">Error cargando conversaciones</div>';
    }
}

function renderConversations() {
    conversationsList.innerHTML = '';
    if (conversations.length === 0) {
        conversationsList.innerHTML = '<div class="p-4 text-center text-gray-500">No hay conversaciones</div>';
        return;
    }

    conversations.forEach(conv => {
        const div = document.createElement('div');
        div.className = `conversation-item ${currentConversationId === conv.id ? 'active' : ''}`;
        div.onclick = () => selectConversation(conv.id);

        const date = new Date(conv.ultimoMensajeAt || Date.now());
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        div.innerHTML = `
            <div class="flex justify-between mb-1">
                <span class="font-bold text-white">${conv.clienteNombre || 'Cliente Desconocido'}</span>
                <span class="text-xs text-gray-400">${timeStr}</span>
            </div>
            <div class="text-sm text-gray-400 truncate">${conv.ultimoMensajeTexto || 'Sin mensajes'}</div>
            <div class="mt-2 flex justify-between items-center">
                <span class="status-badge status-${conv.estado.toLowerCase()}">${conv.estado}</span>
                <span class="text-xs text-gray-500">${conv.clienteTelefono || ''}</span>
            </div>
        `;
        conversationsList.appendChild(div);
    });
}

async function selectConversation(id) {
    if (currentConversationId === id) return;
    currentConversationId = id;
    renderConversations(); // Para actualizar clase active

    // Reset UI
    chatMessages.innerHTML = '<div class="p-4 text-center text-gray-500">Cargando mensajes...</div>';
    messageInput.disabled = false;
    sendBtn.disabled = false;
    messageInput.focus();

    stopPolling();
    await loadMessages();
    startPolling();
}

async function loadMessages() {
    if (!currentConversationId) return;

    try {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_URL}/conversaciones/${currentConversationId}/mensajes`, { headers });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (data.conversacion) {
            updateChatHeader(data.conversacion);
            renderMessages(data.mensajes);

            // Si está cerrado, deshabilitar input
            if (data.conversacion.estado === 'CERRADO') {
                messageInput.disabled = true;
                sendBtn.disabled = true;
                messageInput.placeholder = 'Conversación cerrada';
                closeChatBtn.classList.add('hidden');
            } else {
                messageInput.disabled = false;
                sendBtn.disabled = false;
                messageInput.placeholder = 'Escribe un mensaje...';
                closeChatBtn.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error('Error cargando mensajes:', error);
    }
}

function updateChatHeader(conv) {
    chatHeaderInfo.innerHTML = `
        <h3 class="font-bold text-lg text-white">${conv.clienteNombre || 'Cliente'}</h3>
        <p class="text-sm text-gray-400">${conv.clienteTelefono || ''} - ${conv.estado}</p>
    `;
}

function renderMessages(mensajes) {
    chatMessages.innerHTML = '';
    mensajes.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message-bubble ${msg.emisorTipo.toLowerCase()}`;

        let senderName = '';
        if (msg.emisorTipo === 'USUARIO') {
            // Podríamos poner el nombre del usuario si quisiéramos
        }

        let content = '';
        if (msg.tipoMensaje === 'IMAGEN') {
            content = `<img src="${msg.urlAdjunto}" alt="Imagen adjunta" class="max-w-full rounded-lg mb-2">`;
            if (msg.texto) content += `<div class="mt-1">${msg.texto}</div>`;
        } else if (msg.tipoMensaje === 'VIDEO') {
            content = `<video src="${msg.urlAdjunto}" controls class="max-w-full rounded-lg mb-2"></video>`;
            if (msg.texto) content += `<div class="mt-1">${msg.texto}</div>`;
        } else {
            content = msg.texto;
        }

        div.innerHTML = `
            ${content}
            <div class="message-time">${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
        `;
        chatMessages.appendChild(div);
    });
    scrollToBottom();
}

async function sendMessage() {
    const texto = messageInput.value.trim();
    if (!texto || !currentConversationId) return;

    try {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_URL}/conversaciones/${currentConversationId}/mensajes`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ texto })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data.ok) {
            messageInput.value = '';
            loadMessages(); // Recargar para ver el mensaje (o añadirlo manualmente)
            loadConversations(); // Actualizar lista (último mensaje)
        }
    } catch (error) {
        console.error('Error enviando mensaje:', error);
    }
}

async function closeConversation() {
    if (!currentConversationId || !confirm('¿Seguro que quieres cerrar esta conversación?')) return;

    try {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_URL}/conversaciones/${currentConversationId}/cerrar`, {
            method: 'PATCH',
            headers
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data.ok) {
            loadMessages();
            loadConversations();
        }
    } catch (error) {
        console.error('Error cerrando conversación:', error);
    }
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function startPolling() {
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    pollingIntervalId = setInterval(loadMessages, 3000);
}

function stopPolling() {
    if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
        pollingIntervalId = null;
    }
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
