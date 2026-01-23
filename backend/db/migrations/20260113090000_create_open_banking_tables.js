// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. This migration conflicts with baseline (accounting_category, bank_connection exist with 'id_tenant' vs 'tenant_id') and attempts to create indices on non-existent columns.
// Evidence: accounting_category in baseline (line 75) uses id_tenant.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
