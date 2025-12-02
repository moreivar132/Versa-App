
export async function searchVehiculos(query) {
    const API_URL = 'http://localhost:3000/api/vehiculos';

    try {
        // Obtener token
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error("No autenticado");
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Error al obtener vehículos");

        const allVehiculos = await response.json();

        if (!query) return allVehiculos.slice(0, 10); // Retornar los primeros 10 si no hay query

        const lowerQuery = query.toLowerCase();
        return allVehiculos.filter(v =>
            (v.matricula && v.matricula.toLowerCase().includes(lowerQuery)) ||
            (v.marca && v.marca.toLowerCase().includes(lowerQuery)) ||
            (v.modelo && v.modelo.toLowerCase().includes(lowerQuery)) ||
            (v.nombre_cliente && v.nombre_cliente.toLowerCase().includes(lowerQuery))
        );

    } catch (error) {
        console.error("Error buscando vehículos:", error);
        return [];
    }
}
