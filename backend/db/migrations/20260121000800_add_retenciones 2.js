// ZOMBIE MIGRATION — NO-OP
// Reason: duplicate functionality cleanup. Overlaps with 20260115000002_alter_factura_fiscal.js (withholding/retention fields).
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
