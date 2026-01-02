/**
 * Servicio para administración del Marketplace
 * Utiliza los endpoints /api/marketplace/admin/*
 */

import api from './api-client.js';

export async function getListingBySucursal(idSucursal) {
    try {
        const response = await api.get(`/api/marketplace/admin/listing?id_sucursal=${idSucursal}`);
        return response.data;
    } catch (error) {
        console.error('Error obteniendo listing:', error);
        // Si no existe, retornar estructura vacía
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
}

export async function updateListing(listingData) {
    try {
        const response = await api.put('/api/marketplace/admin/listing', listingData);
        return response.data;
    } catch (error) {
        console.error('Error actualizando listing:', error);
        throw error;
    }
}

export async function getServiciosCatalogo() {
    try {
        const response = await api.get('/api/marketplace/admin/servicios-catalogo');
        return response.data;
    } catch (error) {
        console.error('Error obteniendo catálogo:', error);
        throw error;
    }
}

export async function updateServicioSucursal(servicioData) {
    try {
        const response = await api.post('/api/marketplace/admin/servicios', servicioData);
        return response.data;
    } catch (error) {
        console.error('Error actualizando servicio:', error);
        throw error;
    }
}

export async function createPromocion(promoData) {
    try {
        const response = await api.post('/api/marketplace/admin/promociones', promoData);
        return response.data;
    } catch (error) {
        console.error('Error creando promoción:', error);
        throw error;
    }
}

export async function updateFotos(idSucursal, fotos) {
    try {
        const response = await api.post(`/api/marketplace/admin/listing/${idSucursal}/fotos`, { fotos });
        return response.data;
    } catch (error) {
        console.error('Error actualizando fotos:', error);
        throw error;
    }
}

// Obtener detalles publicos de la sucursal (para previsualización)
export async function getPublicSucursalDetail(idSucursal) {
    try {
        const response = await api.get(`/api/marketplace/sucursales/${idSucursal}`);
        return response.data;
    } catch (error) {
        console.error('Error obteniendo detalle público:', error);
        throw error;
    }
}

// Obtener servicios de una sucursal (admin)
export async function getServiciosBySucursal(idSucursal) {
    try {
        const response = await api.get(`/api/marketplace/admin/servicios/${idSucursal}`);
        return response.data;
    } catch (error) {
        // Si no hay servicios, retornar array vacío
        if (error.response?.status === 404) {
            return { ok: true, data: [] };
        }
        console.error('Error obteniendo servicios:', error);
        throw error;
    }
}

// Obtener promociones de una sucursal (admin)
export async function getPromocionesBySucursal(idSucursal) {
    try {
        const response = await api.get(`/api/marketplace/admin/promociones/${idSucursal}`);
        return response.data;
    } catch (error) {
        // Si no hay promociones, retornar array vacío
        if (error.response?.status === 404) {
            return { ok: true, data: [] };
        }
        console.error('Error obteniendo promociones:', error);
        throw error;
    }
}

// Obtener reseñas de una sucursal
export async function getResenasBySucursal(idSucursal) {
    try {
        // Usamos el endpoint público ya que contiene toda la info necesaria por ahora
        const response = await api.get(`/api/marketplace/sucursales/${idSucursal}/reviews`);
        return response.data;
    } catch (error) {
        console.error('Error obteniendo reseñas:', error);
        return { ok: true, data: [] };
    }
}
