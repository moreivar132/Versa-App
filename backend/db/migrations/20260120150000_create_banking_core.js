// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. This migration depends on neutralized zombie migration (create_open_banking_tables) and references non-existent columns (bank_connection_id).
// Evidence: bank_account in baseline (line 208) uses connection_id, not bank_connection_id.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
