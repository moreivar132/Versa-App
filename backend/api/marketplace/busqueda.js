/**
 * Marketplace Busqueda API Endpoint
 * GET /api/marketplace/busqueda
 * 
 * Búsqueda de items con coords normalizadas
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
 * GET /api/marketplace/busqueda
 * Buscar items en marketplace con filtros
 * 
 * Query params:
 * - q: búsqueda de texto
 * - sucursal_id: filtrar por sucursal
 * - categoria: filtrar por categoría
 * - estado: filtrar por estado (default: 'activo')
 * - limit: límite de resultados (default: 50)
 * - offset: offset para paginación (default: 0)
 */
router.get('/', async (req, res) => {
    try {
        const {
            q = '',
            sucursal_id = null,
            categoria = null,
            estado = 'activo',
            limit = '50',
            offset = '0'
        } = req.query;

        // Validación de parámetros
        const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 100);
        const offsetNum = Math.max(parseInt(offset) || 0, 0);

        // Validar estado permitido
        const estadosPermitidos = ['activo', 'inactivo', 'todos'];
        const estadoNorm = estadosPermitidos.includes(estado) ? estado : 'activo';

        // Obtener tenant_id del contexto de autenticación (si existe)
        const tenantId = req.user?.tenant_id || req.user?.id_tenant || null;

        // Construir query dinámica
        const params = [];
        let whereClause = 'WHERE 1=1';

        // Filtrar por tenant (si está autenticado)
        if (tenantId) {
            params.push(tenantId);
            whereClause += ` AND s.tenant_id = $${params.length}`;
        }

        // Filtrar por estado activo
        if (estadoNorm === 'activo') {
            whereClause += ` AND ml.activo = true AND s.activa = true`;
        } else if (estadoNorm === 'inactivo') {
            whereClause += ` AND (ml.activo = false OR s.activa = false)`;
        }

        // Filtrar por sucursal
        if (sucursal_id) {
            params.push(sucursal_id);
            whereClause += ` AND s.id = $${params.length}`;
        }

        // Búsqueda de texto
        if (q && q.trim()) {
            params.push(`%${q.trim().toLowerCase()}%`);
            whereClause += ` AND (
        LOWER(s.nombre) LIKE $${params.length} OR
        LOWER(ml.titulo_publico) LIKE $${params.length} OR
        LOWER(s.direccion) LIKE $${params.length}
      )`;
        }

        // Query principal
        const query = `
      SELECT 
        ml.id,
        ml.id_sucursal,
        s.nombre as sucursal_nombre,
        COALESCE(ml.titulo_publico, s.nombre) as nombre,
        s.direccion,
        COALESCE(ml.lat, s.lat) as lat,
        COALESCE(ml.lng, s.lng) as lng,
        ml.rating,
        ml.reviews_count,
        ml.fotos_json,
        ml.activo
      FROM public.marketplace_listing ml
      JOIN public.sucursal s ON s.id = ml.id_sucursal
      ${whereClause}
      ORDER BY ml.rating DESC NULLS LAST, ml.reviews_count DESC NULLS LAST
      LIMIT ${limitNum}
      OFFSET ${offsetNum}
    `;

        // Query para total
        const countQuery = `
      SELECT COUNT(*) as total
      FROM public.marketplace_listing ml
      JOIN public.sucursal s ON s.id = ml.id_sucursal
      ${whereClause}
    `;

        const [itemsResult, countResult] = await Promise.all([
            pool.query(query, params),
            pool.query(countQuery, params)
        ]);

        // Normalizar resultados y tracking de observabilidad
        let itemsSinCoords = 0;
        let itemsCoordsHeredadas = 0;

        const items = (itemsResult.rows || []).map(row => {
            const lat = normalizeCoord(row.lat);
            const lng = normalizeCoord(row.lng);

            // Observabilidad: detectar items sin coords o con coords heredadas
            if (lat === null || lng === null) {
                itemsSinCoords++;
            }
            // Nota: no podemos distinguir heredadas vs propias sin campos adicionales

            return {
                id: row.id,
                id_sucursal: row.id_sucursal,
                sucursal_nombre: row.sucursal_nombre,
                nombre: row.nombre,
                titulo_publico: row.nombre,
                direccion: row.direccion || null,
                lat,
                lng,
                rating: parseFloat(row.rating) || null,
                reviews_count: parseInt(row.reviews_count) || 0,
                fotos_json: row.fotos_json,
                activo: row.activo
            };
        });

        const total = parseInt(countResult.rows?.[0]?.total) || 0;

        // Log observabilidad
        if (itemsSinCoords > 0) {
            console.warn(`[Marketplace/busqueda] ${itemsSinCoords}/${items.length} items sin coordenadas válidas${tenantId ? ` (tenant=${tenantId})` : ''} [q=${q || '*'}]`);
        }

        res.json({
            ok: true,
            items,
            total,
            limit: limitNum,
            offset: offsetNum
        });

    } catch (error) {
        console.error('[API] GET /api/marketplace/busqueda error:', error);
        res.status(500).json({
            ok: false,
            error: 'Error en búsqueda',
            items: [],
            total: 0
        });
    }
});

module.exports = router;
