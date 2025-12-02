class ChatWidget {
    constructor(config = {}) {
        this.apiUrl = config.apiUrl || '/api/chat';
        this.tenantId = config.tenantId || 1;
        this.clientId = config.clientId || 1; // En prod, esto vendría de otro lado
        this.pollingInterval = config.pollingInterval || 3000;
        this.isOpen = false;
        this.conversacion = null;
        this.mensajes = [];
        this.intervalId = null;

        this.init();
    }

    init() {
        this.createStyles();
        this.createDOM();
        this.attachEvents();
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .chat-widget-launcher {
                position: fixed;
                bottom: 20px;
                right: 20px;
                width: 60px;
                height: 60px;
                background-color: #ea580c; /* Brand Orange */
                border-radius: 50%;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 9999;
                transition: transform 0.3s ease;
            }
            .chat-widget-launcher:hover {
                transform: scale(1.1);
                background-color: #c2410c;
            }
            .chat-widget-launcher svg {
                width: 32px;
                height: 32px;
                fill: white;
            }
            .chat-widget-container {
                position: fixed;
                bottom: 90px;
                right: 20px;
                width: 350px;
                height: 500px;
                background-color: #1e293b; /* Slate 800 (Dark) */
                border-radius: 12px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.3);
                display: flex;
                flex-direction: column;
                z-index: 9999;
                overflow: hidden;
                opacity: 0;
                pointer-events: none;
                transform: translateY(20px);
                transition: all 0.3s ease;
                font-family: 'Inter', sans-serif;
                border: 1px solid #334155;
            }
            .chat-widget-container.open {
                opacity: 1;
                pointer-events: all;
                transform: translateY(0);
            }
            .chat-header {
                background-color: #0f172a; /* Slate 900 */
                color: white;
                padding: 15px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                border-bottom: 1px solid #334155;
            }
            .chat-header h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }
            .chat-close {
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                font-size: 20px;
                transition: color 0.2s;
            }
            .chat-close:hover {
                color: white;
            }
            .chat-messages {
                flex: 1;
                padding: 15px;
                overflow-y: auto;
                background-color: #1e293b; /* Slate 800 */
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .message-bubble {
                max-width: 80%;
                padding: 10px 14px;
                border-radius: 12px;
                font-size: 14px;
                line-height: 1.4;
                position: relative;
                color: white;
            }
            .message-bubble.cliente {
                align-self: flex-end;
                background-color: #ea580c; /* Brand Orange */
                border-bottom-right-radius: 2px;
            }
            .message-bubble.usuario {
                align-self: flex-start;
                background-color: #334155; /* Slate 700 */
                border-bottom-left-radius: 2px;
            }
            .message-time {
                font-size: 10px;
                color: rgba(255,255,255,0.7);
                text-align: right;
                margin-top: 4px;
            }
            .chat-input-area {
                padding: 15px;
                background-color: #0f172a; /* Slate 900 */
                display: flex;
                gap: 10px;
                border-top: 1px solid #334155;
            }
            .chat-input {
                flex: 1;
                padding: 10px 15px;
                background-color: #334155;
                border: 1px solid #475569;
                border-radius: 20px;
                outline: none;
                color: white;
                font-size: 14px;
            }
            .chat-input::placeholder {
                color: #94a3b8;
            }
            .chat-input:focus {
                border-color: #ea580c;
            }
            .chat-send-btn {
                background-color: #ea580c;
                color: white;
                border: none;
                border-radius: 50%;
                width: 40px;
                height: 40px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: background-color 0.2s;
            }
            .chat-send-btn:hover {
                background-color: #c2410c;
            }
            .chat-send-btn svg {
                width: 20px;
                height: 20px;
                fill: white;
            }
            /* Scrollbar styling */
            .chat-messages::-webkit-scrollbar {
                width: 6px;
            }
            .chat-messages::-webkit-scrollbar-track {
                background: transparent;
            }
            .chat-messages::-webkit-scrollbar-thumb {
                background-color: #475569;
                border-radius: 3px;
            }
        `;
        document.head.appendChild(style);
    }

    createDOM() {
        // Launcher
        this.launcher = document.createElement('div');
        this.launcher.className = 'chat-widget-launcher';
        this.launcher.innerHTML = `
            <svg viewBox="0 0 24 24">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
        `;
        document.body.appendChild(this.launcher);

        // Container
        this.container = document.createElement('div');
        this.container.className = 'chat-widget-container';
        this.container.innerHTML = `
            <div class="chat-header">
                <h3>Chat con el Taller</h3>
                <button class="chat-close">&times;</button>
            </div>
            <div class="chat-messages" id="chat-messages">
                <!-- Mensajes aquí -->
            </div>
            <div class="chat-input-area">
                <input type="text" class="chat-input" placeholder="Escribe un mensaje..." />
                <button class="chat-send-btn">
                    <svg viewBox="0 0 24 24">
                        <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                </button>
            </div>
        `;
        document.body.appendChild(this.container);

        this.messagesContainer = this.container.querySelector('#chat-messages');
        this.input = this.container.querySelector('.chat-input');
        this.sendBtn = this.container.querySelector('.chat-send-btn');
        this.closeBtn = this.container.querySelector('.chat-close');
    }

    attachEvents() {
        this.launcher.addEventListener('click', () => this.toggleChat());
        this.closeBtn.addEventListener('click', () => this.toggleChat());

        this.sendBtn.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });
    }

    async toggleChat() {
        this.isOpen = !this.isOpen;
        if (this.isOpen) {
            this.container.classList.add('open');
            this.launcher.style.display = 'none';
            await this.loadConversation();
            this.startPolling();
            this.scrollToBottom();
        } else {
            this.container.classList.remove('open');
            this.launcher.style.display = 'flex';
            this.stopPolling();
        }
    }

    async loadConversation() {
        try {
            const response = await fetch(`${this.apiUrl}/conversacion-actual`, {
                headers: {
                    'x-tenant-id': this.tenantId,
                    'x-client-id': this.clientId
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data.conversacion) {
                this.conversacion = data.conversacion;
                this.mensajes = data.mensajes || [];
                this.renderMessages();
            }
        } catch (error) {
            console.error('Error cargando conversación:', error);
        }
    }

    renderMessages() {
        this.messagesContainer.innerHTML = '';
        this.mensajes.forEach(msg => {
            const div = document.createElement('div');
            div.className = `message-bubble ${msg.emisorTipo.toLowerCase()}`;
            div.innerHTML = `
                ${msg.texto}
                <div class="message-time">${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
            `;
            this.messagesContainer.appendChild(div);
        });
        this.scrollToBottom();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const texto = this.input.value.trim();
        if (!texto || !this.conversacion) return;

        // Optimistic UI
        const tempMsg = {
            emisorTipo: 'CLIENTE',
            texto: texto,
            createdAt: new Date().toISOString()
        };
        this.mensajes.push(tempMsg);
        this.renderMessages();
        this.input.value = '';

        try {
            const response = await fetch(`${this.apiUrl}/mensajes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': this.tenantId,
                    'x-client-id': this.clientId
                },
                body: JSON.stringify({
                    idConversacion: this.conversacion.id,
                    texto: texto
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.ok) {
                // Reemplazar el último mensaje con el real si es necesario, 
                // o simplemente dejar que el polling lo actualice/confirme.
                // Aquí ya lo tenemos en local.
            } else {
                console.error('Error enviando mensaje:', data.error);
                // Rollback optimistic UI si falla (opcional)
            }
        } catch (error) {
            console.error('Error enviando mensaje:', error);
        }
    }

    startPolling() {
        if (this.intervalId) return;
        this.intervalId = setInterval(async () => {
            if (!this.conversacion) return;
            try {
                const response = await fetch(`${this.apiUrl}/conversaciones/${this.conversacion.id}/mensajes`, {
                    headers: {
                        'x-tenant-id': this.tenantId,
                        'x-client-id': this.clientId
                    }
                });

                if (!response.ok) return; // Silent fail on polling

                const data = await response.json();
                if (data.mensajes) {
                    // Simple diff: si hay más mensajes, actualizar todo
                    // En una app real, haríamos merge inteligente.
                    if (data.mensajes.length !== this.mensajes.length) {
                        this.mensajes = data.mensajes;
                        this.renderMessages();
                    }
                }
            } catch (error) {
                // console.error('Error en polling:', error); // Silent fail
            }
        }, this.pollingInterval);
    }

    stopPolling() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }
}

export default ChatWidget;
