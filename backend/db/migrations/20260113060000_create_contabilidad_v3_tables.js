// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. This migration conflicts with baseline (contabilidad_contacto exists with different schema) and attempts to re-create existing tables (contabilidad_factura, trimestre).
// Evidence: contabilidad_contacto in baseline (line 315) without deleted_at.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
