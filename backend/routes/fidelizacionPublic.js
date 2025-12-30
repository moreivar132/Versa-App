/**
 * Rutas públicas de Fidelización
 * Acceso sin autenticación para la tarjeta wallet del cliente
 */

const express = require('express');
const router = express.Router();
const fidelizacionService = require('../services/fidelizacionService');

// Simple rate limiting map (en producción usar Redis)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minuto
const RATE_LIMIT_MAX_REQUESTS = 30; // máximo 30 requests por minuto por token

function checkRateLimit(token) {
    const now = Date.now();
    const key = token.slice(0, 8); // Usar primeros 8 chars como key

    if (!rateLimitMap.has(key)) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }

    const limit = rateLimitMap.get(key);

    if (now > limit.resetAt) {
        rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (limit.count >= RATE_LIMIT_MAX_REQUESTS) {
        return false;
    }

    limit.count++;
    return true;
}

// Limpiar rate limit map cada 5 minutos
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap) {
        if (now > value.resetAt) {
            rateLimitMap.delete(key);
        }
    }
}, 300000);

/**
 * GET /api/public/fidelizacion/card
 * Obtener datos de la tarjeta pública
 * Query: ?token=...
 */
router.get('/card', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                ok: false,
                error: 'Token requerido'
            });
        }

        if (!checkRateLimit(token)) {
            return res.status(429).json({
                ok: false,
                error: 'Demasiadas peticiones. Intenta de nuevo en un minuto.'
            });
        }

        const cardData = await fidelizacionService.getCardData(token);

        if (!cardData) {
            return res.status(404).json({
                ok: false,
                error: 'Tarjeta no encontrada'
            });
        }

        if (cardData.estado === 'blocked') {
            return res.status(403).json({
                ok: false,
                error: 'Esta tarjeta ha sido bloqueada'
            });
        }

        res.json({
            ok: true,
            data: {
                display_name: cardData.display_name,
                points_balance: cardData.points_balance,
                points_label: cardData.points_label,
                program_name: cardData.program_name,
                member_code: cardData.member_code,
                promo_activa: cardData.promo_activa,
                qr_refresh_seconds: cardData.qr_refresh_seconds,
                brand: {
                    logo: 'https://i.imgur.com/Mjw4or5.png',
                    primary_color: '#ff4400',
                    background_color: '#1a1a1a'
                }
            },
            // Datos internos para generar QR (no expuestos al cliente directamente)
            _internal: {
                id_miembro: cardData.id_miembro,
                id_tenant: cardData.id_tenant
            }
        });

    } catch (error) {
        console.error('Error en GET /api/public/fidelizacion/card:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al obtener datos de la tarjeta'
        });
    }
});

/**
 * POST /api/public/fidelizacion/qr
 * Generar QR dinámico para la tarjeta
 * Query: ?token=...
 */
router.post('/qr', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                ok: false,
                error: 'Token requerido'
            });
        }

        if (!checkRateLimit(token)) {
            return res.status(429).json({
                ok: false,
                error: 'Demasiadas peticiones. Intenta de nuevo en un minuto.'
            });
        }

        // Validar token y obtener datos del miembro
        const cardData = await fidelizacionService.getCardData(token);

        if (!cardData) {
            return res.status(404).json({
                ok: false,
                error: 'Tarjeta no encontrada'
            });
        }

        if (cardData.estado === 'blocked') {
            return res.status(403).json({
                ok: false,
                error: 'Esta tarjeta ha sido bloqueada'
            });
        }

        // Generar sesión de QR
        const qrSession = await fidelizacionService.generateQRSession(
            cardData.id_miembro,
            cardData.id_tenant
        );

        res.json({
            ok: true,
            data: {
                qr_payload: qrSession.qr_payload,
                expires_at: qrSession.expires_at,
                expires_unix: qrSession.expires_unix
            }
        });

    } catch (error) {
        console.error('Error en POST /api/public/fidelizacion/qr:', error);
        res.status(500).json({
            ok: false,
            error: 'Error al generar QR'
        });
    }
});

module.exports = router;
