require('dotenv').config();
const bcrypt = require('bcrypt');
const { createUser, getUserByEmail } = require('./models/userModel');
const pool = require('./db');

async function run() {
    const email = 'admin@versa.com';
    const password = 'admin';

    try {
        const existing = await getUserByEmail(email);
        if (existing) {
            console.log('⚠️  El usuario admin ya existe.');
            console.log('   Email:', email);
            console.log('   Si no recuerdas la contraseña, contacta con soporte o borra el usuario en la BD.');
        } else {
            const passwordHash = await bcrypt.hash(password, 10);
            await createUser({
                id_tenant: null,
                nombre: 'Administrador',
                email,
                passwordHash,
                isSuperAdmin: true
            });

            console.log('✅ Usuario creado exitosamente.');
            console.log('   Email:', email);
            console.log('   Password:', password);
        }
    } catch (err) {
        console.error('❌ Error:', err);
    } finally {
        pool.end();
    }
}

run();
