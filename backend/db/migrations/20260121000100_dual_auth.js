// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. This migration attempts to alter a non-existent table (clientefinal_auth) which is created in a later migration (or missing from baseline).
// Evidence: clientefinal_auth not in baseline, and referenced before creation.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
