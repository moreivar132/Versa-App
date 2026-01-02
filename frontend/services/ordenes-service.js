// Get API base URL from environment variable or use localhost as fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

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
        if (filtros.sucursal) params.append('idSucursal', filtros.sucursal);
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

/**
 * Obtiene una orden específica con sus líneas y pagos
 * @param {number} idOrden - ID de la orden
 * @returns {Promise<Object>} - Orden completa con líneas y pagos
 */
export async function getOrdenById(idOrden) {
    const API_URL = `${API_BASE_URL}/api/ordenes/${idOrden}`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al obtener la orden');
        }

        return data;
    } catch (error) {
        console.error('Error obteniendo orden:', error);
        throw error;
    }
}

/**
 * Actualiza una orden existente
 * @param {number} idOrden - ID de la orden a actualizar
 * @param {Object} ordenData - Datos actualizados de la orden
 * @returns {Promise<Object>} - Resultado de la actualización
 */
export async function updateOrden(idOrden, ordenData) {
    const API_URL = `${API_BASE_URL}/api/ordenes/${idOrden}`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(ordenData)
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al actualizar la orden');
        }

        return data;
    } catch (error) {
        console.error('Error actualizando orden:', error);
        throw error;
    }
}

/**
 * Actualiza solo el estado de una orden (cambio rápido)
 * @param {number} idOrden - ID de la orden
 * @param {Object} estadoData - { idEstadoOrden } o { codigoEstado }
 * @returns {Promise<Object>} - Estado actualizado
 */
export async function updateEstadoOrden(idOrden, estadoData) {
    const API_URL = `${API_BASE_URL}/api/ordenes/${idOrden}/estado`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(estadoData)
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al actualizar el estado');
        }

        return data;
    } catch (error) {
        console.error('Error actualizando estado:', error);
        throw error;
    }
}

/**
 * Obtiene la lista de estados de orden disponibles
 * @returns {Promise<Array>} - Lista de estados
 */
export async function getEstadosOrden() {
    const API_URL = `${API_BASE_URL}/api/ordenes/estados`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al obtener estados');
        }

        return data.estados || data || [];
    } catch (error) {
        console.error('Error obteniendo estados:', error);
        throw error;
    }
}

/**
 * Actualiza la configuración de un estado de orden (nombre, color, orden)
 * @param {number} idEstado - ID del estado a actualizar
 * @param {Object} config - { nombre, color, orden }
 * @returns {Promise<Object>} - Estado actualizado
 */
export async function updateEstadoConfig(idEstado, config) {
    const API_URL = `${API_BASE_URL}/api/ordenes/estados/${idEstado}`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(config)
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al actualizar el estado');
        }

        return data.data || data;
    } catch (error) {
        console.error('Error actualizando configuración de estado:', error);
        throw error;
    }
}

/**
 * Actualiza múltiples estados a la vez
 * @param {Array} estados - Array de estados con { id, nombre, color, orden }
 * @returns {Promise<Array>} - Estados actualizados
 */
export async function updateEstadosBatch(estados) {
    const API_URL = `${API_BASE_URL}/api/ordenes/estados`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ estados })
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al actualizar estados');
        }

        return data.data || data;
    } catch (error) {
        console.error('Error actualizando estados:', error);
        throw error;
    }
}
