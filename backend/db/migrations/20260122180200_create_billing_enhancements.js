// ZOMBIE MIGRATION — NO-OP
// Reason: Conflict with baseline schema structure. Uses 'tenant_id' when baseline has 'id_tenant' in 'tenant_suscripcion'.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
