require('dotenv').config();
const knex = require('knex')(require('./knexfile').development);

async function createTasksLeadsPermissions() {
    // First, get or create the tasks_leads vertical
    let vertical = await knex('vertical').where('key', 'tasks_leads').first();
    if (!vertical) {
        [vertical] = await knex('vertical').insert({
            key: 'tasks_leads',
            nombre: 'Tasks & Leads',
            descripcion: 'Gestión de proyectos, tareas y leads',
            icon: 'assignment',
            orden: 50,
            activo: true
        }).returning('*');
        console.log('Created vertical:', vertical.key);
    }

    const permissions = [
        { key: 'tasksleads.dashboard.view', nombre: 'Ver Dashboard', descripcion: 'Ver dashboard de Tasks & Leads', module: 'dashboard' },
        { key: 'tasksleads.projects.view', nombre: 'Ver Proyectos', descripcion: 'Ver proyectos', module: 'projects' },
        { key: 'tasksleads.projects.create', nombre: 'Crear Proyectos', descripcion: 'Crear proyectos', module: 'projects' },
        { key: 'tasksleads.projects.edit', nombre: 'Editar Proyectos', descripcion: 'Editar proyectos', module: 'projects' },
        { key: 'tasksleads.projects.delete', nombre: 'Eliminar Proyectos', descripcion: 'Eliminar proyectos', module: 'projects' },
        { key: 'tasksleads.tasks.view', nombre: 'Ver Tareas', descripcion: 'Ver tareas', module: 'tasks' },
        { key: 'tasksleads.tasks.create', nombre: 'Crear Tareas', descripcion: 'Crear tareas', module: 'tasks' },
        { key: 'tasksleads.tasks.edit', nombre: 'Editar Tareas', descripcion: 'Editar tareas', module: 'tasks' },
        { key: 'tasksleads.tasks.delete', nombre: 'Eliminar Tareas', descripcion: 'Eliminar tareas', module: 'tasks' },
        { key: 'tasksleads.leads.view', nombre: 'Ver Leads', descripcion: 'Ver leads', module: 'leads' },
        { key: 'tasksleads.leads.create', nombre: 'Crear Leads', descripcion: 'Crear leads', module: 'leads' },
        { key: 'tasksleads.leads.edit', nombre: 'Editar Leads', descripcion: 'Editar leads', module: 'leads' },
        { key: 'tasksleads.leads.delete', nombre: 'Eliminar Leads', descripcion: 'Eliminar leads', module: 'leads' },
        { key: 'tasksleads.timeline.view', nombre: 'Ver Timeline', descripcion: 'Ver timeline de leads', module: 'timeline' },
        { key: 'tasksleads.timeline.sync', nombre: 'Sincronizar Timeline', descripcion: 'Sincronizar leads desde Timeline', module: 'timeline' }
    ];

    console.log('Creating Tasks & Leads permissions...');

    for (const perm of permissions) {
        const exists = await knex('permiso').where('key', perm.key).first();
        if (!exists) {
            await knex('permiso').insert({
                ...perm,
                vertical_id: vertical.id
            });
            console.log('  Created:', perm.key);
        } else {
            console.log('  Exists:', perm.key);
        }
    }

    // Assign all to super admin role
    const superAdminRole = await knex('rol').where('nombre', 'SUPER_ADMIN').first();
    if (superAdminRole) {
        const allPerms = await knex('permiso').where('vertical_id', vertical.id).select('id');
        let assigned = 0;
        for (const perm of allPerms) {
            const exists = await knex('rolpermiso').where({ id_rol: superAdminRole.id, id_permiso: perm.id }).first();
            if (!exists) {
                await knex('rolpermiso').insert({ id_rol: superAdminRole.id, id_permiso: perm.id });
                assigned++;
            }
        }
        console.log('  Assigned', assigned, 'new permissions to SUPER_ADMIN');
    }

    console.log('Done!');
    process.exit(0);
}

createTasksLeadsPermissions().catch(e => {
    console.error('Error:', e);
    process.exit(1);
});
