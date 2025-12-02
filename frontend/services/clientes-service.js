export async function searchClientes(query) {
    const API_URL = 'http://localhost:3000/api/clientes/search';

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
