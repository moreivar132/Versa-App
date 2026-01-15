/**
 * Marketplace Sucursal Selector
 * Componente robusto para selección de sucursal
 * 
 * PRINCIPIOS:
 * - No crashear si el container no existe
 * - Manejar errores de carga graciosamente
 * - Emitir eventos para comunicación con otros módulos
 */

/**
 * Escape HTML para prevenir XSS
 * @param {string} str 
 * @returns {string}
 */
function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Shorthand para getElementById
 * @param {string} id 
 * @returns {HTMLElement|null}
 */
function byId(id) {
    return document.getElementById(id);
}

/**
 * Carga el selector de sucursales de forma segura
 * 
 * @param {Object} opts - Opciones
 * @param {Function} opts.fetchSucursales - Función async que retorna array de sucursales
 * @param {string} opts.containerId - ID del container (default: 'marketplace-sucursal-selector')
 * @param {string} opts.selectId - ID del select (default: 'marketplaceSucursalSelect')
 * @param {string} opts.eventName - Nombre del evento custom (default: 'marketplace:sucursalChanged')
 * @returns {Promise<{ mounted: boolean, count?: number, error?: boolean }>}
 */
export async function loadSucursalSelector({
    fetchSucursales,
    containerId = 'marketplace-sucursal-selector',
    selectId = 'marketplaceSucursalSelect',
    eventName = 'marketplace:sucursalChanged'
} = {}) {
    const container = byId(containerId);

    // ✅ Si el DOM no tiene container, NO romper marketplace
    if (!container) {
        console.warn(`[Marketplace/sucursalSelector] Falta #${containerId}. Se omite selector.`);
        return { mounted: false };
    }

    // Mostrar estado de carga
    container.innerHTML = `
    <span class="text-sm opacity-80 flex items-center gap-2">
      <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Cargando sucursales...
    </span>
  `;

    try {
        // Verificar que fetchSucursales es una función
        if (typeof fetchSucursales !== 'function') {
            throw new Error('fetchSucursales debe ser una función');
        }

        const sucursales = await fetchSucursales();

        // Verificar que obtenemos un array
        if (!Array.isArray(sucursales)) {
            console.warn('[Marketplace/sucursalSelector] fetchSucursales no retornó un array');
            container.innerHTML = `<span class="text-amber-500 text-sm">Sin sucursales disponibles</span>`;
            return { mounted: true, count: 0 };
        }

        // Caso: sin sucursales
        if (sucursales.length === 0) {
            container.innerHTML = `<span class="text-sm opacity-70">Sin sucursales disponibles</span>`;
            return { mounted: true, count: 0 };
        }

        // Renderizar select
        container.innerHTML = `
      <label class="block text-sm mb-1 font-medium">Sucursal</label>
      <select 
        id="${selectId}" 
        class="w-full border border-white/10 rounded-lg p-2 bg-[#1E1E1E] text-white focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
      >
        <option value="">Todas las sucursales</option>
        ${sucursales.map(s => `
          <option value="${escapeHtml(s.id || s.id_sucursal)}">
            ${escapeHtml(s.nombre || 'Sucursal')}
          </option>
        `).join('')}
      </select>
    `;

        // Setup event listener
        const select = byId(selectId);
        if (select) {
            select.addEventListener('change', () => {
                const selectedValue = select.value || null;

                // Emitir evento custom
                window.dispatchEvent(new CustomEvent(eventName, {
                    detail: {
                        sucursal_id: selectedValue,
                        sucursal_name: select.options[select.selectedIndex]?.text || null
                    }
                }));

                console.log(`[Marketplace/sucursalSelector] Sucursal changed:`, selectedValue);
            });
        }

        return { mounted: true, count: sucursales.length };

    } catch (error) {
        console.error('[Marketplace/sucursalSelector] Error cargando sucursales:', error);

        container.innerHTML = `
      <span class="text-red-500 text-sm flex items-center gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
        </svg>
        Error cargando sucursales
      </span>
    `;

        return { mounted: true, error: true };
    }
}

/**
 * Obtiene el valor actual del selector de sucursales
 * @param {string} selectId - ID del select
 * @returns {string|null}
 */
export function getCurrentSucursal(selectId = 'marketplaceSucursalSelect') {
    const select = byId(selectId);
    return select?.value || null;
}

/**
 * Establece el valor del selector de sucursales
 * @param {string} value - Valor a establecer
 * @param {string} selectId - ID del select
 * @param {boolean} triggerEvent - Si emitir el evento de cambio
 */
export function setCurrentSucursal(value, selectId = 'marketplaceSucursalSelect', triggerEvent = true) {
    const select = byId(selectId);
    if (!select) return;

    select.value = value || '';

    if (triggerEvent) {
        select.dispatchEvent(new Event('change', { bubbles: true }));
    }
}

// Export default
export default {
    loadSucursalSelector,
    getCurrentSucursal,
    setCurrentSucursal
};
