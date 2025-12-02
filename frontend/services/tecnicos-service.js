
export async function searchTecnicos(query) {
    const API_URL = 'http://localhost:3000/api/admin/users'; // Ajustar si hay un endpoint específico

    try {
        // Obtener token
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error("No autenticado");
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Error al buscar técnicos");

        const users = await response.json();

        // Filtrar por nombre y rol (asumiendo que user.roles es un array de strings o objetos)
        // Y que el rol relevante es "Mecánico" o "Técnico"
        // Si no sabemos el rol exacto, mostraremos todos los que coincidan con el nombre por ahora

        return users.filter(user => {
            const matchName = user.nombre.toLowerCase().includes(query.toLowerCase());
            // TODO: Filtrar también por rol cuando sepamos la estructura exacta
            // const isMecanico = user.roles.some(r => r.nombre === 'Mecánico');
            return matchName;
        });

    } catch (error) {
        console.error("Error buscando técnicos:", error);
        return [];
    }
}
