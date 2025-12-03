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
