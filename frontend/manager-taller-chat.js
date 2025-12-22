import { getApiBaseUrl } from './auth.js';

const API_BASE_URL = getApiBaseUrl();
const API_URL = `${API_BASE_URL}/api/crm/chat`;
const UPLOAD_URL = `${API_BASE_URL}/api/upload`;
let currentConversationId = null;
let pollingIntervalId = null;
let conversations = [];
let lastMessageCount = 0;
let notificationsEnabled = false;

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
const reopenChatBtn = document.getElementById('reopen-chat-btn');
const attachBtn = document.getElementById('attach-btn');
const fileInput = document.getElementById('file-input');

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    loadConversations();
    initNotifications();

    // Event Listeners
    filterStatus.addEventListener('change', loadConversations);
    filterSearch.addEventListener('input', debounce(loadConversations, 500));

    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    closeChatBtn.addEventListener('click', closeConversation);

    // Reabrir chat
    if (reopenChatBtn) {
        reopenChatBtn.addEventListener('click', reopenConversation);
    }

    // Adjuntar archivos
    if (attachBtn && fileInput) {
        attachBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
    }
});

// Inicializar notificaciones push
async function initNotifications() {
    // Verificar si el navegador soporta notificaciones
    if (!('Notification' in window)) {
        console.log('Este navegador no soporta notificaciones');
        return;
    }

    // Solicitar permisos
    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        notificationsEnabled = permission === 'granted';
    } else {
        notificationsEnabled = Notification.permission === 'granted';
    }

    if (notificationsEnabled) {
        console.log('✅ Notificaciones habilitadas');
    }
}

// Mostrar notificación push
function showNotification(title, body, icon = '/assets/favicon.png') {
    if (!notificationsEnabled) return;

    // No mostrar notificación si la ventana está enfocada
    if (document.hasFocus()) return;

    const notification = new Notification(title, {
        body,
        icon,
        badge: icon,
        vibrate: [200, 100, 200],
        tag: 'chat-message', // Evita múltiples notificaciones
        renotify: true
    });

    notification.onclick = () => {
        window.focus();
        notification.close();
    };

    // Auto cerrar después de 5 segundos
    setTimeout(() => notification.close(), 5000);
}

