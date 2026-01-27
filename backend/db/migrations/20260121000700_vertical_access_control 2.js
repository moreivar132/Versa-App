// ZOMBIE MIGRATION — NO-OP
// Reason: redundancy/conflict cleanup. Table 'vertical' already exists in baseline. User permission overrides also exist.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
