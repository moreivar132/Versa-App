/**
 * Servicio de técnicos - FILTRADO POR SUCURSAL
 * 
 * Los técnicos SOLO se cargan para la sucursal activa.
 * Usa el endpoint: GET /api/sucursales/:id/tecnicos
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Obtiene los técnicos asignados a una sucursal específica
 * @param {number} idSucursal - ID de la sucursal activa
 * @returns {Promise<Array>} Lista de técnicos {id, nombre, email}
 */
export async function getTecnicosBySucursal(idSucursal) {
    if (!idSucursal) {
        console.warn('[getTecnicosBySucursal] No se proporcionó idSucursal');
        return [];
    }

    const API_URL = `${API_BASE_URL}/api/sucursales/${idSucursal}/tecnicos`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error("No autenticado");
        const token = JSON.parse(sessionRaw).token;

        console.log(`[Tecnicos] Cargando técnicos de sucursal ${idSucursal}...`);

        const response = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            if (response.status === 404) {
                console.warn(`[getTecnicosBySucursal] Sucursal ${idSucursal} no encontrada`);
                return [];
            }
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const data = await response.json();
        console.log(`[Tecnicos] ${data.tecnicos?.length || 0} técnicos encontrados`);
        return data.tecnicos || [];

    } catch (error) {
        console.error("[Tecnicos] Error:", error);
        return [];
    }
}

/**
 * Busca técnicos por nombre dentro de una sucursal
 * @param {string} query - Texto de búsqueda
 * @param {number} idSucursal - ID de la sucursal
 * @returns {Promise<Array>} Lista de técnicos filtrados
 */
export async function searchTecnicos(query, idSucursal) {
    const tecnicos = await getTecnicosBySucursal(idSucursal);
    if (!query) return tecnicos;
    return tecnicos.filter(tec =>
        tec.nombre.toLowerCase().includes(query.toLowerCase())
    );
}

/**
 * @deprecated Usa getTecnicosBySucursal(idSucursal) en su lugar
 */
export async function getTecnicos() {
    console.warn('[DEPRECADO] getTecnicos() ya no funciona. Usa getTecnicosBySucursal(idSucursal)');
    return [];
}
