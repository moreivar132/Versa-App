/**
 * Sucursal Selector Component
 * Componente reutilizable para seleccionar y mostrar la sucursal actual
 * 
 * Uso:
 * import { initSucursalSelector, getCurrentSucursalId, onSucursalChange } from './services/sucursal-selector.js';
 * 
 * // Inicializar el selector en un contenedor específico
 * await initSucursalSelector('sucursal-selector-container', {
 *   onchange: (sucursalId) => { console.log('Sucursal cambiada a:', sucursalId); }
 * });
 */

import { getToken } from '/auth.js';

// Constante para la clave de localStorage - compartida globalmente
const SUCURSAL_STORAGE_KEY = 'versa_selected_sucursal';

// Estado interno del componente
let currentSucursalId = null;
let sucursales = [];
let puedeSeleccionar = false;
let onChangeCallback = null;

// API Base URL
const API_BASE_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3000';

/**
 * Realiza una petición GET autenticada
 */
async function apiGet(endpoint) {
    const token = getToken();
    const res = await fetch(API_BASE_URL + endpoint, {
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) throw new Error('API Error: ' + res.status);
    return res.json();
}

/**
 * Carga las sucursales disponibles desde el backend
 */
async function loadSucursales() {
    try {
        const data = await apiGet('/api/caja/sucursales');
        if (!data.ok) throw new Error(data.error);

        sucursales = data.sucursales || [];
        puedeSeleccionar = data.puede_seleccionar || false;

        // Verificar si hay una sucursal guardada en localStorage
        const savedSucursal = localStorage.getItem(SUCURSAL_STORAGE_KEY);

        // Usar la guardada si existe y es válida, sino usar la actual del backend
        if (savedSucursal && sucursales.some(s => s.id == savedSucursal)) {
            currentSucursalId = parseInt(savedSucursal);
        } else {
            currentSucursalId = data.sucursal_actual;
            // Guardar la sucursal actual
            if (currentSucursalId) {
                localStorage.setItem(SUCURSAL_STORAGE_KEY, currentSucursalId);
            }
        }

        return { sucursales, currentSucursalId, puedeSeleccionar };
    } catch (error) {
        console.error('Error loading sucursales:', error);
        // Intentar usar la sucursal guardada aunque falle el API
        const saved = localStorage.getItem(SUCURSAL_STORAGE_KEY);
        if (saved) currentSucursalId = parseInt(saved);
        throw error;
    }
}

/**
 * Renderiza el selector de sucursales en el contenedor especificado
 * @param {string} containerId - ID del elemento contenedor
 * @param {object} options - Opciones de configuración
 * @param {function} options.onchange - Callback cuando cambia la sucursal
 */
export async function initSucursalSelector(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Sucursal Selector: Container "${containerId}" not found`);
        return null;
    }

    onChangeCallback = options.onchange || null;

    try {
        await loadSucursales();

        // Limpiar contenedor
        container.innerHTML = '';

        // Crear el elemento del selector
        const selectorEl = document.createElement('div');
        selectorEl.id = 'sucursal-selector';
        selectorEl.className = 'flex items-center gap-2 bg-[#111318] px-4 py-2 rounded-xl border border-[#282e39]';

        if (puedeSeleccionar && sucursales.length > 1) {
            // Mostrar dropdown para seleccionar
            const optionsHtml = sucursales.map(s => {
                const label = s.tenant_nombre ? `${s.tenant_nombre} - ${s.nombre}` : s.nombre;
                const selected = s.id == currentSucursalId ? ' selected' : '';
                return `<option value="${s.id}"${selected}>${label}</option>`;
            }).join('');

            selectorEl.innerHTML = `
        <span class="material-symbols-outlined text-[var(--brand-orange)]">store</span>
        <select id="sucursal-select" 
                class="bg-transparent text-white text-sm font-medium border-none focus:outline-none cursor-pointer pr-2"
                style="background-color: transparent;">
          ${optionsHtml}
        </select>
        <span class="material-symbols-outlined text-[#9da6b9] text-sm">expand_more</span>
      `;

            // Agregar event listener después de insertar
            setTimeout(() => {
                const select = document.getElementById('sucursal-select');
                if (select) {
                    select.addEventListener('change', handleSucursalChange);
                }
            }, 0);
        } else {
            // Mostrar solo label (sin opción de cambiar)
            const sucursal = sucursales.find(s => s.id == currentSucursalId) || sucursales[0];
            const label = sucursal
                ? (sucursal.tenant_nombre ? `${sucursal.tenant_nombre} - ${sucursal.nombre}` : sucursal.nombre)
                : 'Sin sucursal';

            selectorEl.innerHTML = `
        <span class="material-symbols-outlined text-[var(--brand-orange)]">store</span>
        <span class="text-white font-medium text-sm">${label}</span>
      `;
        }

        container.appendChild(selectorEl);

        return currentSucursalId;
    } catch (error) {
        console.error('Error initializing sucursal selector:', error);
        // Mostrar mensaje de error en el contenedor
        container.innerHTML = `
      <div class="flex items-center gap-2 bg-red-500/10 px-4 py-2 rounded-xl border border-red-500/20">
        <span class="material-symbols-outlined text-red-400">error</span>
        <span class="text-red-400 text-sm">Error cargando sucursales</span>
      </div>
    `;
        return null;
    }
}

/**
 * Maneja el cambio de sucursal
 */
function handleSucursalChange(event) {
    const newSucursalId = parseInt(event.target.value);
    currentSucursalId = newSucursalId;

    // Guardar en localStorage
    localStorage.setItem(SUCURSAL_STORAGE_KEY, currentSucursalId);

    // Disparar callback si existe
    if (onChangeCallback && typeof onChangeCallback === 'function') {
        onChangeCallback(currentSucursalId);
    }

    // Disparar evento personalizado para que otras partes de la página puedan escuchar
    window.dispatchEvent(new CustomEvent('sucursalChanged', {
        detail: { sucursalId: currentSucursalId }
    }));
}

/**
 * Obtiene el ID de la sucursal actual
 * @returns {number|null} ID de la sucursal actual
 */
export function getCurrentSucursalId() {
    // Si ya tenemos el ID en memoria, usarlo
    if (currentSucursalId) return currentSucursalId;

    // Si no, intentar leer de localStorage
    const saved = localStorage.getItem(SUCURSAL_STORAGE_KEY);
    if (saved) {
        currentSucursalId = parseInt(saved);
        return currentSucursalId;
    }

    return null;
}

/**
 * Obtiene la información completa de la sucursal actual
 * @returns {object|null} Objeto con la información de la sucursal
 */
export function getCurrentSucursal() {
    if (!currentSucursalId || sucursales.length === 0) return null;
    return sucursales.find(s => s.id === currentSucursalId) || null;
}

/**
 * Obtiene todas las sucursales disponibles
 * @returns {array} Array de sucursales
 */
export function getSucursales() {
    return sucursales;
}

/**
 * Suscribe una función al evento de cambio de sucursal
 * @param {function} callback - Función a ejecutar cuando cambie la sucursal
 */
export function onSucursalChange(callback) {
    window.addEventListener('sucursalChanged', (e) => {
        callback(e.detail.sucursalId);
    });
}

/**
 * Cambia la sucursal actual programáticamente
 * @param {number} sucursalId - ID de la nueva sucursal
 */
export function setSucursal(sucursalId) {
    if (!sucursales.some(s => s.id === sucursalId)) {
        console.warn('Sucursal ID not found:', sucursalId);
        return false;
    }

    currentSucursalId = sucursalId;
    localStorage.setItem(SUCURSAL_STORAGE_KEY, currentSucursalId);

    // Actualizar el select si existe
    const select = document.getElementById('sucursal-select');
    if (select) {
        select.value = sucursalId;
    }

    // Disparar evento
    window.dispatchEvent(new CustomEvent('sucursalChanged', {
        detail: { sucursalId: currentSucursalId }
    }));

    return true;
}

// Exportar también la constante por si otras partes del código la necesitan
export { SUCURSAL_STORAGE_KEY };
