/**
 * Marketplace Geo Utilities
 * Validación y normalización de coordenadas para Leaflet
 * 
 * OBJETIVO: Evitar crashes de Leaflet cuando lat/lng son null/undefined/inválidos
 */

/**
 * Convierte cualquier valor a número, o null si inválido
 * @param {*} v - Valor a convertir
 * @returns {number|null}
 */
export function toNum(v) {
    if (v === null || v === undefined || v === '') return null;

    // Handle string with comma as decimal separator (European format)
    const n = typeof v === 'string'
        ? parseFloat(v.replace(',', '.').trim())
        : Number(v);

    return Number.isFinite(n) ? n : null;
}

/**
 * Valida si las coordenadas son válidas para Leaflet
 * @param {number} lat - Latitud
 * @param {number} lng - Longitud
 * @returns {boolean}
 */
export function isValidLatLng(lat, lng) {
    return (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Math.abs(lat) <= 90 &&
        Math.abs(lng) <= 180
    );
}

/**
 * Extrae lat/lng de un objeto de forma flexible
 * @param {Object} item - Item con coordenadas
 * @returns {{ lat: number|null, lng: number|null }}
 */
export function extractCoords(item) {
    if (!item) return { lat: null, lng: null };

    // Buscar latitud
    const rawLat = item.lat ?? item.latitude ?? item.coords?.lat ?? item.location?.lat ?? null;

    // Buscar longitud (lng, lon, longitude)
    const rawLng = item.lng ?? item.lon ?? item.longitude ?? item.coords?.lng ?? item.coords?.lon ?? item.location?.lng ?? item.location?.lon ?? null;

    return {
        lat: toNum(rawLat),
        lng: toNum(rawLng)
    };
}

/**
 * Crea un marker SOLO si las coordenadas son válidas.
 * Si no, retorna null y hace console.warn.
 * 
 * @param {Object} L - Referencia a Leaflet
 * @param {Object} mapOrLayer - Mapa o LayerGroup donde añadir el marker
 * @param {Object} item - Item con datos (debe tener lat/lng o coords)
 * @param {Object} opts - Opciones
 * @param {Function} opts.getLat - Función custom para extraer lat
 * @param {Function} opts.getLng - Función custom para extraer lng
 * @param {Function} opts.onInvalid - Callback cuando coords son inválidas
 * @param {Object} opts.markerOptions - Opciones adicionales para L.marker
 * @returns {L.Marker|null}
 */
export function safeAddMarker(L, mapOrLayer, item, opts = {}) {
    if (!L || !mapOrLayer || !item) {
        console.warn('[Marketplace/geo] safeAddMarker llamado con parámetros inválidos');
        return null;
    }

    const getLat = opts.getLat || ((x) => x?.lat ?? x?.latitude ?? x?.coords?.lat);
    const getLng = opts.getLng || ((x) => x?.lng ?? x?.lon ?? x?.longitude ?? x?.coords?.lng);
    const onInvalid = opts.onInvalid || null;

    const rawLat = getLat(item);
    const rawLng = getLng(item);
    const lat = toNum(rawLat);
    const lng = toNum(rawLng);

    if (!isValidLatLng(lat, lng)) {
        // Log warning para debugging en dev
        console.warn('[Marketplace] Marker omitido por coords inválidas', {
            id: item?.id ?? item?.id_sucursal ?? 'unknown',
            nombre: item?.nombre ?? item?.titulo_publico ?? '',
            rawLat,
            rawLng,
            parsedLat: lat,
            parsedLng: lng
        });

        // Callback opcional para UIs que quieran marcar items sin ubicación
        if (typeof onInvalid === 'function') {
            try {
                onInvalid(item);
            } catch (e) {
                console.error('[Marketplace/geo] Error en onInvalid callback', e);
            }
        }

        return null;
    }

    // Crear marker con opciones adicionales si se proveen
    const markerOptions = opts.markerOptions || {};
    const marker = L.marker([lat, lng], markerOptions);

    // Añadir al mapa o layer
    if (typeof mapOrLayer.addLayer === 'function') {
        mapOrLayer.addLayer(marker);
    } else if (typeof marker.addTo === 'function') {
        marker.addTo(mapOrLayer);
    }

    return marker;
}

/**
 * Convierte una lista de items a LatLngBounds para fitBounds
 * Solo incluye items con coordenadas válidas
 * 
 * @param {Object} L - Referencia a Leaflet
 * @param {Array} items - Lista de items
 * @returns {L.LatLngBounds|null}
 */
export function getValidBounds(L, items) {
    if (!L || !items || items.length === 0) return null;

    const validCoords = items
        .map(item => extractCoords(item))
        .filter(({ lat, lng }) => isValidLatLng(lat, lng));

    if (validCoords.length === 0) return null;

    const bounds = L.latLngBounds(
        validCoords.map(({ lat, lng }) => [lat, lng])
    );

    return bounds;
}

// Export por defecto para compatibilidad
export default {
    toNum,
    isValidLatLng,
    extractCoords,
    safeAddMarker,
    getValidBounds
};
