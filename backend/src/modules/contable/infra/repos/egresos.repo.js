/**
 * Egresos Repository
 * Gestión de intakes de OCR y facturas de gasto
 */

const { getTenantDb } = require('../../../../core/db/tenant-db');

class EgresosRepository {

    /**
     * Crea un registro de intake para procesamiento OCR
     */
    async createIntake(ctx, data) {
        const db = getTenantDb(ctx);
        const {
            empresaId, idempotencyKey, fileData, categoriaUi, metodoPagoHint
        } = data;

        const result = await db.query(`
            INSERT INTO accounting_intake (
                id_tenant, id_empresa, created_by, idempotency_key, status, source,
                file_storage_key, file_url, file_mime, file_original_name, file_size_bytes,
                categoria_ui, metodo_pago_hint
            ) VALUES ($1, $2, $3, $4, 'processing', 'portal', $5, $6, $7, $8, $9, $10, $11)
            RETURNING id
        `, [
            ctx.tenantId, empresaId, ctx.userId, idempotencyKey,
            fileData.storage_key, fileData.url, fileData.mime, fileData.original_name, fileData.size,
            categoriaUi, metodoPagoHint
        ]);

        return result.rows[0].id;
    }

    /**
     * Actualiza el estado de un intake
     */
    async updateIntakeStatus(ctx, intakeId, data) {
        const db = getTenantDb(ctx);
        const { status, extractedJson, validationJson, errorMessage } = data;

        await db.query(`
            UPDATE accounting_intake 
            SET status = $1, 
                extracted_json = $2, 
                validation_json = $3, 
                error_message = $4,
                updated_at = NOW()
            WHERE id = $5 AND id_tenant = $6
        `, [
            status,
            extractedJson ? JSON.stringify(extractedJson) : null,
            validationJson ? JSON.stringify(validationJson) : null,
            errorMessage,
            intakeId,
            ctx.tenantId
        ]);
    }

    /**
     * Busca contacto por NIF
     */
    async findContactoByNif(ctx, nif) {
        const db = getTenantDb(ctx);
        const result = await db.query(
            `SELECT id FROM contabilidad_contacto WHERE id_tenant=$1 AND nif_cif=$2 AND deleted_at IS NULL LIMIT 1`,
            [ctx.tenantId, nif]
        );
        return result.rows[0]?.id;
    }

    /**
     * Busca intake por ID
     */
    async getIntakeById(ctx, id) {
        const db = getTenantDb(ctx);
        const result = await db.query(
            `SELECT * FROM accounting_intake WHERE id = $1 AND id_tenant = $2`,
            [id, ctx.tenantId]
        );
        return result.rows[0];
    }
}

module.exports = new EgresosRepository();
