/**
 * VERSA - Require Vertical Access Middleware
 * 
 * Middleware factory that validates access to a specific vertical (Manager/SaaS/Marketplace).
 * This is the first gate - if a user doesn't have access to the vertical, they cannot
 * access any endpoints within it.
 * 
 * Usage:
 *   router.use(requireVerticalAccess('manager'));
 *   // All routes after this require Manager vertical access
 */

const pool = require('../../../db');
const logger = require('../logging/logger');

/**
 * Check if user is super admin
 * @param {number} userId 
 * @returns {Promise<boolean>}
 */
async function isSuperAdmin(userId) {
    if (!userId) return false;
    const result = await pool.query(
        'SELECT is_super_admin FROM usuario WHERE id = $1',
        [userId]
    );
    return result.rows[0]?.is_super_admin === true;
}

/**
 * Check if tenant has access to a vertical
 * @param {number} tenantId 
 * @param {string} verticalKey 
 * @returns {Promise<{id: number, key: string, name: string, enabled: boolean} | null>}
 */
async function getTenantVerticalAccess(tenantId, verticalKey) {
    const result = await pool.query(`
        SELECT 
            v.id,
            v.key,
            v.name,
            COALESCE(tv.is_enabled, false) as enabled
        FROM vertical v
        LEFT JOIN tenant_vertical tv ON tv.vertical_id = v.id AND tv.tenant_id = $1
        WHERE v.key = $2 AND v.is_active = true
    `, [tenantId, verticalKey]);

    return result.rows[0] || null;
}

/**
 * Middleware factory for vertical access control
 * 
 * @param {string} verticalKey - The vertical to check access for ('manager' | 'saas' | 'marketplace')
 * @param {Object} options - Configuration options
 * @param {boolean} options.logOnly - If true, only log violations without blocking (for gradual rollout)
 * @returns {Function} Express middleware
 */
function requireVerticalAccess(verticalKey, options = {}) {
    const { logOnly = false } = options;

    return async (req, res, next) => {
        try {
            const userId = req.user?.id;

            // Must be authenticated
            if (!userId) {
                return res.status(401).json({
                    error: 'Autenticación requerida',
                    code: 'AUTH_REQUIRED'
                });
            }

            // Super admin bypass
            if (await isSuperAdmin(userId)) {
                req.isSuperAdmin = true;
                req.verticalKey = verticalKey;
                req.verticalAccess = { key: verticalKey, enabled: true, bypassed: true };
                return next();
            }

            // Get tenant ID from various sources
            const tenantId = req.user?.id_tenant
                || req.user?.tenant_id
                || req.headers['x-tenant-id']
                || req.query.tenantId;

            if (!tenantId) {
                return res.status(400).json({
                    error: 'Tenant no identificado',
                    code: 'TENANT_REQUIRED'
                });
            }

            // Check tenant's access to this vertical
            const verticalAccess = await getTenantVerticalAccess(tenantId, verticalKey);

            if (!verticalAccess) {
                // Vertical doesn't exist
                const message = `Vertical '${verticalKey}' no encontrada`;

                logger.warn({
                    userId,
                    tenantId,
                    verticalKey,
                    action: 'VERTICAL_NOT_FOUND',
                    path: req.path
                }, message);

                if (logOnly) {
                    req.verticalAccess = { key: verticalKey, enabled: false, wouldBlock: true };
                    return next();
                }

                return res.status(404).json({
                    error: message,
                    code: 'VERTICAL_NOT_FOUND'
                });
            }

            if (!verticalAccess.enabled) {
                // Tenant doesn't have this vertical enabled
                const message = `Tu plan no incluye acceso a ${verticalAccess.name}`;

                logger.warn({
                    userId,
                    tenantId,
                    verticalKey,
                    verticalName: verticalAccess.name,
                    action: 'VERTICAL_ACCESS_DENIED',
                    path: req.path
                }, message);

                if (logOnly) {
                    req.verticalAccess = {
                        key: verticalKey,
                        name: verticalAccess.name,
                        enabled: false,
                        wouldBlock: true
                    };
                    return next();
                }

                return res.status(403).json({
                    error: message,
                    code: 'VERTICAL_NOT_ENABLED',
                    vertical: verticalKey,
                    verticalName: verticalAccess.name,
                    upgrade: true
                });
            }

            // Access granted - attach context to request
            req.verticalKey = verticalKey;
            req.verticalId = verticalAccess.id;
            req.verticalAccess = {
                id: verticalAccess.id,
                key: verticalAccess.key,
                name: verticalAccess.name,
                enabled: true
            };

            next();

        } catch (error) {
            logger.error({
                error: error.message,
                stack: error.stack,
                userId: req.user?.id,
                verticalKey,
                path: req.path
            }, 'Error in requireVerticalAccess middleware');

            res.status(500).json({
                error: 'Error verificando acceso a vertical',
                code: 'VERTICAL_CHECK_ERROR'
            });
        }
    };
}

/**
 * Get all verticals accessible by a user in a tenant context
 * 
 * @param {number} userId 
 * @param {number} tenantId 
 * @returns {Promise<Array<{id: number, key: string, name: string, enabled: boolean}>>}
 */
async function getUserAccessibleVerticals(userId, tenantId) {
    // Super admin gets all active verticals
    if (await isSuperAdmin(userId)) {
        const result = await pool.query(`
            SELECT id, key, name, true as enabled, icon
            FROM vertical
            WHERE is_active = true
            ORDER BY display_order
        `);
        return result.rows;
    }

    // Regular users get tenant's enabled verticals
    const result = await pool.query(`
        SELECT 
            v.id,
            v.key,
            v.name,
            v.icon,
            COALESCE(tv.is_enabled, false) as enabled
        FROM vertical v
        LEFT JOIN tenant_vertical tv ON tv.vertical_id = v.id AND tv.tenant_id = $1
        WHERE v.is_active = true
        ORDER BY v.display_order
    `, [tenantId]);

    return result.rows;
}

/**
 * Quick check if user can access a vertical (without middleware context)
 * 
 * @param {number} userId 
 * @param {number} tenantId 
 * @param {string} verticalKey 
 * @returns {Promise<boolean>}
 */
async function canAccessVertical(userId, tenantId, verticalKey) {
    if (await isSuperAdmin(userId)) {
        return true;
    }

    const result = await pool.query(`
        SELECT user_can_access_vertical($1, $2, $3) as can_access
    `, [userId, tenantId, verticalKey]);

    return result.rows[0]?.can_access === true;
}

module.exports = {
    requireVerticalAccess,
    getUserAccessibleVerticals,
    canAccessVertical,
    getTenantVerticalAccess,
    isSuperAdmin
};
