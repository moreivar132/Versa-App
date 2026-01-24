/**
 * VERSA - Income Service
 * Servicio centralizado para gestión del ledger de ingresos
 * 
 * Este servicio es la FUENTE DE VERDAD para todos los ingresos.
 * Tanto Marketplace como CRM emiten eventos hacia este ledger.
 */
const { getTenantDb } = require('../src/core/db/tenant-db');

class IncomeService {

    /**
     * Crear un evento de ingreso en el ledger
     * Incluye validación de idempotencia por reference
     * 
     * @param {Object} payload
     * @param {number} payload.idTenant - ID del tenant
     * ...
     */
    async createIncomeEvent(payload) {
        const {
            idTenant,
            idSucursal,
            origen,
            originType,
            originId = null,
            idCliente = null,
            amount,
            currency = 'EUR',
            status = 'paid',
            provider = 'internal',
            reference,
            metadata = null,
            description = null
        } = payload;

        // Validaciones básicas
        if (!idTenant || !idSucursal) {
            throw new Error('idTenant e idSucursal son obligatorios');
        }
        if (!['marketplace', 'crm', 'subscription', 'manual'].includes(origen)) {
            throw new Error(`Origen inválido: ${origen}`);
        }
        if (!originType) {
            throw new Error('originType es obligatorio');
        }
        if (!reference) {
            throw new Error('reference es obligatorio para idempotencia');
        }
        if (amount === undefined || amount === null) {
            throw new Error('amount es obligatorio');
        }

        const db = getTenantDb({ tenantId: idTenant });

        try {
            // Intentar insertar con UPSERT para idempotencia
            const result = await db.query(`
                INSERT INTO income_event (
                    id_tenant, id_sucursal, origen, origin_type, origin_id,
                    id_cliente, amount, currency, status, provider,
                    reference, metadata, description
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                ON CONFLICT (id_tenant, reference) 
                DO UPDATE SET 
                    status = EXCLUDED.status,
                    updated_at = now()
                WHERE income_event.status != 'paid'  -- Solo actualizar si no está pagado
                RETURNING *
            `, [
                idTenant, idSucursal, origen, originType, originId,
                idCliente, amount, currency.toUpperCase(), status, provider,
                reference, metadata ? JSON.stringify(metadata) : null, description
            ]);

            const event = result.rows[0];

            console.log(`📊 Income Event ${event.id ? 'creado' : 'actualizado'}: ${origen}/${originType} - ${amount} ${currency} [${reference}]`);

            return {
                success: true,
                event,
                isNew: result.rowCount > 0
            };
        } catch (error) {
            console.error('❌ Error creando income_event:', error.message);
            throw error;
        }
    }

    /**
     * Obtener eventos de ingreso con filtros
     */
    async getIncomeEvents(filters) {
        const {
            idTenant,
            idSucursal,
            origen,
            status,
            dateFrom,
            dateTo,
            limit = 50,
            offset = 0
        } = filters;

        if (!idTenant) {
            throw new Error('idTenant es obligatorio');
        }

        const db = getTenantDb({ tenantId: idTenant });

        let whereClause = 'WHERE ie.id_tenant = $1';
        const params = [idTenant];
        let paramIndex = 2;

        if (idSucursal) {
            whereClause += ` AND ie.id_sucursal = $${paramIndex++}`;
            params.push(idSucursal);
        }
        if (origen) {
            whereClause += ` AND ie.origen = $${paramIndex++}`;
            params.push(origen);
        }
        if (status) {
            whereClause += ` AND ie.status = $${paramIndex++}`;
            params.push(status);
        }
        if (dateFrom) {
            whereClause += ` AND ie.created_at >= $${paramIndex++}::date`;
            params.push(dateFrom);
        }
        if (dateTo) {
            whereClause += ` AND ie.created_at < ($${paramIndex++}::date + interval '1 day')`;
            params.push(dateTo);
        }

        // Query principal con JOIN a sucursal
        const query = `
            SELECT 
                ie.*,
                s.nombre AS sucursal_nombre,
                cf.nombre AS cliente_nombre
            FROM income_event ie
            LEFT JOIN sucursal s ON ie.id_sucursal = s.id
            LEFT JOIN clientefinal cf ON ie.id_cliente = cf.id
            ${whereClause}
            ORDER BY ie.created_at DESC
            LIMIT $${paramIndex++} OFFSET $${paramIndex++}
        `;
        params.push(limit, offset);

        // Query de conteo
        const countQuery = `
            SELECT COUNT(*) as total
            FROM income_event ie
            ${whereClause}
        `;

        const [eventsResult, countResult] = await Promise.all([
            db.query(query, params),
            db.query(countQuery, params.slice(0, paramIndex - 2))
        ]);

        return {
            events: eventsResult.rows,
            total: parseInt(countResult.rows[0].total),
            pagination: {
                limit,
                offset,
                hasMore: offset + eventsResult.rows.length < parseInt(countResult.rows[0].total)
            }
        };
    }

