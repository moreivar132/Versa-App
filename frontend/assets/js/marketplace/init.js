/**
 * Marketplace Initializer
 * Punto de entrada único para el Marketplace vertical
 * 
 * RESPONSABILIDADES:
 * - Inicializar mapa (si existe container)
 * - Inicializar selector de sucursales (si existe container)
 * - Manejar búsqueda y listado
 * - Listeners de eventos
 * 
 * PRINCIPIOS:
 * - Degradación graceful: si falta un componente, continuar con los demás
 * - No crashear por coords inválidas
 * - Logging para debugging
 */

import { fetchSucursales, searchMarketplace } from './api.js';
import { loadSucursalSelector } from './sucursalSelector.js';
import { safeAddMarker, getValidBounds } from './geo.js';

// ===== STATE =====
let map = null;
let LRef = null;
let markersLayer = null;
let currentItems = [];
let searchState = {
    q: '',
    sucursal_id: null,
    categoria: null,
    estado: 'activo',
    limit: 50,
    offset: 0
};

// ===== DOM HELPERS =====
function byId(id) {
    return document.getElementById(id);
}

function escapeHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ===== MAP FUNCTIONS =====

/**
 * Inicializa el mapa de forma segura
 * @returns {L.Map|null}
 */
function ensureMap() {
    const el = byId('marketplace-map');

    if (!el) {
        console.warn('[Marketplace/init] Falta #marketplace-map. Se omite mapa.');
        return null;
    }

    // Verificar que Leaflet está disponible
    const L = window.L;
    if (!L) {
        console.warn('[Marketplace/init] Leaflet no está disponible (window.L). Se omite mapa.');
        return null;
    }

    LRef = L;

    // Evitar doble inicialización
    if (map) return map;

    try {
        // Madrid como centro por defecto
        map = L.map(el, {
            center: [40.4168, -3.7038],
            zoom: 12,
            zoomControl: true
        });

        // Tiles de OpenStreetMap (compatible con tema oscuro)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Layer group para markers
        markersLayer = L.layerGroup().addTo(map);

        console.log('[Marketplace/init] Mapa inicializado correctamente');
        return map;
    } catch (error) {
        console.error('[Marketplace/init] Error inicializando mapa:', error);
        return null;
    }
}

/**
 * Limpia todos los markers del mapa
 */
function clearMarkers() {
    if (markersLayer) {
        markersLayer.clearLayers();
    }
}

/**
 * Renderiza markers en el mapa
 * @param {Array} items - Items a renderizar
 */
function renderMapMarkers(items) {
    if (!map || !LRef || !markersLayer) {
        console.warn('[Marketplace/init] Mapa no disponible para renderizar markers');
        return;
    }

    clearMarkers();

    let validCount = 0;
    let invalidCount = 0;

    items.forEach(item => {
        const marker = safeAddMarker(LRef, markersLayer, item, {
            onInvalid: () => {
                invalidCount++;
            },
            markerOptions: {
                icon: LRef.divIcon({
                    className: 'marketplace-marker',
                    html: `
            <div style="position: relative; width: 32px; height: 32px;">
              <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255, 68, 0, 0.5); border-radius: 50%; animation: pulse 2s infinite;"></div>
              <img src="https://imgur.com/iBrjKwv.png" style="width: 32px; height: 32px; position: relative; z-index: 2; border-radius: 50%; border: 2px solid #ff4400; background: #121212;" />
            </div>
          `,
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                })
            }
        });

        if (marker) {
            validCount++;

            // Popup con información
            const nombre = escapeHtml(item.nombre || item.titulo_publico || 'Taller');
            const direccion = escapeHtml(item.direccion || '');
            const rating = parseFloat(item.rating) || 0;
            const id = item.id_sucursal || item.id;

            marker.bindPopup(`
        <div style="font-family: Montserrat, sans-serif; min-width: 180px;">
          <h3 style="font-weight: bold; margin-bottom: 4px; font-size: 14px;">${nombre}</h3>
          ${direccion ? `<p style="font-size: 12px; color: #707070; margin-bottom: 8px;">${direccion}</p>` : ''}
          ${rating > 0 ? `
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 8px;">
              <span style="color: #fbbf24;">★</span>
              <span style="font-weight: 600;">${rating.toFixed(1)}</span>
            </div>
          ` : ''}
          ${id ? `
            <button onclick="window.viewTaller && window.viewTaller(${id})" 
                    style="width: 100%; padding: 8px; background: #ff4400; color: white; font-weight: bold; border: none; border-radius: 6px; cursor: pointer;">
              Ver taller
            </button>
          ` : ''}
        </div>
      `);
        }
    });

    // Ajustar bounds si hay markers válidos
    if (validCount > 0) {
        const bounds = getValidBounds(LRef, items);
        if (bounds && bounds.isValid()) {
            map.fitBounds(bounds.pad(0.1));
        }
    }

    // Log resumen
    if (invalidCount > 0) {
        console.warn(`[Marketplace/init] ${invalidCount} items sin ubicación (no se muestran en mapa)`);
    }
    console.log(`[Marketplace/init] ${validCount} markers renderizados`);
}

// ===== RESULTS FUNCTIONS =====

/**
 * Renderiza la lista de resultados
 * @param {Array} items - Items a renderizar
 */
