/**
 * MIGRACIÓN BASELINE - LEGACY NO-OP
 * 
 * Esta migración originalmente verificaba el estado del schema.
 * Ha sido REEMPLAZADA por 20260101000000_schema_dump.js que crea todo el schema.
 * 
 * Se mantiene como archivo para preservar la historia de timestamps,
 * pero ya no ejecuta lógica que dependa de estado previo.
 */

exports.up = async function (knex) {
    console.log('📋 BASELINE (NO-OP): Schema initialization handled by schema_dump.');
    return Promise.resolve();
};

exports.down = async function (knex) {
    console.log('📋 BASELINE (NO-OP): Nothing to revert.');
    return Promise.resolve();
};
