/**
 * Marketplace API Client
 * Contrato estable para comunicación con backend
 * 
 * PRINCIPIOS:
 * - Normalizar lat/lng a number o null
 * - Nunca lanzar excepciones no manejadas
 * - Logging consistente para debugging
 */

const API_PREFIX = '/api/marketplace';

/**
 * Parse JSON de forma segura
 * @param {Response} res - Fetch response
 * @returns {Promise<Object>}
 */
async function safeJson(res) {
    const txt = await res.text();
    try {
        return JSON.parse(txt);
    } catch (e) {
        console.error('[Marketplace/api] JSON parse error:', { raw: txt.substring(0, 200) });
        return { error: 'invalid_json', raw: txt };
    }
}

/**
 * Normaliza coordenadas de un objeto
 * @param {Object} item - Item con lat/lng
 * @returns {Object} - Item con lat/lng normalizados a number|null
 */
function normalizeCoords(item) {
    if (!item) return item;

    const toNum = (v) => {
        if (v === null || v === undefined || v === '') return null;
        const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : Number(v);
        return Number.isFinite(n) ? n : null;
    };

    return {
        ...item,
        lat: toNum(item.lat),
        lng: toNum(item.lng)
    };
}

/**
 * GET /api/marketplace/sucursales
 * Obtener sucursales del tenant actual
 * @returns {Promise<Array>}
 */
export async function fetchSucursales() {
    try {
        const res = await fetch(`${API_PREFIX}/sucursales`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            console.error(`[Marketplace/api] fetchSucursales failed: ${res.status}`);
            return [];
        }

        const data = await safeJson(res);

        // Handle both { ok, data } and direct array
        const items = data.data || (Array.isArray(data) ? data : []);

        // Normalize coords
        return items.map(normalizeCoords);
    } catch (error) {
        console.error('[Marketplace/api] fetchSucursales error:', error);
        return [];
    }
}

/**
 * GET /api/marketplace/busqueda
 * Buscar items en marketplace
 * @param {Object} params - Parámetros de búsqueda
 * @returns {Promise<Object>} - { items: [], total: number }
 */
export async function fetchBusqueda({
    q = '',
    sucursal_id = null,
    categoria = null,
    estado = 'activo',
    limit = 50,
    offset = 0
} = {}) {
    try {
        const params = new URLSearchParams();

        if (q) params.set('q', q);
        if (sucursal_id) params.set('sucursal_id', String(sucursal_id));
        if (categoria) params.set('categoria', categoria);
        if (estado) params.set('estado', estado);
        params.set('limit', String(limit));
        params.set('offset', String(offset));

        const url = `${API_PREFIX}/busqueda?${params.toString()}`;

        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            console.error(`[Marketplace/api] fetchBusqueda failed: ${res.status}`);
            return { items: [], total: 0 };
        }

        const data = await safeJson(res);

        // Handle various response structures
        let items = [];
        let total = 0;

        if (Array.isArray(data)) {
            items = data;
            total = data.length;
        } else if (data.items && Array.isArray(data.items)) {
            items = data.items;
            total = data.total || data.items.length;
        } else if (data.data && Array.isArray(data.data)) {
            items = data.data;
            total = data.total || data.data.length;
        }

        // Normalize coords in all items
        items = items.map(normalizeCoords);

        return { items, total, limit, offset };
    } catch (error) {
        console.error('[Marketplace/api] fetchBusqueda error:', error);
        return { items: [], total: 0, limit, offset };
    }
}

/**
 * GET /api/marketplace/search (endpoint alternativo existente)
 * Para compatibilidad con endpoint actual
 * @param {Object} params - Parámetros de búsqueda
 * @returns {Promise<Array>}
 */
export async function searchMarketplace(params = {}) {
    try {
        const queryParams = new URLSearchParams();

        Object.entries(params).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                queryParams.set(key, String(value));
            }
        });

        const url = `${API_PREFIX}/search?${queryParams.toString()}`;

        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            console.error(`[Marketplace/api] searchMarketplace failed: ${res.status}`);
            return [];
        }

        const data = await safeJson(res);

        // Handle { ok, data } or direct array
        const items = data.data || (Array.isArray(data) ? data : []);

        // Normalize coords
        return items.map(normalizeCoords);
    } catch (error) {
        console.error('[Marketplace/api] searchMarketplace error:', error);
        return [];
    }
}

/**
 * GET /api/marketplace/sucursales/:id
 * Obtener detalle de una sucursal
 * @param {number|string} id - ID de sucursal
 * @returns {Promise<Object|null>}
 */
export async function getSucursalDetail(id) {
    try {
        const res = await fetch(`${API_PREFIX}/sucursales/${id}`, {
            headers: { 'Accept': 'application/json' }
        });

        if (!res.ok) {
            console.error(`[Marketplace/api] getSucursalDetail failed: ${res.status}`);
            return null;
        }

        const data = await safeJson(res);
        const item = data.data || data;

        return normalizeCoords(item);
    } catch (error) {
        console.error('[Marketplace/api] getSucursalDetail error:', error);
        return null;
    }
}

// Export default for compatibility
export default {
    fetchSucursales,
    fetchBusqueda,
    searchMarketplace,
    getSucursalDetail
};
