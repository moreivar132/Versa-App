// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. Table 'facturaconfigtenant' does not exist in baseline schema.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
