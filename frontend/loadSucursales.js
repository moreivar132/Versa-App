export async function loadSucursales() {
    const API_URL = 'http://localhost:3000/api/sucursales';

    try {
        // 1. Obtener el token de la sesión
        const sessionRaw = localStorage.getItem('versa_session_v1');
        let token = null;
        if (sessionRaw) {
            try {
                const session = JSON.parse(sessionRaw);
                token = session.token;
            } catch (e) {
                console.warn("Error leyendo sesión", e);
            }
        }

        if (!token) {
            console.error("❌ No hay token de sesión. El usuario debe loguearse.");
            // Opcional: Redirigir al login si es crítico
            // window.location.href = '/login.html';
            throw new Error("No autenticado");
        }

        console.log("🔄 Intentando cargar sucursales...");

        // 2. Hacer el fetch con el header de autorización
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }

        const sucursales = await response.json();
        const tallerSelect = document.getElementById('taller');

        if (!tallerSelect) {
            console.error('No se encontró el select de taller');
            return;
        }

        // Guardar la opción por defecto
        const defaultOption = tallerSelect.querySelector('option[value=""]');
        tallerSelect.innerHTML = '';
        if (defaultOption) {
            tallerSelect.appendChild(defaultOption);
        }

        // Agregar las sucursales
        sucursales.forEach(sucursal => {
            const option = document.createElement('option');
            option.value = sucursal.id;
            option.textContent = sucursal.nombre;
            tallerSelect.appendChild(option);
        });

        console.log(`✅ Cargadas ${sucursales.length} sucursales`);
    } catch (error) {
        console.error("❌ Error cargando sucursales:", error);
        const tallerSelect = document.getElementById('taller');
        if (tallerSelect) {
            const option = document.createElement('option');
            option.textContent = `Error: ${error.message}`;
            option.style.color = 'red';
            tallerSelect.appendChild(option);
        }
    }
}
