import api from '/api.js';

// Cargar sucursales desde la API
export async function loadSucursales() {
    try {
        const response = await api.get('/api/sucursales');
        const sucursales = response.data;
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
    }
}
