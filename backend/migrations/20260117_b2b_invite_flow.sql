-- ================================================================
-- B2B INVITE FLOW ENHANCEMENT
-- ================================================================
-- Adds empresa assignment and usage tracking to invitations
-- ================================================================

-- 1. Add id_empresa to saas_invite (optional empresa assignment)
ALTER TABLE saas_invite 
    ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES accounting_empresa(id) ON DELETE SET NULL;

COMMENT ON COLUMN saas_invite.id_empresa IS 'Optional: assign invited user to specific empresa within tenant';

-- 2. Add used_by_user_id for tracking who consumed the invite
ALTER TABLE saas_invite 
    ADD COLUMN IF NOT EXISTS used_by_user_id BIGINT REFERENCES usuario(id) ON DELETE SET NULL;

COMMENT ON COLUMN saas_invite.used_by_user_id IS 'User ID created from this invite (for audit trail)';

-- 3. Index for empresa-based filtering
CREATE INDEX IF NOT EXISTS idx_saas_invite_empresa 
    ON saas_invite(id_empresa) 
    WHERE used_at IS NULL;

-- 4. Index for tracking which invites a user came from
CREATE INDEX IF NOT EXISTS idx_saas_invite_used_by 
    ON saas_invite(used_by_user_id) 
    WHERE used_by_user_id IS NOT NULL;

-- ================================================================
-- END OF MIGRATION
-- ================================================================
