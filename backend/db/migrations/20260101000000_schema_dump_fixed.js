exports.up = async function (knex) {
    // NO-OP: This migration was a duplicate of 20260101000000_schema_dump.js
    // Consolidating to a single baseline to avoid function collision errors (CREATE OR REPLACE).
    // The content is now managed in 20260101000000_schema_dump.js
};

exports.down = async function (knex) {
    // NO-OP
};
