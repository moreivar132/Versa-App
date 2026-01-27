/**
 * Audit Service (B2B Compliance)
 * Registry for all sensitive actions in the system.
 */

const { getTenantDb, getSystemDb } = require('../db/tenant-db');

/**
 * Log action constants for business logic
 */
const AUDIT_ACTIONS = {
    // Security & Access
    SECURITY_BYPASS: 'SECURITY.BYPASS',
    AUTH_LOGIN: 'AUTH.LOGIN',
    AUTH_LOGOUT: 'AUTH.LOGOUT',
    AUTH_REGISTER: 'AUTH.REGISTER',

    // Contabilidad (FinSaaS)
    FACTURA_CREATE: 'FINSAAS.FACTURA.CREATE',
    FACTURA_UPDATE: 'FINSAAS.FACTURA.UPDATE',
    FACTURA_DELETE: 'FINSAAS.FACTURA.DELETE',
    FACTURA_DEDUCIBLE_APPROVE: 'FINSAAS.FACTURA.APPROVE',
    CONTACTO_CREATE: 'FINSAAS.CONTACTO.CREATE',
    CONTACTO_UPDATE: 'FINSAAS.CONTACTO.UPDATE',
    CONTACTO_DELETE: 'FINSAAS.CONTACTO.DELETE',

    // Manager (Taller)
    ORDEN_CREATE: 'MANAGER.ORDEN.CREATE',
    ORDEN_UPDATE: 'MANAGER.ORDEN.UPDATE',
    ORDEN_STATUS_CHANGE: 'MANAGER.ORDEN.STATUS_CHANGE',
    CAJA_OPEN: 'MANAGER.CAJA.OPEN',
    CAJA_CLOSE: 'MANAGER.CAJA.CLOSE',
    CAJA_MOVIMIENTO: 'MANAGER.CAJA.MOVIMIENTO',

    // Banking
    BANKING_LINK_INITIATE: 'BANKING.LINK.INITIATE',
    BANKING_LINK_SUCCESS: 'BANKING.LINK.SUCCESS',
    BANKING_LINK_ERROR: 'BANKING.LINK.ERROR',
    BANKING_SYNC: 'BANKING.SYNC',
    BANKING_ACCOUNT_CREATE: 'BANKING.ACCOUNT.CREATE',
    BANKING_RECONCILE: 'BANKING.RECONCILE',

    // Admin & Users
    USER_CREATE: 'ADMIN.USER.CREATE',
    USER_UPDATE: 'ADMIN.USER.UPDATE',
    USER_ROLE_CHANGE: 'ADMIN.USER.ROLE_CHANGE'
};

/**
 * Core logging function
 */
async function logAudit({
    userId,
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
        // Use system DB for audit to ensuring it logs even if tenant RLS is restrictive
        const db = getSystemDb();

        await db.query(`
            INSERT INTO audit_logs 
            (user_id, tenant_id, action, entity_type, entity_id, before_json, after_json, ip_address, user_agent)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [
            userId,
            tenantId,
            action,
            entityType,
            String(entityId),
            before ? (typeof before === 'object' ? JSON.stringify(before) : before) : null,
            after ? (typeof after === 'object' ? JSON.stringify(after) : after) : null,
            ipAddress,
            userAgent
        ]);
    } catch (error) {
        console.error('[AuditService] Error recording audit log:', error.message);
        // We don't throw to avoid breaking the main transaction, 
        // but in some high-compliance environments this should be handled differently.
    }
}

/**
 * High-level helper for controllers
 */
async function register(req, action, details = {}) {
    const { entityType, entityId, before, after } = details;

    return logAudit({
        userId: req.user?.id,
        tenantId: req.user?.id_tenant || req.tenantId,
        ipAddress: req.ip || req.headers['x-forwarded-for'] || req.connection?.remoteAddress,
        userAgent: req.headers['user-agent'],
        action,
        entityType,
        entityId,
        before,
        after
    });
}

/**
 * Search logs
 */
async function queryLogs(filters = {}) {
    const { tenantId, userId, entityType, action, limit = 50, offset = 0 } = filters;
    const db = getSystemDb();

    let sql = `
        SELECT al.*, u.nombre as user_name, u.email as user_email
        FROM audit_logs al
        LEFT JOIN usuario u ON al.user_id = u.id
        WHERE 1=1
    `;
    const params = [];

    if (tenantId) {
        params.push(tenantId);
        sql += ` AND al.tenant_id = $${params.length}`;
    }
    if (userId) {
        params.push(userId);
        sql += ` AND al.user_id = $${params.length}`;
    }
    if (entityType) {
        params.push(entityType);
        sql += ` AND al.entity_type = $${params.length}`;
    }

    sql += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(sql, params);
    return result.rows;
}

module.exports = {
    AUDIT_ACTIONS,
    logAudit,
    register,
    queryLogs
};
