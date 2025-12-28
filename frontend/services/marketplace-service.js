// frontend/services/marketplace-service.js

// Usar rutas relativas para que pasen por el proxy de Vite en desarrollo
// y funcionen correctamente en producción
const API_BASE_URL = '';

console.log('🏪 Marketplace API initialized (relative URLs)');

/**
 * Buscar talleres en el marketplace
 * @param {Object} params - Parámetros de búsqueda
 * @param {string} params.ubicacion - Ubicación/zona
 * @param {number} params.distancia - Distancia en km
 * @param {string} params.servicio - Tipo de servicio
 * @param {string} params.tipoVehiculo - Tipo de vehículo (moto/coche/bici)
 * @param {number} params.precioMin - Precio mínimo
 * @param {number} params.precioMax - Precio máximo
 * @param {number} params.ratingMin - Rating mínimo
 * @param {string} params.fecha - Fecha (YYYY-MM-DD)
 * @param {boolean} params.soloOfertas - Solo ofertas
 * @param {number} params.lat - Latitud
 * @param {number} params.lng - Longitud
 * @returns {Promise<Array>} Lista de talleres/sucursales
 */
export async function searchMarketplace(params) {
    try {
        const queryParams = new URLSearchParams();
        Object.keys(params).forEach(key => {
            if (params[key] !== null && params[key] !== undefined && params[key] !== '') {
                queryParams.append(key, params[key]);
            }
        });

        const response = await fetch(`${API_BASE_URL}/api/marketplace/search?${queryParams.toString()}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('❌ Error buscando en marketplace:', error);
        // Return mock data on error
        return getMockSearchResults();
    }
}

/**
 * Obtener detalles de una sucursal
 * @param {number} id - ID de la sucursal
 * @returns {Promise<Object>} Detalles de la sucursal
 */
export async function getSucursalDetail(id) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/marketplace/sucursales/${id}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();

        // Extract data from response (API returns {ok, data})
        const data = result.data || result;

        // Normalize field names for compatibility
        return {
            ...data,
            nombre: data.nombre || data.titulo_publico || data.sucursal_nombre,
            telefono: data.telefono || data.telefono_publico,
            descripcion: data.descripcion || data.descripcion_publica,
            servicios_completos: data.servicios_completos || data.servicios_destacados || [],
            ofertas: data.ofertas || [],
            resenas: data.resenas || []
        };
    } catch (error) {
        console.error('❌ Error obteniendo detalles de sucursal:', error);
        // Return mock data on error
        return getMockSucursalDetail(id);
    }
}

/**
 * Obtener disponibilidad de una sucursal
 * @param {number} id - ID de la sucursal
 * @param {string} fecha - Fecha (YYYY-MM-DD)
 * @param {number} servicioId - ID del servicio (opcional)
 * @returns {Promise<Array>} Slots disponibles
 */
export async function getAvailability(id, fecha, servicioId = null) {
    try {
        const queryParams = new URLSearchParams({ fecha });
        if (servicioId) queryParams.append('servicio_id', servicioId);

        const response = await fetch(`${API_BASE_URL}/api/marketplace/sucursales/${id}/availability?${queryParams.toString()}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        // API returns { ok, data, fecha }
        return result.data || [];
    } catch (error) {
        console.error('❌ Error obteniendo disponibilidad:', error);
        // Return empty on error instead of mock
        return [];
    }
}

/**
 * Crear una reserva
 * @param {Object} payload - Datos de la reserva
 * @param {number} payload.sucursalId - ID de la sucursal
 * @param {number} payload.servicioId - ID del servicio
 * @param {string} payload.fecha - Fecha (YYYY-MM-DD)
 * @param {string} payload.hora - Hora (HH:MM)
 * @param {string} payload.nombre - Nombre del cliente
 * @param {string} payload.telefono - Teléfono
 * @param {string} payload.email - Email
 * @param {string} payload.tipoVehiculo - Tipo de vehículo
 * @param {string} payload.matricula - Matrícula (opcional)
 * @param {string} payload.notas - Notas adicionales (opcional)
 * @returns {Promise<Object>} Confirmación de la reserva
 */
export async function bookAppointment(payload) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/marketplace/book`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const msg = errorData.details
                ? `${errorData.error}: ${errorData.details}`
                : (errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
            throw new Error(msg);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('❌ Error creando reserva:', error);
        throw error;
    }
}

// ===== MOCK DATA =====

function getMockSearchResults() {
    return [
        {
            id_sucursal: 1,
            nombre: 'Taller MotoExpress - Centro',
            direccion: 'Calle Gran Vía, 45, Madrid',
            zona: 'Centro',
            lat: 40.4168,
            lng: -3.7038,
            rating: 4.8,
            reviews_count: 142,
            proximaCita: 'Hoy 16:00',
            tiene_oferta: true,
            fotos: [
                'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=800',
                'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800',
                'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=800'
            ],
            servicios_destacados: [
                { nombre: 'Cambio de aceite', duracion_min: 30, precio: 45 },
                { nombre: 'Revisión frenos', duracion_min: 45, precio: 65 },
                { nombre: 'ITV pre-revisión', duracion_min: 60, precio: 40 }
            ]
        },
        {
            id_sucursal: 2,
            nombre: 'BikeService Pro',
            direccion: 'Av. de la Castellana, 120, Madrid',
            zona: 'Chamartín',
            lat: 40.4520,
            lng: -3.6889,
            rating: 4.9,
            reviews_count: 98,
            proximaCita: 'Mañana 09:00',
            tiene_oferta: false,
            fotos: [
                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800'
            ],
            servicios_destacados: [
                { nombre: 'Diagnóstico completo', duracion_min: 90, precio: 85 },
                { nombre: 'Cambio neumáticos', duracion_min: 60, precio: 120 },
                { nombre: 'Mantenimiento general', duracion_min: 120, precio: 150 }
            ]
        },
        {
            id_sucursal: 3,
            nombre: 'Taller Rápido Motos - Arganzuela',
            direccion: 'Paseo de las Delicias, 30, Madrid',
            zona: 'Arganzuela',
            lat: 40.3973,
            lng: -3.6951,
            rating: 4.5,
            reviews_count: 67,
            proximaCita: 'Hoy 18:30',
            tiene_oferta: true,
            fotos: [
                'https://images.unsplash.com/photo-1558617140-98ae5f7da5bf?w=800'
            ],
            servicios_destacados: [
                { nombre: 'Cambio de aceite express', duracion_min: 20, precio: 35 },
                { nombre: 'Revisión pre-ITV', duracion_min: 45, precio: 38 },
                { nombre: 'Cambio filtro aire', duracion_min: 15, precio: 25 }
            ]
        },
        {
            id_sucursal: 4,
            nombre: 'MotoTech Solutions',
            direccion: 'Calle Alcalá, 200, Madrid',
            zona: 'Salamanca',
            lat: 40.4300,
            lng: -3.6700,
            rating: 4.7,
            reviews_count: 203,
            proximaCita: 'Lun 10:00',
            tiene_oferta: false,
            fotos: [
                'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=800',
                'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=800',
                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800'
            ],
            servicios_destacados: [
                { nombre: 'Revisión completa', duracion_min: 120, precio: 95 },
                { nombre: 'Cambio líquido frenos', duracion_min: 40, precio: 55 },
                { nombre: 'Ajuste cadena', duracion_min: 20, precio: 20 }
            ]
        },
        {
            id_sucursal: 5,
            nombre: 'Taller Custom Bikes',
            direccion: 'Calle de Bravo Murillo, 85, Madrid',
            zona: 'Tetuán',
            lat: 40.4500,
            lng: -3.7000,
            rating: 4.6,
            reviews_count: 89,
            proximaCita: 'Hoy 14:00',
            tiene_oferta: true,
            fotos: [
                'https://images.unsplash.com/photo-1558617140-98ae5f7da5bf?w=800',
                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800'
            ],
            servicios_destacados: [
                { nombre: 'Personalización', duracion_min: 180, precio: 250 },
                { nombre: 'Cambio escape', duracion_min: 90, precio: 180 },
                { nombre: 'Pintura custom', duracion_min: 240, precio: 400 }
            ]
        },
        {
            id_sucursal: 6,
            nombre: 'Motos y Más - Carabanchel',
            direccion: 'Calle General Ricardos, 150, Madrid',
            zona: 'Carabanchel',
            lat: 40.3850,
            lng: -3.7350,
            rating: 4.4,
            reviews_count: 54,
            proximaCita: 'Mañana 11:00',
            tiene_oferta: false,
            fotos: [
                'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=800'
            ],
            servicios_destacados: [
                { nombre: 'Revisión básica', duracion_min: 60, precio: 50 },
                { nombre: 'Cambio pastillas', duracion_min: 45, precio: 70 },
                { nombre: 'Limpieza carburadores', duracion_min: 90, precio: 85 }
            ]
        },
        {
            id_sucursal: 7,
            nombre: 'Electric Bike Center',
            direccion: 'Calle de Embajadores, 75, Madrid',
            zona: 'Lavapiés',
            lat: 40.4080,
            lng: -3.7020,
            rating: 4.9,
            reviews_count: 112,
            proximaCita: 'Hoy 17:00',
            tiene_oferta: true,
            fotos: [
                'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800',
                'https://images.unsplash.com/photo-1625047509168-a7026f36de04?w=800',
                'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=800'
            ],
            servicios_destacados: [
                { nombre: 'Revisión batería', duracion_min: 40, precio: 60 },
                { nombre: 'Actualización software', duracion_min: 30, precio: 45 },
                { nombre: 'Diagnóstico eléctrico', duracion_min: 60, precio: 75 }
            ]
        },
        {
            id_sucursal: 8,
            nombre: 'Taller Integral Motos - Retiro',
            direccion: 'Calle O\'Donnell, 30, Madrid',
            zona: 'Retiro',
            lat: 40.4200,
            lng: -3.6750,
            rating: 4.8,
            reviews_count: 176,
            proximaCita: 'Mañana 15:00',
            tiene_oferta: false,
            fotos: [
                'https://images.unsplash.com/photo-1558617140-98ae5f7da5bf?w=800',
                'https://images.unsplash.com/photo-1487754180451-c456f719a1fc?w=800'
            ],
            servicios_destacados: [
                { nombre: 'Cambio kit transmisión', duracion_min: 120, precio: 200 },
                { nombre: 'Revisión suspensión', duracion_min: 90, precio: 110 },
                { nombre: 'Sincronización carburadores', duracion_min: 75, precio: 95 }
            ]
        }
    ];
}

function getMockSucursalDetail(id) {
    const mockData = getMockSearchResults();
    const sucursal = mockData.find(s => s.id_sucursal === parseInt(id)) || mockData[0];

    return {
        ...sucursal,
        descripcion: 'Taller especializado con más de 15 años de experiencia en el sector. Contamos con mecánicos certificados y equipamiento de última generación.',
        horario: 'L-V: 09:00-20:00, S: 09:00-14:00',
        telefono: '+34 91 123 45 67',
        email: 'info@taller.com',
        servicios_completos: [
            { id: 1, nombre: 'Cambio de aceite', duracion_min: 30, precio: 45, categoria: 'Mantenimiento' },
            { id: 2, nombre: 'Revisión frenos', duracion_min: 45, precio: 65, categoria: 'Frenos' },
            { id: 3, nombre: 'ITV pre-revisión', duracion_min: 60, precio: 40, categoria: 'ITV' },
            { id: 4, nombre: 'Cambio neumáticos', duracion_min: 60, precio: 120, categoria: 'Neumáticos' },
            { id: 5, nombre: 'Diagnóstico electrónico', duracion_min: 45, precio: 55, categoria: 'Diagnóstico' },
            { id: 6, nombre: 'Mantenimiento general', duracion_min: 120, precio: 150, categoria: 'Mantenimiento' }
        ],
        ofertas: sucursal.tiene_oferta ? [
            {
                id: 1,
                titulo: '20% descuento en cambio de aceite',
                descripcion: 'Válido hasta fin de mes',
                descuento: 20,
                validez: '31/12/2025'
            }
        ] : [],
        resenas: [
            {
                id: 1,
                cliente: 'Juan M.',
                rating: 5,
                fecha: '2025-12-15',
                comentario: 'Excelente servicio, muy profesionales y rápidos. Totalmente recomendable.'
            },
            {
                id: 2,
                cliente: 'María G.',
                rating: 4,
                fecha: '2025-12-10',
                comentario: 'Buena atención, aunque tuve que esperar un poco más de lo esperado.'
            },
            {
                id: 3,
                cliente: 'Carlos R.',
                rating: 5,
                fecha: '2025-12-05',
                comentario: 'Calidad-precio inmejorable. Volveré sin duda.'
            }
        ]
    };
}

function getMockAvailability(fecha) {
    return [
        { hora: '09:00', disponible: true },
        { hora: '10:00', disponible: true },
        { hora: '11:00', disponible: false },
        { hora: '12:00', disponible: true },
        { hora: '14:00', disponible: true },
        { hora: '15:00', disponible: false },
        { hora: '16:00', disponible: true },
        { hora: '17:00', disponible: true },
        { hora: '18:00', disponible: true },
        { hora: '19:00', disponible: false }
    ];
}

export default {
    searchMarketplace,
    getSucursalDetail,
    getAvailability,
    bookAppointment
};
