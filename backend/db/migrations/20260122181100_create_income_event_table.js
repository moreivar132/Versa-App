// ZOMBIE MIGRATION — NO-OP
// Reason: Conflict with baseline schema. Depends on columns (like features_json) that were neutralized in create_billing_enhancements.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
