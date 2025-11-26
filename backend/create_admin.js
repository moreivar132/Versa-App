require('dotenv').config();
const bcrypt = require('bcrypt');
const { createUser, getUserByEmail } = require('./models/userModel');
const pool = require('./db');

async function run() {
    const email = 'admin@versa.com';
    const password = 'admin';

    try {
        // Primero, verificar si existe un tenant, si no, crear uno
        const tenantCheck = await pool.query('SELECT id FROM tenant LIMIT 1');
        let tenantId;

        if (tenantCheck.rows.length === 0) {
            console.log('📝 No hay tenants, creando tenant por defecto...');
            const tenantResult = await pool.query(
                'INSERT INTO tenant (nombre) VALUES ($1) RETURNING id',
                ['Sistema Principal']
            );
            tenantId = tenantResult.rows[0].id;
            console.log(`✅ Tenant creado con ID: ${tenantId}`);
        } else {
            tenantId = tenantCheck.rows[0].id;
            console.log(`✅ Usando tenant existente con ID: ${tenantId}`);
        }

        // Ahora verificar si el usuario admin existe
        const existing = await getUserByEmail(email);
        if (existing) {
            console.log('⚠️  El usuario admin ya existe.');
            console.log('   Email:', email);
            console.log('   Password: admin');
            console.log('   Si no recuerdas la contraseña, borra el usuario en la BD y vuelve a ejecutar este script.');
        } else {
            const passwordHash = await bcrypt.hash(password, 10);
            await createUser({
                id_tenant: tenantId,
                nombre: 'Administrador',
                email,
                passwordHash,
                isSuperAdmin: true
            });

            console.log('✅ Usuario super admin creado exitosamente.');
            console.log('   Email:', email);
            console.log('   Password:', password);
            console.log('   Tenant ID:', tenantId);
        }
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        pool.end();
    }
}

run();
