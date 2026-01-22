/**
 * Audit Service
 * Logs access-related changes for compliance and security
 */

const { getTenantDb, getSystemDb } = require('../src/core/db/tenant-db');

/**
 * Log an audit event
 * ... (params omitted)
 */
async function logAudit({
    actorUserId,
    tenantId = null,
    action,
    entityType,
    entityId,
    before = null,
    after = null,
    ipAddress = null,
    userAgent = null
}) {
    try {
        const db = tenantId ? getTenantDb({ tenantId }) : getSystemDb();
        await db.query(`
            INSERT INTO audit_logs 
            (actor_user_id, tenant_id, action, entity_type, entity_id, before_json, after_json, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            actorUserId,
            tenantId,
            action,
            entityType,
            String(entityId),
            before ? JSON.stringify(before) : null,
            after ? JSON.stringify(after) : null,
            ipAddress,
            userAgent
        ]);
    } catch (error) {
        // Log error but don't fail the main operation
        console.error('Audit log error:', error.message);
    }
}

/**
 * Get audit logs with filters
 */
async function getAuditLogs({
    tenantId = null,
    actorUserId = null,
    entityType = null,
    action = null,
    startDate = null,
    endDate = null,
    limit = 100,
    offset = 0
}) {
    let query = `
        SELECT 
            al.*,
            u.nombre as actor_name,
            u.email as actor_email
        FROM audit_logs al
        LEFT JOIN usuario u ON al.actor_user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (tenantId) {
        params.push(tenantId);
        query += ` AND al.tenant_id = $${params.length}`;
    }

    if (actorUserId) {
        params.push(actorUserId);
        query += ` AND al.actor_user_id = $${params.length}`;
    }

    if (entityType) {
        params.push(entityType);
        query += ` AND al.entity_type = $${params.length}`;
    }

    if (action) {
        params.push(`%${action}%`);
        query += ` AND al.action LIKE $${params.length}`;
    }

    if (startDate) {
        params.push(startDate);
        query += ` AND al.created_at >= $${params.length}`;
    }

    if (endDate) {
        params.push(endDate);
        query += ` AND al.created_at <= $${params.length}`;
    }

    query += ` ORDER BY al.created_at DESC`;

    params.push(limit);
    query += ` LIMIT $${params.length}`;

    params.push(offset);
    query += ` OFFSET $${params.length}`;

    const db = tenantId ? getTenantDb({ tenantId }) : getSystemDb();
    const result = await db.query(query, params);
    return result.rows;
}

/**
 * Helper to extract request context for audit
 */
function getAuditContext(req) {
    return {
        actorUserId: req.user?.id,
        tenantId: req.user?.id_tenant,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent']
    };
}

// Common audit action constants
const AUDIT_ACTIONS = {
    // User actions
    USER_CREATE: 'access.user.create',
    USER_UPDATE: 'access.user.update',
    USER_DELETE: 'access.user.delete',
    USER_ROLE_ASSIGN: 'access.user.role_assign',
    USER_SUCURSAL_ASSIGN: 'access.user.sucursal_assign',

    // Role actions
    ROLE_CREATE: 'access.role.create',
    ROLE_UPDATE: 'access.role.update',
    ROLE_DELETE: 'access.role.delete',
    ROLE_PERMISSION_ASSIGN: 'access.role.permission_assign',

    // Permission actions (rarely used)
    PERMISSION_CREATE: 'access.permission.create',
    PERMISSION_UPDATE: 'access.permission.update',
    PERMISSION_DELETE: 'access.permission.delete'
};

module.exports = {
    logAudit,
    getAuditLogs,
    getAuditContext,
    AUDIT_ACTIONS
};
