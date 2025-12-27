/**
 * ============================================
 * ANIMATED SEARCH COMPONENT
 * Componente reutilizable de búsqueda animada
 * From Uiverse.io by Harsha2lucky - Adaptado a VERSA
 * ============================================
 * 
 * USO BÁSICO:
 * 1. Importar el componente en tu HTML:
 *    <script type="module" src="./components/animated-search.js"></script>
 * 
 * 2. Crear el input con data attributes:
 *    <div data-animated-search 
 *         data-search-id="my-search" 
 *         data-search-icon="fa-search"
 *         data-search-label="Buscar"
 *         data-search-placeholder="Escribe para buscar...">
 *    </div>
 * 
 * 3. O usar la API programática:
 *    AnimatedSearch.create('#container', {
 *        id: 'my-search',
 *        icon: 'fa-search',
 *        label: 'Buscar',
 *        placeholder: 'Escribe...',
 *        onInput: (value) => console.log(value),
 *        onSelect: (item) => console.log(item)
 *    });
 */

class AnimatedSearch {
    /**
     * Crea una instancia del componente
     * @param {HTMLElement|string} container - Elemento o selector del contenedor
     * @param {Object} options - Opciones de configuración
     */
    constructor(container, options = {}) {
        this.container = typeof container === 'string'
            ? document.querySelector(container)
            : container;

        if (!this.container) {
            console.error('AnimatedSearch: Container not found');
            return;
        }

        this.options = {
            id: options.id || 'animated-search-' + Date.now(),
            icon: options.icon || 'fa-search',
            label: options.label || '',
            placeholder: options.placeholder || 'Buscar...',
            debounceMs: options.debounceMs || 300,
            minChars: options.minChars || 2,
            onInput: options.onInput || null,
            onSelect: options.onSelect || null,
            onFocus: options.onFocus || null,
            onBlur: options.onBlur || null,
            ...options
        };

        this.debounceTimer = null;
        this.isOpen = false;

        this.render();
        this.attachEvents();
    }

    /**
     * Renderiza el componente
     */
    render() {
        const labelHtml = this.options.label
            ? `<label class="animated-search-label" for="${this.options.id}">
                   <i class="fas ${this.options.icon}"></i>${this.options.label}
               </label>`
            : '';

        this.container.innerHTML = `
            <div class="animated-search-wrapper">
                ${labelHtml}
                <div class="animated-search-form">
                    <input type="search" 
                           id="${this.options.id}" 
                           class="search-input" 
                           placeholder="${this.options.placeholder}" 
                           autocomplete="off" 
                           required>
                    <span class="caret"></span>
                    <i class="fas ${this.options.icon} search-icon"></i>
                </div>
                <div id="${this.options.id}-results" class="search-results-dropdown"></div>
            </div>
        `;

        // Guardar referencias a elementos
        this.input = this.container.querySelector('.search-input');
        this.dropdown = this.container.querySelector('.search-results-dropdown');
        this.wrapper = this.container.querySelector('.animated-search-wrapper');
    }