function renderResultsList(items) {
    const container = byId('marketplace-results');

    if (!container) {
        console.warn('[Marketplace/init] Falta #marketplace-results');
        return;
    }

    // Caso vacío
    if (!items || items.length === 0) {
        container.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-center">
        <span class="material-symbols-outlined text-5xl text-gray-500 mb-4">search_off</span>
        <p class="text-gray-400">Sin resultados</p>
        <p class="text-sm text-gray-500 mt-1">Prueba con otros filtros</p>
      </div>
    `;
        return;
    }

    // Renderizar items
    container.innerHTML = items.map(item => {
        const id = item.id_sucursal || item.id;
        const nombre = escapeHtml(item.nombre || item.titulo_publico || 'Sin título');
        const direccion = escapeHtml(item.direccion || '');
        const precio = item.precio ?? '-';
        const sucursalNombre = escapeHtml(item.sucursal_nombre || '');
        const hasLocation = item.lat !== null && item.lng !== null;
        const rating = parseFloat(item.rating) || 0;

        return `
      <div class="border border-white/10 rounded-xl p-4 mb-3 bg-[#1E1E1E] hover:border-primary/50 transition-colors cursor-pointer"
           onclick="window.viewTaller && window.viewTaller(${id})">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h3 class="font-semibold text-white mb-1">${nombre}</h3>
            ${direccion ? `<p class="text-sm text-gray-400 mb-2">${direccion}</p>` : ''}
            ${rating > 0 ? `
              <div class="flex items-center gap-1 text-yellow-500 text-sm mb-2">
                <span class="material-symbols-outlined" style="font-size: 16px; font-variation-settings: 'FILL' 1;">star</span>
                <span class="font-semibold">${rating.toFixed(1)}</span>
              </div>
            ` : ''}
          </div>
          <div class="text-right">
            ${precio !== '-' ? `<span class="font-bold text-primary">${precio}€</span>` : ''}
          </div>
        </div>
        <div class="flex justify-between items-center mt-2 pt-2 border-t border-white/5">
          ${sucursalNombre ? `<span class="text-xs text-gray-500">${sucursalNombre}</span>` : '<span></span>'}
          <span class="text-xs ${hasLocation ? 'text-gray-500' : 'text-amber-500'}">
            ${hasLocation ? '📍 Ubicación disponible' : '⚠️ Sin ubicación'}
          </span>
        </div>
      </div>
    `;
    }).join('');
}

/**
 * Actualiza el contador de resultados
 * @param {number} count
 */
function updateResultsCount(count) {
    const el = byId('marketplace-results-count') || byId('resultsCount');
    if (el) {
        el.textContent = count === 0
            ? 'Sin resultados'
            : `${count} resultado${count !== 1 ? 's' : ''} encontrado${count !== 1 ? 's' : ''}`;
    }
}

// ===== SEARCH FUNCTIONS =====

/**
 * Ejecuta búsqueda y actualiza UI
 */
async function executeSearch() {
    const container = byId('marketplace-results');
    const loadingState = byId('loadingState');

    // Mostrar loading
    if (loadingState) loadingState.classList.remove('hidden');
    if (container) container.innerHTML = '<div class="p-4 text-gray-400">Cargando...</div>';

    try {
        const items = await searchMarketplace(searchState);

        currentItems = Array.isArray(items) ? items : [];

        // Ocultar loading
        if (loadingState) loadingState.classList.add('hidden');

        // Renderizar
        renderResultsList(currentItems);
        renderMapMarkers(currentItems);
        updateResultsCount(currentItems.length);

    } catch (error) {
        console.error('[Marketplace/init] Error en búsqueda:', error);

        if (loadingState) loadingState.classList.add('hidden');
        if (container) {
            container.innerHTML = `
        <div class="p-4 text-red-400 text-center">
          Error al cargar resultados. Intenta de nuevo.
        </div>
      `;
        }
    }
}

// ===== EVENT LISTENERS =====

/**
 * Configura listeners de eventos
 */
function setupEventListeners() {
    // Escuchar cambios de sucursal
    window.addEventListener('marketplace:sucursalChanged', (event) => {
        const { sucursal_id } = event.detail || {};
        searchState.sucursal_id = sucursal_id || null;

        console.log('[Marketplace/init] Sucursal changed, reloading...', sucursal_id);
        executeSearch();
    });

    // Form de búsqueda si existe
    const searchForm = byId('marketplace-search-form') || byId('filterForm');
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Leer valores del form
            const searchInput = byId('marketplace-search') || byId('mainSearch') || byId('busqueda');
            if (searchInput) {
                searchState.q = searchInput.value.trim();
            }

            executeSearch();
        });
    }

    // Input de búsqueda con debounce
    const searchInput = byId('marketplace-search') || byId('mainSearch') || byId('busqueda');
    if (searchInput) {
        let debounceTimer;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                searchState.q = searchInput.value.trim();
                executeSearch();
            }, 500);
        });
    }
}

// ===== MAIN INIT =====

/**
 * Inicialización principal del Marketplace
 */
async function init() {
    console.log('[Marketplace/init] Inicializando Marketplace...');

    try {
        // 1. Inicializar selector de sucursales (safe)
        await loadSucursalSelector({
            fetchSucursales,
            containerId: 'marketplace-sucursal-selector'
        });

        // 2. Inicializar mapa (safe)
        ensureMap();

        // 3. Setup event listeners
        setupEventListeners();

        // 4. Primera carga de resultados
        await executeSearch();

        console.log('[Marketplace/init] ✅ Marketplace inicializado correctamente');

    } catch (error) {
        console.error('[Marketplace/init] ❌ Error en inicialización:', error);
    }
}

// ===== EXPORTS & AUTO-INIT =====

// Exponer función para navegación
window.viewTaller = function (id) {
    if (id) {
        window.location.href = `/marketplace-taller.html?id_sucursal=${id}`;
    }
};

// Auto-init cuando DOM esté listo
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Exports para uso modular
export {
    init,
    executeSearch,
    ensureMap,
    renderMapMarkers,
    renderResultsList,
    searchState
};

export default {
    init,
    executeSearch
};
