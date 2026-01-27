// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. Tables 'caja' and 'movimientocaja' already exist in baseline schema.
// Evidence: baseline schema dump lines 258+ and 433+.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
