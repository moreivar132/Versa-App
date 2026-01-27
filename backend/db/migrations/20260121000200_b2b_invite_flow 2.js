// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. This migration depends on 'saas_invite' which was part of neutralized migration 'dual_auth'.
// Evidence: relation 'saas_invite' does not exist error.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
