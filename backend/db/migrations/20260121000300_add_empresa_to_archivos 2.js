// ZOMBIE MIGRATION — NO-OP
// Reason: baseline-only strategy. This migration attempts to alter 'contabilidad_factura_archivo', but the table creation migration (create_contabilidad_v3_tables) was neutralized because it conflicted with baseline. However, if the table actually exists in baseline, we should check.
// Wait, looking at baseline dump (Step 101), 'contabilidad_factura_archivo' DOES NOT EXIST in the first 800 lines or the rest.
// Ah, checking baseline schema again. 'contabilidad_factura' exists. 'contabilidad_factura_archivo' was in the neutralized file create_contabilidad_v3_tables.js.
// Since that file was neutralized, the table was never created.
// Therefore, this migration fails.
// Verdict: ZOMBIE by broken dependency.
// Date: 2026-01-23

exports.up = async function (knex) { };
exports.down = async function (knex) { };
exports.config = { transaction: true };
