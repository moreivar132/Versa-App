/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
    // 1. ALTER bank_account
    // Make bank_connection_id nullable to support manual imports (which have no connection)
    await knex.schema.alterTable('bank_account', (table) => {
        table.uuid('bank_connection_id').nullable().alter();
        // Add source column if not exists
        table.text('source').defaultTo('manual');
    });

    // 2. ALTER bank_transaction
    // Ensure we can store manual import data
    await knex.schema.alterTable('bank_transaction', (table) => {
        // Add source column
        table.text('source').defaultTo('manual_import');
    });

    // 3. Import: bank_import (New Table)
    await knex.schema.createTable('bank_import', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.integer('tenant_id').notNullable();
        table.bigInteger('created_by_user_id').notNullable();
        table.text('status').notNullable();
        table.text('filename').notNullable();
        table.text('file_mime').notNullable();
        table.integer('file_size').notNullable();
        table.text('file_sha256').notNullable();
        table.text('detected_format').nullable();
        table.uuid('bank_account_id').nullable();
        table.jsonb('mapping').nullable();
        table.jsonb('stats').nullable();
        table.text('error').nullable();
        table.timestamps(true, true);

        table.unique(['tenant_id', 'file_sha256']);
    });

    // 4. Import Staging: bank_import_row (New Table)
    await knex.schema.createTable('bank_import_row', (table) => {
        table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
        table.uuid('bank_import_id').notNullable().references('id').inTable('bank_import').onDelete('CASCADE');
        table.integer('row_number').notNullable();
        table.text('status').notNullable();
        table.jsonb('errors').nullable();
        table.jsonb('parsed').nullable();
        table.jsonb('raw').nullable();

        table.index(['bank_import_id', 'row_number']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
    await knex.schema.dropTableIfExists('bank_import_row');
    await knex.schema.dropTableIfExists('bank_import');

    // We do not revert alterations to bank_account/transaction to avoid data loss or complexity
};
