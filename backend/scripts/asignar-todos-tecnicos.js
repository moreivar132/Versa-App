/**
 * Script para asignar TODOS los técnicos a TODAS las sucursales
 * 
 * Ejecutar: node scripts/asignar-todos-tecnicos.js
 */

require('dotenv').config();
const pool = require('../db');

async function asignarTodosATodos() {
    const client = await pool.connect();
    try {
        console.log('🔄 Asignando TODOS los técnicos a TODAS las sucursales...\n');

        // Obtener todas las sucursales
        const sucursalesResult = await client.query('SELECT id, nombre FROM sucursal ORDER BY id');
        console.log('📍 Sucursales:');
        sucursalesResult.rows.forEach(s => console.log(`  - ID ${s.id}: ${s.nombre}`));

        // Obtener todos los técnicos (usuarios no super_admin)
        const tecnicosResult = await client.query(`
            SELECT id, nombre, rol
            FROM usuario 
            WHERE (is_super_admin = false OR is_super_admin IS NULL)
            ORDER BY nombre
        `);
        console.log('\n👤 Técnicos:');
        tecnicosResult.rows.forEach(u => console.log(`  - ID ${u.id}: ${u.nombre}`));

        // Limpiar asignaciones actuales
        await client.query('DELETE FROM usuario_sucursal');
        console.log('\n🗑️ Asignaciones anteriores eliminadas');

        // Asignar cada técnico a cada sucursal
        let count = 0;
        for (const tecnico of tecnicosResult.rows) {
            for (const sucursal of sucursalesResult.rows) {
                try {
                    await client.query(`
                        INSERT INTO usuario_sucursal (id_usuario, id_sucursal)
                        VALUES ($1, $2)
                        ON CONFLICT DO NOTHING
                    `, [tecnico.id, sucursal.id]);
                    count++;
                } catch (e) {
                    console.error(`  ⚠️ Error asignando ${tecnico.nombre} a ${sucursal.nombre}: ${e.message}`);
                }
            }
            console.log(`✅ ${tecnico.nombre} → Todas las sucursales`);
        }

        console.log(`\n✅ Total: ${count} asignaciones creadas`);
        console.log('✅ Ahora todos los técnicos aparecerán en todas las sucursales');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

asignarTodosATodos();
