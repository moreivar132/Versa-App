// ZOMBIE MIGRATION — NO-OP
// Reason: redundancy/conflict cleanup. Table 'accounting_intake' already exists in baseline.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