    /**
     * Adjunta los event listeners
     */
    attachEvents() {
        // Input event con debounce
        this.input.addEventListener('input', (e) => {
            const value = e.target.value.trim();

            clearTimeout(this.debounceTimer);

            if (value.length < this.options.minChars) {
                this.hideDropdown();
                return;
            }

            this.debounceTimer = setTimeout(() => {
                if (this.options.onInput) {
                    this.options.onInput(value, this);
                }
            }, this.options.debounceMs);
        });

        // Focus event
        this.input.addEventListener('focus', () => {
            if (this.options.onFocus) {
                this.options.onFocus(this);
            }
            if (this.input.value.trim().length >= this.options.minChars) {
                this.showDropdown();
            }
        });

        // Blur event (con delay para permitir clicks en dropdown)
        this.input.addEventListener('blur', () => {
            setTimeout(() => {
                if (this.options.onBlur) {
                    this.options.onBlur(this);
                }
            }, 200);
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    /**
     * Muestra el dropdown con resultados
     * @param {Array} items - Array de items a mostrar
     * @param {Function} renderItem - Función para renderizar cada item (opcional)
     */
    showResults(items, renderItem = null) {
        if (!items || items.length === 0) {
            this.dropdown.innerHTML = `
                <div class="search-item" style="text-align: center; color: var(--text-muted);">
                    Sin resultados
                </div>
            `;
        } else {
            this.dropdown.innerHTML = items.map((item, index) => {
                if (renderItem) {
                    return `<div class="search-item" data-index="${index}">${renderItem(item)}</div>`;
                }
                // Render por defecto
                const label = item.label || item.nombre || item.name || item.title || JSON.stringify(item);
                const subtitle = item.subtitle || item.descripcion || item.email || '';
                return `
                    <div class="search-item" data-index="${index}">
                        <div style="font-weight: 500; color: white;">${label}</div>
                        ${subtitle ? `<div style="font-size: 0.75rem; color: var(--text-muted);">${subtitle}</div>` : ''}
                    </div>
                `;
            }).join('');

            // Event listeners para items
            this.dropdown.querySelectorAll('.search-item').forEach((el, idx) => {
                el.addEventListener('click', () => {
                    if (this.options.onSelect) {
                        this.options.onSelect(items[idx], this);
                    }
                    this.hideDropdown();
                });
            });
        }

        this.showDropdown();
    }

    /**
     * Muestra el dropdown
     */
    showDropdown() {
        this.dropdown.style.display = 'block';
        this.isOpen = true;
    }

    /**
     * Oculta el dropdown
     */
    hideDropdown() {
        this.dropdown.style.display = 'none';
        this.isOpen = false;
    }

    /**
     * Establece el valor del input
     * @param {string} value 
     */
    setValue(value) {
        this.input.value = value;
    }

    /**
     * Obtiene el valor del input
     * @returns {string}
     */
    getValue() {
        return this.input.value.trim();
    }

    /**
     * Limpia el input y resultados
     */
    clear() {
        this.input.value = '';
        this.hideDropdown();
        this.dropdown.innerHTML = '';
    }

    /**
     * Enfoca el input
     */
    focus() {
        this.input.focus();
    }

    /**
     * Destruye el componente
     */
    destroy() {
        this.container.innerHTML = '';
    }

    // ============================================
    // MÉTODOS ESTÁTICOS
    // ============================================

    /**
     * Crea una instancia del componente
     * @param {HTMLElement|string} container 
     * @param {Object} options 
     * @returns {AnimatedSearch}
     */
    static create(container, options = {}) {
        return new AnimatedSearch(container, options);
    }

    /**
     * Inicializa automáticamente todos los elementos con data-animated-search
     */
    static autoInit() {
        document.querySelectorAll('[data-animated-search]').forEach(el => {
            const options = {
                id: el.dataset.searchId || null,
                icon: el.dataset.searchIcon || 'fa-search',
                label: el.dataset.searchLabel || '',
                placeholder: el.dataset.searchPlaceholder || 'Buscar...',
                minChars: parseInt(el.dataset.searchMinChars) || 2,
                debounceMs: parseInt(el.dataset.searchDebounce) || 300
            };

            // Guardar referencia en el elemento
            el._animatedSearch = new AnimatedSearch(el, options);
        });
    }

    /**
     * Obtiene la instancia asociada a un elemento
     * @param {HTMLElement|string} element 
     * @returns {AnimatedSearch|null}
     */
    static getInstance(element) {
        const el = typeof element === 'string' ? document.querySelector(element) : element;
        return el ? el._animatedSearch : null;
    }
}

// Auto-inicializar cuando el DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AnimatedSearch.autoInit());
} else {
    AnimatedSearch.autoInit();
}

// Exportar para uso con módulos ES6
export default AnimatedSearch;
export { AnimatedSearch };
