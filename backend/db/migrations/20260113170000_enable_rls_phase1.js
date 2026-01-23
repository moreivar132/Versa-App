// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. RLS policies are already applied in the baseline schema dump.
// Evidence: baseline schema dump section 8 (lines 1007+).
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
