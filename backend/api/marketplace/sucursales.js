/**
 * Marketplace Sucursales API Endpoint
 * GET /api/marketplace/sucursales
 * 
 * Retorna sucursales del tenant actual con coords normalizadas
 */

const express = require('express');
const router = express.Router();
const pool = require('../../db');

/**
 * Normaliza lat/lng a número o null
 */
function normalizeCoord(value) {
    if (value === null || value === undefined) return null;
    const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
    return Number.isFinite(n) ? n : null;
}

/**
 * GET /api/marketplace/sucursales
 * Lista sucursales del tenant para el selector de marketplace
 */
router.get('/', async (req, res) => {
    try {
        // En un escenario real, obtener tenant_id del contexto de autenticación
        // Por ahora, retornamos todas las sucursales activas con listings activos
        const query = `
      SELECT DISTINCT
        s.id,
        s.nombre,
        s.direccion,
        COALESCE(ml.lat, s.lat) as lat,
        COALESCE(ml.lng, s.lng) as lng,
        s.tenant_id
      FROM public.sucursal s
      LEFT JOIN public.marketplace_listing ml ON ml.id_sucursal = s.id AND ml.activo = true
      WHERE s.activa = true
      ORDER BY s.nombre ASC
      LIMIT 100
    `;

        const result = await pool.query(query);

        // Normalizar coordenadas
        const sucursales = (result.rows || []).map(row => ({
            id: row.id,
            nombre: row.nombre,
            direccion: row.direccion || null,
            lat: normalizeCoord(row.lat),
            lng: normalizeCoord(row.lng),
            tenant_id: row.tenant_id
        }));

        res.json(sucursales);

    } catch (error) {
        console.error('[API] GET /api/marketplace/sucursales error:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener sucursales',
            details: error.message
        });
    }
});

module.exports = router;
