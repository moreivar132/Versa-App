// whatsapp-widget.js
class WhatsAppWidget {
    constructor() {
        this.isOpen = false;
        this.apiBaseUrl = window.location.origin + '/api/whatsapp';
        this.init();
    }

    init() {
        // Crear el HTML del widget
        this.createWidget();
        // Agregar event listeners
        this.attachEventListeners();
    }

    createWidget() {
        const widgetHTML = `
      <div class="whatsapp-widget">
        <!-- Botón flotante -->
        <button class="whatsapp-button" id="whatsapp-btn" aria-label="Contactar por WhatsApp">
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
          </svg>
        </button>

        <!-- Modal del formulario -->
        <div class="whatsapp-modal" id="whatsapp-modal">
          <div class="whatsapp-modal-header">
            <h3>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Contáctanos por WhatsApp
            </h3>
            <button class="whatsapp-modal-close" id="whatsapp-close" aria-label="Cerrar">×</button>
          </div>
          <div class="whatsapp-modal-body">
            <div id="whatsapp-form-container">
              <form id="whatsapp-form">
                <div class="whatsapp-form-group">
                  <label for="wa-nombre">Nombre (opcional)</label>
                  <input type="text" id="wa-nombre" name="nombre" placeholder="Ej: Juan Pérez">
                </div>
                <div class="whatsapp-form-group">
                  <label for="wa-telefono">Teléfono <span class="required">*</span></label>
                  <input 
                    type="tel" 
                    id="wa-telefono" 
                    name="telefono_cliente" 
                    placeholder="+34600111222" 
                    required
                    pattern="\\+[0-9]{1,}">
                  <div class="whatsapp-form-hint">Formato internacional (ej: +34600111222)</div>
                </div>
                <div class="whatsapp-form-group">
                  <label for="wa-mensaje">Mensaje <span class="required">*</span></label>
                  <textarea 
                    id="wa-mensaje" 
                    name="mensaje_cliente" 
                    placeholder="¿En qué podemos ayudarte?"
                    required></textarea>
                </div>
                <div id="whatsapp-error" class="whatsapp-error" style="display: none;"></div>
                <button type="submit" class="whatsapp-submit-btn" id="whatsapp-submit">
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Contactar por WhatsApp
                </button>
              </form>
            </div>
            <div id="whatsapp-success" class="whatsapp-success-message" style="display: none;">
              <div class="whatsapp-success-icon">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
              </div>
              <h4>¡Mensaje enviado!</h4>
              <p>Te hemos escrito por WhatsApp. Revisa tu aplicación para continuar la conversación.</p>
              <button class="whatsapp-success-close" id="whatsapp-success-close">Cerrar</button>
            </div>
          </div>
        </div>
      </div>
    `;

        document.body.insertAdjacentHTML('beforeend', widgetHTML);
    }

    attachEventListeners() {
        const btn = document.getElementById('whatsapp-btn');
        const modal = document.getElementById('whatsapp-modal');
        const closeBtn = document.getElementById('whatsapp-close');
        const form = document.getElementById('whatsapp-form');
        const successCloseBtn = document.getElementById('whatsapp-success-close');

        // Abrir/cerrar modal
        btn.addEventListener('click', () => this.toggleModal());
        closeBtn.addEventListener('click', () => this.closeModal());
        successCloseBtn.addEventListener('click', () => this.closeModal());

        // Cerrar al hacer clic fuera del modal
        document.addEventListener('click', (e) => {
            if (this.isOpen && !modal.contains(e.target) && !btn.contains(e.target)) {
                this.closeModal();
            }
        });

        // Manejar envío del formulario
        form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    toggleModal() {
        const modal = document.getElementById('whatsapp-modal');
        this.isOpen = !this.isOpen;
        modal.classList.toggle('show', this.isOpen);
    }

    closeModal() {
        const modal = document.getElementById('whatsapp-modal');
        this.isOpen = false;
        modal.classList.remove('show');

        // Reset form after closing
        setTimeout(() => {
            this.resetForm();
        }, 300);
    }

    async handleSubmit(e) {
        e.preventDefault();

        const form = e.target;
        const submitBtn = document.getElementById('whatsapp-submit');
        const errorDiv = document.getElementById('whatsapp-error');

        // Obtener datos del formulario
        const formData = {
            nombre: form.nombre.value.trim(),
            telefono_cliente: form.telefono_cliente.value.trim(),
            mensaje_cliente: form.mensaje_cliente.value.trim(),
        };

        // Validaciones
        if (!formData.telefono_cliente || !formData.mensaje_cliente) {
            this.showError('Por favor, completa todos los campos obligatorios.');
            return;
        }

        if (!formData.telefono_cliente.startsWith('+')) {
            this.showError('El teléfono debe estar en formato internacional (ej: +34600111222)');
            return;
        }

        // Deshabilitar botón y mostrar loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = `
      <svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"/>
        <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" opacity="0.75"/>
      </svg>
      Enviando...
    `;
        errorDiv.style.display = 'none';

        try {
            // Enviar al backend
            const response = await fetch(`${this.apiBaseUrl}/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al enviar el mensaje');
            }

            // Mostrar mensaje de éxito
            this.showSuccess();
        } catch (error) {
            console.error('Error al enviar mensaje:', error);
            this.showError(error.message || 'Error al enviar el mensaje. Por favor, inténtalo de nuevo.');
            submitBtn.disabled = false;
            submitBtn.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
        </svg>
        Contactar por WhatsApp
      `;
        }
    }

    showError(message) {
        const errorDiv = document.getElementById('whatsapp-error');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }

    showSuccess() {
        document.getElementById('whatsapp-form-container').style.display = 'none';
        document.getElementById('whatsapp-success').style.display = 'block';
    }

    resetForm() {
        const form = document.getElementById('whatsapp-form');
        const submitBtn = document.getElementById('whatsapp-submit');
        const errorDiv = document.getElementById('whatsapp-error');

        form.reset();
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
      </svg>
      Contactar por WhatsApp
    `;
        errorDiv.style.display = 'none';

        document.getElementById('whatsapp-form-container').style.display = 'block';
        document.getElementById('whatsapp-success').style.display = 'none';
    }
}

// Inicializar el widget cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new WhatsAppWidget();
    });
} else {
    new WhatsAppWidget();
}
