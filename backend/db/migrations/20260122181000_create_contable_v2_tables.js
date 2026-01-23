// ZOMBIE MIGRATION — NO-OP
// Reason: Conflict with baseline schema. 'permiso' table does not have 'key' or 'module' columns.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
