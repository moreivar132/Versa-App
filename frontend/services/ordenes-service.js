export async function createOrden(ordenData) {
    const API_URL = 'http://localhost:3000/api/ordenes';

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
