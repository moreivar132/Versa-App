// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. This migration conflicts with baseline (cuentacorriente exists with different schema) and attempts to create tables (movimientocuenta) that depend on non-existent columns.
// Evidence: cuentacorriente in baseline (line 377) missing 'estado'.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
