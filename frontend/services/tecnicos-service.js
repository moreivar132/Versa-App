// Get API base URL from environment variable or use localhost as fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function getTecnicos() {
    const API_URL = `${API_BASE_URL}/api/admin/users`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error("No autenticado");
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Error al obtener técnicos");

        const users = await response.json();

        // Filtrar solo usuarios con rol de mecánico
        return users.filter(user => {
            const roles = user.roles || [];
            return roles.some(role => {
                const r = String(role).toLowerCase();
                return r.includes('mecanico') || r.includes('mecánico');
            });
        });

    } catch (error) {
        console.error("Error obteniendo técnicos:", error);
        return [];
    }
}

export async function searchTecnicos(query) {
    const users = await getTecnicos();
    if (!query) return users;
    return users.filter(user => user.nombre.toLowerCase().includes(query.toLowerCase()));
}
