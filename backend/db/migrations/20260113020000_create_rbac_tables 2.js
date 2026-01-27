// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. Tables 'rol', 'permiso', 'usuariorol', 'rolpermiso' already exist in baseline schema.
// Evidence: baseline schema dump lines 492+, 553+, 564+, 572+.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
