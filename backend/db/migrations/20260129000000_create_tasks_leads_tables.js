/**
 * Migration: Tasks & Leads Vertical Tables
 * 
 * Creates the core tables for the Tasks & Leads vertical:
 * - projects: Project management
 * - tasks: Task tracking within projects
 * - leads: CRM leads with Timeline integration
 * - lead_timeline_link: Links leads to TimelinesAI conversations
 */

exports.up = async function (knex) {
    // =========================================================
    // 1. Register the TASKS_LEADS vertical
    // =========================================================
    await knex.raw(`
        INSERT INTO vertical (id, key, name, description, icon, is_active, display_order)
        VALUES (4, 'tasks_leads', 'Tasks & Leads', 'Gestión de tareas, proyectos y leads con integración Timeline IA', 'task_alt', true, 4)
        ON CONFLICT (id) DO UPDATE SET
            key = EXCLUDED.key,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            icon = EXCLUDED.icon,
            is_active = EXCLUDED.is_active
    `);

    // =========================================================
    // 2. Create PROJECTS table
    // =========================================================
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS tasksleads_project (
            id SERIAL PRIMARY KEY,
            id_tenant INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            branch_id INTEGER REFERENCES sucursal(id) ON DELETE SET NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived')),
            created_by INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS idx_tasksleads_project_tenant ON tasksleads_project(id_tenant);
        CREATE INDEX IF NOT EXISTS idx_tasksleads_project_branch ON tasksleads_project(branch_id);
        CREATE INDEX IF NOT EXISTS idx_tasksleads_project_status ON tasksleads_project(status) WHERE deleted_at IS NULL;
    `);

    // =========================================================
    // 3. Create TASKS table
    // =========================================================
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS tasksleads_task (
            id SERIAL PRIMARY KEY,
            id_tenant INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            project_id INTEGER NOT NULL REFERENCES tasksleads_project(id) ON DELETE CASCADE,
            branch_id INTEGER REFERENCES sucursal(id) ON DELETE SET NULL,
            title VARCHAR(500) NOT NULL,
            description TEXT,
            status VARCHAR(20) DEFAULT 'todo' CHECK (status IN ('todo', 'doing', 'done')),
            priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
            due_date DATE,
            assigned_to_user_id INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
            created_by INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS idx_tasksleads_task_tenant ON tasksleads_task(id_tenant);
        CREATE INDEX IF NOT EXISTS idx_tasksleads_task_project ON tasksleads_task(project_id);
        CREATE INDEX IF NOT EXISTS idx_tasksleads_task_assigned ON tasksleads_task(assigned_to_user_id);
        CREATE INDEX IF NOT EXISTS idx_tasksleads_task_status ON tasksleads_task(status) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_tasksleads_task_due ON tasksleads_task(due_date) WHERE due_date IS NOT NULL AND deleted_at IS NULL;
    `);

    // =========================================================
    // 4. Create LEADS table
    // =========================================================
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS tasksleads_lead (
            id SERIAL PRIMARY KEY,
            id_tenant INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            branch_id INTEGER REFERENCES sucursal(id) ON DELETE SET NULL,
            full_name VARCHAR(255),
            company VARCHAR(255),
            phone VARCHAR(50),
            email VARCHAR(255),
            channel VARCHAR(50) CHECK (channel IN ('whatsapp', 'web', 'timeline', 'referral', 'other')),
            status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'open', 'followup', 'won', 'lost', 'closed')),
            interested_vertical VARCHAR(50) CHECK (interested_vertical IN ('manager', 'saas', 'marketplace', 'tasks_leads', 'other')),
            owner_user_id INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
            last_activity_at TIMESTAMP WITH TIME ZONE,
            last_message_preview TEXT,
            notes TEXT,
            created_by INTEGER REFERENCES usuario(id) ON DELETE SET NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            deleted_at TIMESTAMP WITH TIME ZONE
        );

        CREATE INDEX IF NOT EXISTS idx_tasksleads_lead_tenant ON tasksleads_lead(id_tenant);
        CREATE INDEX IF NOT EXISTS idx_tasksleads_lead_branch ON tasksleads_lead(branch_id);
        CREATE INDEX IF NOT EXISTS idx_tasksleads_lead_owner ON tasksleads_lead(owner_user_id);
        CREATE INDEX IF NOT EXISTS idx_tasksleads_lead_status ON tasksleads_lead(status) WHERE deleted_at IS NULL;
        CREATE INDEX IF NOT EXISTS idx_tasksleads_lead_phone ON tasksleads_lead(phone) WHERE phone IS NOT NULL;
    `);

    // =========================================================
    // 5. Create WEBHOOK_EVENTS table (Anti-duplication logic)
    // =========================================================
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS tasksleads_webhook_event (
            id SERIAL PRIMARY KEY,
            id_tenant INTEGER REFERENCES tenant(id) ON DELETE SET NULL,
            external_event_id VARCHAR(255) UNIQUE NOT NULL,
            event_type VARCHAR(100),
            payload JSONB,
            processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_tasksleads_webhook_event_external ON tasksleads_webhook_event(external_event_id);
    `);

    // =========================================================
    // 5. Create LEAD_TIMELINE_LINK table (for TimelinesAI integration)
    // =========================================================
    await knex.raw(`
        CREATE TABLE IF NOT EXISTS tasksleads_lead_timeline_link (
            id SERIAL PRIMARY KEY,
            id_tenant INTEGER NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            lead_id INTEGER NOT NULL REFERENCES tasksleads_lead(id) ON DELETE CASCADE,
            timeline_external_id VARCHAR(255),
            timeline_phone VARCHAR(50),
            last_sync_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_tasksleads_timeline_link_lead ON tasksleads_lead_timeline_link(lead_id);
        CREATE INDEX IF NOT EXISTS idx_tasksleads_timeline_link_external ON tasksleads_lead_timeline_link(timeline_external_id);
        CREATE INDEX IF NOT EXISTS idx_tasksleads_timeline_link_phone ON tasksleads_lead_timeline_link(timeline_phone);
    `);

    // =========================================================
    // 6. Enable RLS on all new tables
    // =========================================================
    await knex.raw(`
        ALTER TABLE tasksleads_project ENABLE ROW LEVEL SECURITY;
        ALTER TABLE tasksleads_task ENABLE ROW LEVEL SECURITY;
        ALTER TABLE tasksleads_lead ENABLE ROW LEVEL SECURITY;
        ALTER TABLE tasksleads_lead_timeline_link ENABLE ROW LEVEL SECURITY;

        -- RLS Policies for projects
        DROP POLICY IF EXISTS tasksleads_project_tenant_isolation ON tasksleads_project;
        CREATE POLICY tasksleads_project_tenant_isolation ON tasksleads_project
            USING (id_tenant = current_setting('app.current_tenant_id', true)::INTEGER);

        -- RLS Policies for tasks
        DROP POLICY IF EXISTS tasksleads_task_tenant_isolation ON tasksleads_task;
        CREATE POLICY tasksleads_task_tenant_isolation ON tasksleads_task
            USING (id_tenant = current_setting('app.current_tenant_id', true)::INTEGER);

        -- RLS Policies for leads
        DROP POLICY IF EXISTS tasksleads_lead_tenant_isolation ON tasksleads_lead;
        CREATE POLICY tasksleads_lead_tenant_isolation ON tasksleads_lead
            USING (id_tenant = current_setting('app.current_tenant_id', true)::INTEGER);

        -- RLS Policies for timeline links
        DROP POLICY IF EXISTS tasksleads_lead_timeline_link_tenant_isolation ON tasksleads_lead_timeline_link;
        CREATE POLICY tasksleads_lead_timeline_link_tenant_isolation ON tasksleads_lead_timeline_link
            USING (id_tenant = current_setting('app.current_tenant_id', true)::INTEGER);
    `);

    console.log('✅ Tasks & Leads vertical tables created successfully');
};

exports.down = async function (knex) {
    // Drop tables in reverse order of dependencies
    await knex.raw(`
        DROP TABLE IF EXISTS tasksleads_lead_timeline_link CASCADE;
        DROP TABLE IF EXISTS tasksleads_lead CASCADE;
        DROP TABLE IF EXISTS tasksleads_task CASCADE;
        DROP TABLE IF EXISTS tasksleads_project CASCADE;
    `);

    // Remove vertical (optional - may want to keep for data integrity)
    await knex.raw(`
        DELETE FROM vertical WHERE id = 4;
    `);

    console.log('✅ Tasks & Leads vertical tables dropped');
};
