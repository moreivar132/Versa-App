// Servicio de Ventas para el Frontend
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

function getAuthHeaders() {
    const sessionRaw = localStorage.getItem('versa_session_v1');
    if (!sessionRaw) throw new Error('No autenticado');
    const token = JSON.parse(sessionRaw).token;
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    };
}

/**
 * Crear una nueva venta
 * @param {Object} ventaData - Datos de la venta
 * @returns {Promise<Object>}
 */
export async function createVenta(ventaData) {
    const API_URL = `${API_BASE_URL}/api/ventas`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(ventaData)
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al crear venta');
        }

        return data;
    } catch (error) {
        console.error('Error creando venta:', error);
        throw error;
    }
}

/**
 * Obtener lista de ventas con filtros
 * @param {Object} filtros - Filtros opcionales
 * @returns {Promise<Object>}
 */
export async function getVentas(filtros = {}) {
    const params = new URLSearchParams();

    if (filtros.idSucursal) params.append('idSucursal', filtros.idSucursal);
    if (filtros.idCliente) params.append('idCliente', filtros.idCliente);
    if (filtros.fechaDesde) params.append('fechaDesde', filtros.fechaDesde);
    if (filtros.fechaHasta) params.append('fechaHasta', filtros.fechaHasta);
    if (filtros.estado) params.append('estado', filtros.estado);
    if (filtros.busqueda) params.append('busqueda', filtros.busqueda);
    if (filtros.limit) params.append('limit', filtros.limit);
    if (filtros.offset) params.append('offset', filtros.offset);

    const queryString = params.toString();
    const API_URL = `${API_BASE_URL}/api/ventas${queryString ? `?${queryString}` : ''}`;

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al obtener ventas');
        }

        return data;
    } catch (error) {
        console.error('Error obteniendo ventas:', error);
        throw error;
    }
}

/**
 * Obtener una venta por ID
 * @param {number} idVenta - ID de la venta
 * @returns {Promise<Object>}
 */
export async function getVentaById(idVenta) {
    const API_URL = `${API_BASE_URL}/api/ventas/${idVenta}`;

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al obtener venta');
        }

        return data;
    } catch (error) {
        console.error('Error obteniendo venta:', error);
        throw error;
    }
}

/**
 * Anular una venta
 * @param {number} idVenta - ID de la venta a anular
 * @returns {Promise<Object>}
 */
export async function anularVenta(idVenta) {
    const API_URL = `${API_BASE_URL}/api/ventas/${idVenta}/anular`;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: getAuthHeaders()
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al anular venta');
        }

        return data;
    } catch (error) {
        console.error('Error anulando venta:', error);
        throw error;
    }
}

/**
 * Actualizar una venta existente
 * @param {number} idVenta - ID de la venta a actualizar
 * @param {Object} ventaData - Datos actualizados de la venta
 * @returns {Promise<Object>}
 */
export async function updateVenta(idVenta, ventaData) {
    const API_URL = `${API_BASE_URL}/api/ventas/${idVenta}`;

    try {
        const response = await fetch(API_URL, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(ventaData)
        });

        const data = await response.json();
        if (!response.ok || data.ok === false) {
            throw new Error(data.error || 'Error al actualizar venta');
        }

        return data;
    } catch (error) {
        console.error('Error actualizando venta:', error);
        throw error;
    }
}
