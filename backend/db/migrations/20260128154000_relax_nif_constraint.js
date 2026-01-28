
exports.up = async function (knex) {
    // Drop the old strict unique index
    await knex.raw('DROP INDEX IF EXISTS ux_acc_empresa_nif');

    // Create a new composite unique index that includes nombre_comercial
    // This allows same NIF/CIF as long as nombre_comercial is different
    await knex.raw(`
    CREATE UNIQUE INDEX ux_acc_empresa_nif_commercial 
    ON accounting_empresa (id_tenant, nif_cif, nombre_comercial) 
    WHERE deleted_at IS NULL
  `);
};

exports.down = async function (knex) {
    // Revert: Drop the new index
    await knex.raw('DROP INDEX IF EXISTS ux_acc_empresa_nif_commercial');

    // Restore the old strict unique index
    await knex.raw(`
    CREATE UNIQUE INDEX ux_acc_empresa_nif 
    ON accounting_empresa (id_tenant, nif_cif) 
    WHERE deleted_at IS NULL
  `);
};
