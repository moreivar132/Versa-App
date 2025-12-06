/**
 * Script para verificar el esquema de la base de datos
 */

require('dotenv').config();
const pool = require('./db');

async function verificarEsquema() {
    const client = await pool.connect();

    try {
        console.log('📊 Verificando esquema de la base de datos...\n');

        // Listar todas las tablas
        const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

        console.log('Tablas existentes en la base de datos:');
        console.log('='.repeat(60));
        result.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        console.log('\n' + '='.repeat(60));
        console.log(`Total: ${result.rows.length} tablas\n`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        client.release();
        await pool.end();
    }
}

verificarEsquema();
