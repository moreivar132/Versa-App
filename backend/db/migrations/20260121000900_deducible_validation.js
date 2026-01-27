// ZOMBIE MIGRATION — NO-OP
// Reason: redundancy/conflict cleanup. Table 'accounting_audit_log' and columns in 'contabilidad_factura' already exist or conflict with baseline.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
