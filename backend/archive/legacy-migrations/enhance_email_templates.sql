-- =====================================================
-- VERSA - Email Template Enhancements
-- Add columns for user-created templates
-- =====================================================

-- Add is_system column to distinguish system vs custom templates
ALTER TABLE email_template 
ADD COLUMN IF NOT EXISTS is_system BOOLEAN DEFAULT false;

-- Add category for organization
ALTER TABLE email_template 
ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'marketing';

-- Add description for user reference
ALTER TABLE email_template 
ADD COLUMN IF NOT EXISTS description TEXT;

-- Add preview text (shown in email clients)
ALTER TABLE email_template 
ADD COLUMN IF NOT EXISTS preview_text TEXT;

-- Update existing templates to mark as system
UPDATE email_template 
SET is_system = true 
WHERE code IN ('WELCOME', 'PASSWORD_RESET');

-- Add trigger_type to automations
ALTER TABLE email_automation 
ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50) DEFAULT 'event';

-- Add schedule for future scheduled sends
ALTER TABLE email_automation 
ADD COLUMN IF NOT EXISTS schedule_cron VARCHAR(100);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_template_tenant_system 
ON email_template(id_tenant, is_system);

COMMENT ON COLUMN email_template.is_system IS 'True for built-in templates (WELCOME, RESET), false for user-created';
COMMENT ON COLUMN email_template.category IS 'marketing, transactional, reminder';
COMMENT ON COLUMN email_automation.trigger_type IS 'event, manual, scheduled';
