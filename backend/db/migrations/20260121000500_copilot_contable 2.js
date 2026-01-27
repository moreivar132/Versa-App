// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. This migration attempts to insert permissions into 'permiso' table relying on a 'key' column.
// Evidence: Error 'column "key" does not exist' in migration log. The baseline 'permiso' table (Line 492) has columns (id, nombre, descripcion, created_at, id_tenant), but NO 'key' or 'module'.
// The 'create_rbac_tables' migration which likely added 'key' was neutralized.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
