// Get API base URL from environment variable or use localhost as fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function createOrden(ordenData) {
    const API_URL = `${API_BASE_URL}/api/ordenes`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(ordenData)
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al crear orden');
        }

        return data;
    } catch (error) {
        console.error('Error creando orden:', error);
        throw error;
    }
}

/**
 * Obtiene la lista de órdenes con filtros opcionales
 * @param {Object} filtros - Filtros opcionales (estado, estadoPago, busqueda, fechaDesde, fechaHasta)
 * @returns {Promise<Object>} - Lista de órdenes y metadata
 */
export async function getOrdenes(filtros = {}) {
    const API_URL = `${API_BASE_URL}/api/ordenes`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        // Construir query string
        const params = new URLSearchParams();
        if (filtros.estado) params.append('estado', filtros.estado);
        if (filtros.estadoPago) params.append('estadoPago', filtros.estadoPago);
        if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
        if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde);
        if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta);
        if (filtros.limit) params.append('limit', filtros.limit);
        if (filtros.offset) params.append('offset', filtros.offset);

        const url = params.toString() ? `${API_URL}?${params}` : API_URL;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al obtener órdenes');
        }

        return data;
    } catch (error) {
        console.error('Error obteniendo órdenes:', error);
        throw error;
    }
}
