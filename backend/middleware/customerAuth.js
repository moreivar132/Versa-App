/**
 * VERSA - PASO 5: Portal Cliente
 * Middleware de autenticación para clientes finales
 * Separado del auth de staff/manager
 */

const jwt = require('jsonwebtoken');

const CUSTOMER_JWT_SECRET = process.env.CUSTOMER_JWT_SECRET || process.env.JWT_SECRET || 'versa_customer_secret_key_2024';

/**
 * Middleware que verifica el token JWT del cliente
 * Token debe venir en header: Authorization: Bearer <token>
 */
function customerAuth(req, res, next) {
    try {
        // Obtener token del header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                ok: false,
                error: 'Token de autenticación requerido'
            });
        }

        const token = authHeader.split(' ')[1];

        // Verificar token
        const decoded = jwt.verify(token, CUSTOMER_JWT_SECRET);

        // Validar que sea token de cliente (no staff)
        if (decoded.type !== 'customer') {
            return res.status(401).json({
                ok: false,
                error: 'Token inválido para portal cliente'
            });
        }

        // Adjuntar info del cliente al request
        req.customer = {
            id: decoded.id,              // clientefinal_auth.id
            id_cliente: decoded.id_cliente,  // clientefinal.id
            email: decoded.email
        };

        next();
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                ok: false,
                error: 'Token expirado',
                code: 'TOKEN_EXPIRED'
            });
        }

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                ok: false,
                error: 'Token inválido'
            });
        }

        console.error('Error en customerAuth:', error);
        return res.status(500).json({
            ok: false,
            error: 'Error de autenticación'
        });
    }
}

/**
 * Middleware opcional: extrae info del cliente si hay token, pero no bloquea si no hay
 * Útil para endpoints que funcionan con y sin login (ej: booking)
 */
function customerAuthOptional(req, res, next) {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            req.customer = null;
            return next();
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, CUSTOMER_JWT_SECRET);

        if (decoded.type === 'customer') {
            req.customer = {
                id: decoded.id,
                id_cliente: decoded.id_cliente,
                email: decoded.email
            };
        } else {
            req.customer = null;
        }

        next();
    } catch (error) {
        // En modo opcional, ignoramos errores de token
        req.customer = null;
        next();
    }
}

/**
 * Genera un token JWT para un cliente
 */
function generateCustomerToken(customerAuth) {
    return jwt.sign(
        {
            id: customerAuth.id,
            id_cliente: customerAuth.id_cliente,
            email: customerAuth.email,
            type: 'customer'
        },
        CUSTOMER_JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = {
    customerAuth,
    customerAuthOptional,
    generateCustomerToken,
    CUSTOMER_JWT_SECRET
};
