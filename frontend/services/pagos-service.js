// Get API base URL from environment variable or use localhost as fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Obtiene el token de autenticación
 */
function getAuthToken() {
    const sessionRaw = localStorage.getItem('versa_session_v1');
    if (!sessionRaw) return null;
    try {
        return JSON.parse(sessionRaw).token;
    } catch {
        return null;
    }
}

/**
 * Registra un pago para una orden
 * @param {number} idOrden - ID de la orden
 * @param {Object} pagoData - Datos del pago (idMedioPago, importe, referencia)
 */
export async function registrarPago(idOrden, pagoData) {
    const token = getAuthToken();
    if (!token) throw new Error('No autenticado');

    const response = await fetch(`${API_BASE_URL}/api/ordenpago`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
            idOrden: idOrden,
            idMedioPago: pagoData.idMedioPago,
            importe: pagoData.importe,
            referencia: pagoData.referencia || null,
            idCaja: 1
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.mensaje || 'Error al registrar pago');
    }

    return response.json();
}

/**
 * Obtiene los pagos de una orden
 * @param {number} idOrden - ID de la orden
 */
export async function obtenerPagosOrden(idOrden) {
    const token = getAuthToken();
    if (!token) throw new Error('No autenticado');

    const response = await fetch(`${API_BASE_URL}/api/ordenpago/orden/${idOrden}`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error('Error al obtener pagos');
    }

    return response.json();
}

/**
 * Obtiene los medios de pago disponibles
 */
export async function obtenerMediosPago() {
    const token = getAuthToken();
    if (!token) throw new Error('No autenticado');

    const response = await fetch(`${API_BASE_URL}/api/medio-pago`, {
        headers: {
            'Authorization': `Bearer ${token}`
        }
    });

    if (!response.ok) {
        throw new Error('Error al obtener medios de pago');
    }

    return response.json();
}
