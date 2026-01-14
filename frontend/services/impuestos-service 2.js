const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export async function getImpuestos() {
    try {
        const sessionRaw = localStorage.getItem('versa_session_v1');
        if (!sessionRaw) throw new Error('No autenticado');
        const token = JSON.parse(sessionRaw).token;

        const response = await fetch(`${API_BASE_URL}/api/impuestos`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Error cargando impuestos');
        return await response.json();
    } catch (error) {
        console.error(error);
        return [];
    }
}
