// ZOMBIE MIGRATION — NO-OP
// Reason: redundancy/conflict cleanup. Dependencies (marketplace tables) are neutralized.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
