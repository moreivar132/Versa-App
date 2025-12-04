// Get API base URL from environment variable or use localhost as fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function searchVehiculos(query, clientId = null) {
    const API_URL = `${API_BASE_URL}/api/vehiculos/search`;

    try {
        // Obtener token
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error("No autenticado");
        const token = JSON.parse(sessionRaw).token;

        const url = new URL(API_URL);
        if (query) url.searchParams.set('q', query);
        if (clientId) url.searchParams.set('id_cliente', clientId);

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error("Error al buscar vehículos");

        return await response.json();

    } catch (error) {
        console.error("Error buscando vehículos:", error);
        return [];
    }
}

export async function createVehicle(vehicleData) {
    const API_URL = `${API_BASE_URL}/api/vehiculos`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error("No autenticado");
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(vehicleData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al crear vehículo');
        }

        return await response.json();
    } catch (error) {
        console.error("Error creando vehículo:", error);
        throw error;
    }
}
