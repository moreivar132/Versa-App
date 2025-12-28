const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// Constante para leer la sucursal guardada
const SUCURSAL_STORAGE_KEY = 'versa_selected_sucursal';

export async function loadSucursales() {
    const API_URL = `${API_BASE_URL}/api/sucursales`;

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

        // Leer la sucursal guardada en localStorage
        const savedSucursal = localStorage.getItem(SUCURSAL_STORAGE_KEY);

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

            // Pre-seleccionar si coincide con la guardada
            if (savedSucursal && sucursal.id == savedSucursal) {
                option.selected = true;
            }

            tallerSelect.appendChild(option);
        });

        // Si hay sucursal guardada pero no se encontró (usuario cambió de tenant), seleccionar la primera
        if (savedSucursal && !sucursales.some(s => s.id == savedSucursal) && sucursales.length > 0) {
            tallerSelect.value = sucursales[0].id;
        }

        // Si no hay sucursal guardada y hay sucursales disponibles, seleccionar la primera
        if (!savedSucursal && sucursales.length > 0) {
            tallerSelect.value = sucursales[0].id;
        }

        console.log(`✅ Cargadas ${sucursales.length} sucursales${savedSucursal ? ` (pre-seleccionada: ${savedSucursal})` : ''}`);
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

