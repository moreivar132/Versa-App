// ZOMBIE MIGRATION — NO-OP
// Reason: redundancy/conflict cleanup. Baseline already handles contacts structure.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
