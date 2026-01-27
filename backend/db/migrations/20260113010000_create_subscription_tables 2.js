// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. Tables 'plan_suscripcion' and 'tenant_suscripcion' already exist in baseline schema.
// Evidence: baseline schema dump lines 500+ and 631+.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