// Cargar conversaciones
async function loadConversations() {
    try {
        const status = filterStatus.value;
        const search = filterSearch.value;

        // Construir URL con params
        const url = new URL(`${API_URL}/conversaciones`);
        if (status) url.searchParams.append('estado', status);
        if (search) url.searchParams.append('search', search);

        const token = localStorage.getItem('token');
        const headers = {
            'Content-Type': 'application/json'
        };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        if (data.conversaciones) {
            // Detectar nuevos mensajes para notificaciones
            const previousConversations = [...conversations];
            conversations = data.conversaciones;

            // Verificar si hay nuevos mensajes en conversaciones abiertas
            conversations.forEach(conv => {
                const prev = previousConversations.find(p => p.id === conv.id);
                if (prev && conv.ultimoMensajeTexto !== prev.ultimoMensajeTexto && conv.estado === 'ABIERTO') {
                    // Hay un nuevo mensaje
                    if (conv.id !== currentConversationId) {
                        showNotification(
                            `💬 Nuevo mensaje de ${conv.clienteNombre || 'Cliente'}`,
                            conv.ultimoMensajeTexto || 'Nuevo mensaje recibido'
                        );
                    }
                }
            });

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
    if (attachBtn) attachBtn.disabled = false;
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

            // Si está cerrado, deshabilitar input pero mostrar botón de reabrir
            if (data.conversacion.estado === 'CERRADO') {
                messageInput.disabled = true;
                sendBtn.disabled = true;
                if (attachBtn) attachBtn.disabled = true;
                messageInput.placeholder = 'Conversación cerrada - Reabre para continuar';
                closeChatBtn.classList.add('hidden');
                if (reopenChatBtn) reopenChatBtn.classList.remove('hidden');
            } else {
                messageInput.disabled = false;
                sendBtn.disabled = false;
                if (attachBtn) attachBtn.disabled = false;
                messageInput.placeholder = 'Escribe un mensaje...';
                closeChatBtn.classList.remove('hidden');
                if (reopenChatBtn) reopenChatBtn.classList.add('hidden');
            }

            // Verificar nuevos mensajes para notificación
            if (data.mensajes.length > lastMessageCount && lastMessageCount > 0) {
                const lastMsg = data.mensajes[data.mensajes.length - 1];
                if (lastMsg.emisorTipo === 'CLIENTE') {
                    showNotification(
                        `💬 ${data.conversacion.clienteNombre || 'Cliente'}`,
                        lastMsg.texto || 'Nuevo archivo recibido'
                    );
                }
            }
            lastMessageCount = data.mensajes.length;
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

        let content = '';
        if (msg.tipoMensaje === 'IMAGEN') {
            content = `<img src="${API_BASE_URL}${msg.urlAdjunto}" alt="Imagen adjunta" class="max-w-full rounded-lg mb-2" style="max-height: 300px; cursor: pointer;" onclick="window.open('${API_BASE_URL}${msg.urlAdjunto}', '_blank')">`;
            if (msg.texto && msg.texto.trim()) content += `<div class="mt-1">${msg.texto}</div>`;
        } else if (msg.tipoMensaje === 'VIDEO') {
            content = `<video src="${API_BASE_URL}${msg.urlAdjunto}" controls class="max-w-full rounded-lg mb-2" style="max-height: 300px;"></video>`;
            if (msg.texto && msg.texto.trim()) content += `<div class="mt-1">${msg.texto}</div>`;
        } else if (msg.tipoMensaje === 'ARCHIVO') {
            content = `
                <a href="${API_BASE_URL}${msg.urlAdjunto}" download class="flex items-center gap-2 bg-[#333] px-3 py-2 rounded-lg hover:bg-[#444] transition-colors">
                    <i class="fas fa-file-download text-orange-500"></i>
                    <span class="text-sm">Descargar archivo</span>
                </a>
            `;
            if (msg.texto && msg.texto.trim()) content += `<div class="mt-2">${msg.texto}</div>`;
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

// Manejar subida de archivos
async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Mostrar indicador de carga
    const originalBtnContent = attachBtn.innerHTML;
    attachBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    attachBtn.disabled = true;

    try {
        const token = localStorage.getItem('token');
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(UPLOAD_URL, {
            method: 'POST',
            headers: token ? { 'Authorization': `Bearer ${token}` } : {},
            body: formData
        });

        if (!response.ok) throw new Error('Error al subir archivo');

        const data = await response.json();

        if (data.ok) {
            // Enviar mensaje con archivo adjunto
            await sendMessageWithAttachment(data.url, data.type, file.name);
        } else {
            throw new Error(data.error || 'Error al subir archivo');
        }
    } catch (error) {
        console.error('Error subiendo archivo:', error);
        alert('Error al subir el archivo: ' + error.message);
    } finally {
        attachBtn.innerHTML = originalBtnContent;
        attachBtn.disabled = false;
        fileInput.value = ''; // Reset input
    }
}

// Enviar mensaje con archivo adjunto
async function sendMessageWithAttachment(urlAdjunto, tipoMensaje, nombreArchivo) {
    if (!currentConversationId) return;

    try {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_URL}/conversaciones/${currentConversationId}/mensajes`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                texto: nombreArchivo,
                tipoMensaje,
                urlAdjunto
            })
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();
        if (data.ok) {
            loadMessages();
            loadConversations();
        }
    } catch (error) {
        console.error('Error enviando mensaje con archivo:', error);
    }
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
            loadMessages();
            loadConversations();
        }
    } catch (error) {
        console.error('Error enviando mensaje:', error);
    }
}

async function closeConversation() {
    if (!currentConversationId || !confirm('¿Seguro que quieres cerrar esta conversación? Se enviará un mensaje automático al cliente.')) return;

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

// Reabrir conversación cerrada
async function reopenConversation() {
    if (!currentConversationId || !confirm('¿Deseas reabrir esta conversación?')) return;

    try {
        const token = localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const response = await fetch(`${API_URL}/conversaciones/${currentConversationId}/reabrir`, {
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
        console.error('Error reabriendo conversación:', error);
    }
}

function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function startPolling() {
    if (pollingIntervalId) clearInterval(pollingIntervalId);
    // Polling más frecuente para conversaciones
    pollingIntervalId = setInterval(() => {
        loadMessages();
        loadConversations(); // También actualizar lista para detectar nuevos mensajes
    }, 3000);
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