    /**
     * Obtener reporte de ingresos agrupado
     */
    async getRevenueReport(options) {
        const {
            idTenant,
            idSucursal,
            dateFrom,
            dateTo,
            groupBy = 'origen'
        } = options;

        if (!idTenant) {
            throw new Error('idTenant es obligatorio');
        }

        const db = getTenantDb({ tenantId: idTenant });

        let whereClause = 'WHERE ie.id_tenant = $1 AND ie.status = \'paid\'';
        const params = [idTenant];
        let paramIndex = 2;

        if (idSucursal) {
            whereClause += ` AND ie.id_sucursal = $${paramIndex++}`;
            params.push(idSucursal);
        }
        if (dateFrom) {
            whereClause += ` AND ie.created_at >= $${paramIndex++}::date`;
            params.push(dateFrom);
        }
        if (dateTo) {
            whereClause += ` AND ie.created_at < ($${paramIndex++}::date + interval '1 day')`;
            params.push(dateTo);
        }

        // Definir la agrupación
        let groupByClause;
        let selectClause;
        switch (groupBy) {
            case 'sucursal':
                groupByClause = 'ie.id_sucursal, s.nombre';
                selectClause = 'ie.id_sucursal, s.nombre AS sucursal_nombre';
                break;
            case 'day':
                groupByClause = 'DATE_TRUNC(\'day\', ie.created_at)';
                selectClause = 'DATE_TRUNC(\'day\', ie.created_at) AS fecha';
                break;
            case 'month':
                groupByClause = 'DATE_TRUNC(\'month\', ie.created_at)';
                selectClause = 'DATE_TRUNC(\'month\', ie.created_at) AS mes';
                break;
            case 'origen':
            default:
                groupByClause = 'ie.origen';
                selectClause = 'ie.origen';
                break;
        }

        // Query de reporte
        const query = `
            SELECT 
                ${selectClause},
                COUNT(*) AS num_eventos,
                SUM(ie.amount) AS total_amount,
                AVG(ie.amount) AS avg_amount,
                MIN(ie.amount) AS min_amount,
                MAX(ie.amount) AS max_amount
            FROM income_event ie
            LEFT JOIN sucursal s ON ie.id_sucursal = s.id
            ${whereClause}
            GROUP BY ${groupByClause}
            ORDER BY total_amount DESC
        `;

        // Query de totales globales
        const totalsQuery = `
            SELECT 
                COUNT(*) AS total_eventos,
                COALESCE(SUM(ie.amount), 0) AS total_general,
                COALESCE(SUM(CASE WHEN ie.origen = 'marketplace' THEN ie.amount ELSE 0 END), 0) AS total_marketplace,
                COALESCE(SUM(CASE WHEN ie.origen = 'crm' THEN ie.amount ELSE 0 END), 0) AS total_crm,
                COALESCE(SUM(CASE WHEN ie.origen = 'subscription' THEN ie.amount ELSE 0 END), 0) AS total_subscription,
                COALESCE(SUM(CASE WHEN ie.origen = 'manual' THEN ie.amount ELSE 0 END), 0) AS total_manual
            FROM income_event ie
            ${whereClause}
        `;

        const [reportResult, totalsResult] = await Promise.all([
            db.query(query, params),
            db.query(totalsQuery, params)
        ]);

        return {
            groupBy,
            data: reportResult.rows.map(row => ({
                ...row,
                total_amount: parseFloat(row.total_amount) || 0,
                avg_amount: parseFloat(row.avg_amount) || 0,
                num_eventos: parseInt(row.num_eventos)
            })),
            totals: {
                total_eventos: parseInt(totalsResult.rows[0].total_eventos),
                total_general: parseFloat(totalsResult.rows[0].total_general) || 0,
                por_origen: {
                    marketplace: parseFloat(totalsResult.rows[0].total_marketplace) || 0,
                    crm: parseFloat(totalsResult.rows[0].total_crm) || 0,
                    subscription: parseFloat(totalsResult.rows[0].total_subscription) || 0,
                    manual: parseFloat(totalsResult.rows[0].total_manual) || 0
                }
            },
            filters: {
                idTenant,
                idSucursal,
                dateFrom,
                dateTo
            }
        };
    }

    /**
     * Generar reference única para una entidad
     */
    generateReference(type, id, suffix = null) {
        const parts = [type, id];
        if (suffix) parts.push(suffix);
        return parts.join(':');
    }

    /**
     * Verificar si un evento ya existe por reference
     */
    async checkExistingEvent(idTenant, reference) {
        const db = getTenantDb({ tenantId: idTenant });
        const result = await db.query(
            'SELECT * FROM income_event WHERE id_tenant = $1 AND reference = $2',
            [idTenant, reference]
        );
        return result.rows[0] || null;
    }

    /**
     * Marcar un evento como reembolsado
     */
    async markAsRefunded(idTenant, reference, metadata = null) {
        const db = getTenantDb({ tenantId: idTenant });
        const result = await db.query(`
            UPDATE income_event 
            SET status = 'refunded', 
                updated_at = now(),
                metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
            WHERE id_tenant = $1 AND reference = $2
            RETURNING *
        `, [idTenant, reference, JSON.stringify(metadata || { refunded_at: new Date().toISOString() })]);

        if (result.rows.length === 0) {
            throw new Error(`Evento no encontrado: ${reference}`);
        }

        console.log(`🔄 Income Event refunded: ${reference}`);
        return result.rows[0];
    }
}

module.exports = new IncomeService();
