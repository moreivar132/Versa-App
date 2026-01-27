// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. This migration conflicts with baseline (marketplace_listing exists with different schema) and attempts to create tables not present in the current schema dump (marketplace_servicio, promo, etc).
// Evidence: marketplace_listing in baseline (lines 413+), id_sucursal missing.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
