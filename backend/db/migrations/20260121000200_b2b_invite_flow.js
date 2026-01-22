/**
 * Migration: B2B Invite Flow Enhancement
 * @description Adds empresa assignment and usage tracking to invitations
 */

exports.up = async function (knex) {
    // 1. Add id_empresa to saas_invite
    await knex.raw(`
        ALTER TABLE saas_invite 
            ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES accounting_empresa(id) ON DELETE SET NULL;
    `);
    await knex.raw(`COMMENT ON COLUMN saas_invite.id_empresa IS 'Optional: assign invited user to specific empresa within tenant';`);

    // 2. Add used_by_user_id for tracking
    await knex.raw(`
        ALTER TABLE saas_invite 
            ADD COLUMN IF NOT EXISTS used_by_user_id BIGINT REFERENCES usuario(id) ON DELETE SET NULL;
    `);
    await knex.raw(`COMMENT ON COLUMN saas_invite.used_by_user_id IS 'User ID created from this invite (for audit trail)';`);

    // 3. Create indexes
    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_saas_invite_empresa 
            ON saas_invite(id_empresa) 
            WHERE used_at IS NULL;
    `);

    await knex.raw(`
        CREATE INDEX IF NOT EXISTS idx_saas_invite_used_by 
            ON saas_invite(used_by_user_id) 
            WHERE used_by_user_id IS NOT NULL;
    `);
};

exports.down = async function (knex) {
    await knex.raw(`DROP INDEX IF EXISTS idx_saas_invite_used_by;`);
    await knex.raw(`DROP INDEX IF EXISTS idx_saas_invite_empresa;`);
    await knex.raw(`ALTER TABLE saas_invite DROP COLUMN IF EXISTS used_by_user_id;`);
    await knex.raw(`ALTER TABLE saas_invite DROP COLUMN IF EXISTS id_empresa;`);
};

exports.config = { transaction: true };
