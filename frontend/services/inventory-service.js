// Get API base URL from environment variable or use localhost as fallback
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export async function searchInventario(query, idSucursal) {
    const API_URL = `${API_BASE_URL}/api/inventory/search`;

    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        if (!idSucursal) {
            throw new Error('Debes seleccionar un taller antes de buscar.');
        }

        const url = new URL(API_URL);
        url.searchParams.set('q', query || '');
        url.searchParams.set('id_sucursal', idSucursal);

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al buscar en inventario');
        }

        return await response.json();
    } catch (error) {
        console.error('Error buscando inventario:', error);
        return [];
    }
}

export async function createProduct(productData) {
    const API_URL = `${API_BASE_URL}/api/inventory`;

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
            body: JSON.stringify(productData)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Error al crear producto');
        }

        return await response.json();
    } catch (error) {
        console.error('Error creando producto:', error);
        throw error;
    }
}
