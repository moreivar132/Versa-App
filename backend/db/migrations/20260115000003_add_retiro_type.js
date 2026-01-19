exports.up = function (knex) {
    return knex.raw(`
    ALTER TABLE accounting_transaccion DROP CONSTRAINT accounting_transaccion_tipo_check;
    ALTER TABLE accounting_transaccion ADD CONSTRAINT accounting_transaccion_tipo_check 
    CHECK (tipo IN ('COBRO', 'PAGO', 'INGRESO_EFECTIVO', 'AJUSTE', 'RETIRO_EFECTIVO'));
  `);
};

exports.down = function (knex) {
    return knex.raw(`
    ALTER TABLE accounting_transaccion DROP CONSTRAINT accounting_transaccion_tipo_check;
    ALTER TABLE accounting_transaccion ADD CONSTRAINT accounting_transaccion_tipo_check 
    CHECK (tipo IN ('COBRO', 'PAGO', 'INGRESO_EFECTIVO', 'AJUSTE'));
  `);
};
