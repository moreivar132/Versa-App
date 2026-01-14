/**
 * Migración: Añadir permisos RBAC para módulos Clientes y Vehículos V2
 * 
 * Añade los permisos necesarios para la nueva arquitectura modular.
 */

exports.up = async function (knex) {
    console.log('➕ Añadiendo permisos RBAC para Clientes y Vehículos...');

    const permissions = [
        // Clientes
        { nombre: 'Clientes Lectura', key: 'clientes.read', module: 'clientes', descripcion: 'Ver listado y detalle de clientes' },
        { nombre: 'Clientes Escritura', key: 'clientes.write', module: 'clientes', descripcion: 'Crear y editar clientes' },
        { nombre: 'Clientes Eliminar', key: 'clientes.delete', module: 'clientes', descripcion: 'Eliminar clientes' },

        // Vehículos
        { nombre: 'Vehículos Lectura', key: 'vehiculos.read', module: 'vehiculos', descripcion: 'Ver listado y detalle de vehículos' },
        { nombre: 'Vehículos Escritura', key: 'vehiculos.write', module: 'vehiculos', descripcion: 'Crear y editar vehículos' },
        { nombre: 'Vehículos Eliminar', key: 'vehiculos.delete', module: 'vehiculos', descripcion: 'Eliminar vehículos' }
    ];

    for (const perm of permissions) {
        // Verificar si ya existe
        const exists = await knex('permiso').where('key', perm.key).first();

        if (!exists) {
            await knex('permiso').insert(perm);
            console.log(`  ✓ Permiso creado: ${perm.key}`);
        } else {
            console.log(`  ⚠ Permiso ya existe: ${perm.key}`);
        }
    }

    // Asignar permisos base a rol Admin (id=1) si existe
    const adminRol = await knex('rol').where('nombre', 'Administrador').first();

    if (adminRol) {
        const newPerms = await knex('permiso')
            .whereIn('key', ['clientes.read', 'clientes.write', 'vehiculos.read', 'vehiculos.write'])
            .select('id');

        for (const perm of newPerms) {
            const exists = await knex('rolpermiso')
                .where({ id_rol: adminRol.id, id_permiso: perm.id })
                .first();

            if (!exists) {
                await knex('rolpermiso').insert({
                    id_rol: adminRol.id,
                    id_permiso: perm.id
                });
            }
        }
        console.log('  ✓ Permisos asignados al rol Administrador');
    }

    console.log('✅ Permisos RBAC añadidos');
};

exports.down = async function (knex) {
    console.log('➖ Eliminando permisos RBAC de Clientes y Vehículos...');

    const keysToRemove = [
        'clientes.read', 'clientes.write', 'clientes.delete',
        'vehiculos.read', 'vehiculos.write', 'vehiculos.delete'
    ];

    // Primero eliminar referencias en rolpermiso
    const permisos = await knex('permiso').whereIn('key', keysToRemove).select('id');
    const permisoIds = permisos.map(p => p.id);

    if (permisoIds.length > 0) {
        await knex('rolpermiso').whereIn('id_permiso', permisoIds).del();
        await knex('permiso').whereIn('id', permisoIds).del();
    }

    console.log('✅ Permisos eliminados');
};
