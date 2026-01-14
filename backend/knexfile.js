/**
 * Knex Configuration File
 * 
 * Este archivo configura Knex para gestionar migraciones de base de datos.
 * 
 * IMPORTANTE: No cambiar sin entender el impacto en producción.
 * 
 * Comandos:
 *   npm run migrate:latest    - Ejecutar migraciones pendientes
 *   npm run migrate:rollback  - Revertir última migración
 *   npm run migrate:status    - Ver estado de migraciones
 *   npm run migrate:make NAME - Crear nueva migración
 * 
 * @see docs/MIGRATIONS.md para guía completa
 */

require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    console.error('❌ DATABASE_URL no definida. Configura tu archivo .env');
    process.exit(1);
}

module.exports = {
    // Configuración para desarrollo
    development: {
        client: 'pg',
        connection: connectionString,
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            directory: './db/migrations',
            tableName: 'knex_migrations',
            extension: 'js',
            // Ordenar por timestamp en el nombre
            sortDirsSeparately: true
        },
        seeds: {
            directory: './db/seeds'
        }
    },

    // Configuración para staging/test
    staging: {
        client: 'pg',
        connection: connectionString,
        pool: {
            min: 2,
            max: 10
        },
        migrations: {
            directory: './db/migrations',
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: './db/seeds'
        }
    },

    // Configuración para producción
    production: {
        client: 'pg',
        connection: connectionString,
        pool: {
            min: 2,
            max: 20
        },
        migrations: {
            directory: './db/migrations',
            tableName: 'knex_migrations'
        },
        seeds: {
            directory: './db/seeds'
        },
        // En producción, loguear queries lentas
        log: {
            warn(message) {
                console.warn('[Knex WARN]', message);
            },
            error(message) {
                console.error('[Knex ERROR]', message);
            }
        }
    }
};
