
exports.up = async function (knex) {
    const hasTable = await knex.schema.hasTable('audit_logs');

    if (!hasTable) {
        return knex.schema.createTable('audit_logs', (table) => {
            table.increments('id').primary();
            table.integer('tenant_id').references('id').inTable('tenant').onDelete('CASCADE');
            table.integer('user_id').references('id').inTable('usuario').onDelete('SET NULL');
            table.string('action', 100).notNullable(); // 'CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'BYPASS_SECURITY'
            table.string('entity_type', 100); // 'FACTURA', 'ORDEN', 'CLIENTE'
            table.string('entity_id', 100);
            table.jsonb('before_json');
            table.jsonb('after_json');
            table.string('ip_address', 45);
            table.text('user_agent');
            table.timestamp('created_at').defaultTo(knex.fn.now());

            table.index(['tenant_id', 'created_at']);
            table.index(['entity_type', 'entity_id']);
            table.index('user_id');
        });
    } else {
        // Si existe, nos aseguramos de que tenga user_id (renombrando actor_user_id si existe)
        const hasActorId = await knex.schema.hasColumn('audit_logs', 'actor_user_id');
        const hasUserId = await knex.schema.hasColumn('audit_logs', 'user_id');

        return knex.schema.alterTable('audit_logs', (table) => {
            if (hasActorId && !hasUserId) {
                table.renameColumn('actor_user_id', 'user_id');
            } else if (!hasUserId) {
                table.integer('user_id').references('id').inTable('usuario').onDelete('SET NULL');
            }

            // Asegurar otras columnas del roadmap si faltan
            // (La tabla actual de Neon parece tener la mayoría, pero estandarizamos nombres)
        });
    }
};

exports.down = function (knex) {
    // Para el down, no borramos la tabla si ya existía para evitar pérdida de datos
    // Pero si queremos ser deterministas en el desarrollo:
    // return knex.schema.dropTableIfExists('audit_logs');
};
