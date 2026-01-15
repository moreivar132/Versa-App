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
 * 
 * Si hay usuario autenticado (req.user.tenant_id), filtra por tenant.
 * Si es acceso público, retorna todas las sucursales activas.
 */
router.get('/', async (req, res) => {
    try {
        // Obtener tenant_id del contexto de autenticación (si existe)
        const tenantId = req.user?.tenant_id || req.user?.id_tenant || null;

        // Construir query con filtro opcional de tenant
        const params = [];
        let tenantFilter = '';

        if (tenantId) {
            params.push(tenantId);
            tenantFilter = `AND s.tenant_id = $${params.length}`;
            console.log(`[Marketplace/sucursales] Filtrando por tenant_id=${tenantId}`);
        }

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
      WHERE s.activa = true ${tenantFilter}
      ORDER BY s.nombre ASC
      LIMIT 100
    `;

        const result = await pool.query(query, params);

        // Normalizar coordenadas y contar sucursales sin coords para observabilidad
        let sucursalesSinCoords = 0;
        const sucursales = (result.rows || []).map(row => {
            const lat = normalizeCoord(row.lat);
            const lng = normalizeCoord(row.lng);

            if (lat === null || lng === null) {
                sucursalesSinCoords++;
            }

            return {
                id: row.id,
                nombre: row.nombre,
                direccion: row.direccion || null,
                lat,
                lng,
                tenant_id: row.tenant_id
            };
        });

        // Log observabilidad: sucursales sin coordenadas
        if (sucursalesSinCoords > 0) {
            console.warn(`[Marketplace/sucursales] ${sucursalesSinCoords}/${sucursales.length} sucursales sin coordenadas válidas${tenantId ? ` (tenant=${tenantId})` : ''}`);
        }

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
