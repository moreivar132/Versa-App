// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. Permission insertion and RBAC setup are redundant with baseline data/structure or handled by seeds.
// Evidence: baseline schema dump handles triggers and some data structures; avoiding noise.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
