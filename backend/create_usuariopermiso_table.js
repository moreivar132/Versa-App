require('dotenv').config();
const pool = require('./db');

async function runMigration() {
    try {
        console.log('🔌 Conectando a la base de datos...');

        // Create usuariopermiso table
        console.log('📝 Creando tabla "usuariopermiso"...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.usuariopermiso (
                id_usuario integer NOT NULL,
                id_permiso integer NOT NULL,
                CONSTRAINT usuariopermiso_pkey PRIMARY KEY (id_usuario, id_permiso),
                CONSTRAINT usuariopermiso_id_permiso_fkey FOREIGN KEY (id_permiso) REFERENCES public.permiso(id) ON DELETE CASCADE,
                CONSTRAINT usuariopermiso_id_usuario_fkey FOREIGN KEY (id_usuario) REFERENCES public.usuario(id) ON DELETE CASCADE
            );
        `);
        console.log('✅ Tabla "usuariopermiso" creada exitosamente.');

    } catch (err) {
        console.error('❌ Error al ejecutar la migración:', err);
    } finally {
        pool.end();
    }
}

runMigration();
