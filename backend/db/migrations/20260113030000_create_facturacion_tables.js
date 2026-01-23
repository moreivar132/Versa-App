// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. Tables 'contabilidad_factura' and related logic already exist in baseline (newer version of schema).
// Evidence: baseline schema dump lines 327+ (contabilidad_factura).
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
