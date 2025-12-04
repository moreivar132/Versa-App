// Get API base URL from environment variable or use localhost as fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function searchClientes(query) {
    const API_URL = `${API_BASE_URL}/api/clientes/search`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        const url = new URL(API_URL);
        url.searchParams.set('q', query);

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Error al buscar clientes');

        return await response.json();
    } catch (error) {
        console.error('Error buscando clientes:', error);
        return [];
    }
}

export async function createClient(clientData) {
    const API_URL = `${API_BASE_URL}/api/clientes`;

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
            body: JSON.stringify(clientData)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al crear cliente');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creando cliente:', error);
        throw error;
    }
}
