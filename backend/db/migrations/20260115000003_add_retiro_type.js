// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. This migration attempts to drop a constraint (accounting_transaccion_tipo_check) that does not exist in the baseline schema.
// Evidence: accounting_transaccion in baseline (line 161) has no check constraint.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
