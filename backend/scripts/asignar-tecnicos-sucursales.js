/**
 * Script para asignar técnicos a sucursales específicas
 * - Jose Alberto → solo Versa Tesoro
 * - Los demás → Versa El Mayo
 * 
 * Ejecutar: node scripts/asignar-tecnicos-sucursales.js
 */

require('dotenv').config();
const pool = require('../db');

async function asignarTecnicos() {
    const client = await pool.connect();
    try {
        console.log('🔄 Asignando técnicos a sucursales...');

        // Primero, ver las sucursales disponibles
        const sucursalesResult = await client.query('SELECT id, nombre FROM sucursal ORDER BY id');
        console.log('\n📍 Sucursales disponibles:');
        sucursalesResult.rows.forEach(s => console.log(`  - ID ${s.id}: ${s.nombre}`));

        // Ver usuarios disponibles (no super_admin)
        const usuariosResult = await client.query(`
            SELECT id, nombre 
            FROM usuario 
            WHERE is_super_admin = false OR is_super_admin IS NULL
            ORDER BY nombre
        `);
        console.log('\n👤 Usuarios/Técnicos disponibles:');
        usuariosResult.rows.forEach(u => console.log(`  - ID ${u.id}: ${u.nombre}`));

        // Limpiar asignaciones actuales
        await client.query('DELETE FROM usuario_sucursal');
        console.log('\n🗑️ Asignaciones anteriores eliminadas');

        // Buscar IDs de las sucursales
        const tesoroResult = await client.query(`SELECT id FROM sucursal WHERE nombre ILIKE '%tesoro%' LIMIT 1`);
        const mayoResult = await client.query(`SELECT id FROM sucursal WHERE nombre ILIKE '%mayo%' LIMIT 1`);

        const idTesoro = tesoroResult.rows[0]?.id;
        const idMayo = mayoResult.rows[0]?.id;

        console.log(`\n📍 Sucursal Tesoro ID: ${idTesoro || 'No encontrada'}`);
        console.log(`📍 Sucursal El Mayo ID: ${idMayo || 'No encontrada'}`);

        if (!idTesoro || !idMayo) {
            console.log('\n⚠️ No se encontraron las sucursales. Mostrando lista completa:');
            return;
        }

        // Buscar Jose Alberto
        const joseResult = await client.query(`SELECT id FROM usuario WHERE nombre ILIKE '%jose%alberto%' LIMIT 1`);
        const idJose = joseResult.rows[0]?.id;

        if (idJose) {
            // Jose Alberto solo en Tesoro
            await client.query(`
                INSERT INTO usuario_sucursal (id_usuario, id_sucursal)
                VALUES ($1, $2)
            `, [idJose, idTesoro]);
            console.log(`\n✅ Jose Alberto (ID ${idJose}) → Versa Tesoro (ID ${idTesoro})`);
        }

        // Los demás técnicos a El Mayo
        const otrosResult = await client.query(`
            SELECT id, nombre FROM usuario 
            WHERE (is_super_admin = false OR is_super_admin IS NULL)
              AND id != $1
        `, [idJose || 0]);

        for (const usuario of otrosResult.rows) {
            await client.query(`
                INSERT INTO usuario_sucursal (id_usuario, id_sucursal)
                VALUES ($1, $2)
            `, [usuario.id, idMayo]);
            console.log(`✅ ${usuario.nombre} (ID ${usuario.id}) → Versa El Mayo (ID ${idMayo})`);
        }

        console.log('\n✅ Asignación completada');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

asignarTecnicos();
