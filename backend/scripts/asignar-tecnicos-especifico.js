/**
 * Script para asignar técnicos según las reglas del negocio:
 * - José Alberto → solo Versa Tesoro
 * - Yorman y Camilo → solo PI Mayo
 * 
 * Ejecutar: node scripts/asignar-tecnicos-especifico.js
 */

require('dotenv').config();
const pool = require('../db');

async function asignarTecnicosEspecificos() {
    const client = await pool.connect();
    try {
        console.log('🔄 Asignando técnicos según reglas específicas...\n');

        // Ver sucursales disponibles
        const sucursalesResult = await client.query('SELECT id, nombre FROM sucursal ORDER BY id');
        console.log('📍 Sucursales disponibles:');
        sucursalesResult.rows.forEach(s => console.log(`  - ID ${s.id}: ${s.nombre}`));

        // Ver técnicos disponibles
        const tecnicosResult = await client.query(`
            SELECT id, nombre, rol
            FROM usuario 
            WHERE (is_super_admin = false OR is_super_admin IS NULL)
            ORDER BY nombre
        `);
        console.log('\n👤 Técnicos disponibles:');
        tecnicosResult.rows.forEach(u => console.log(`  - ID ${u.id}: ${u.nombre}`));

        // Buscar IDs de las sucursales
        const tesoroResult = await client.query(`SELECT id FROM sucursal WHERE nombre ILIKE '%tesoro%' LIMIT 1`);
        const mayoResult = await client.query(`SELECT id FROM sucursal WHERE nombre ILIKE '%mayo%' LIMIT 1`);

        const idTesoro = tesoroResult.rows[0]?.id;
        const idMayo = mayoResult.rows[0]?.id;

        console.log(`\n📍 Sucursal Tesoro ID: ${idTesoro || 'No encontrada'}`);
        console.log(`📍 Sucursal PI Mayo ID: ${idMayo || 'No encontrada'}`);

        if (!idTesoro || !idMayo) {
            console.log('\n⚠️ No se encontraron las sucursales necesarias.');
            return;
        }

        // Limpiar asignaciones actuales
        await client.query('DELETE FROM usuario_sucursal');
        console.log('\n🗑️ Asignaciones anteriores eliminadas');

        // Buscar técnicos por nombre
        const joseResult = await client.query(`SELECT id, nombre FROM usuario WHERE nombre ILIKE '%jose%alberto%' LIMIT 1`);
        const yormanResult = await client.query(`SELECT id, nombre FROM usuario WHERE nombre ILIKE '%yorman%' LIMIT 1`);
        const camiloResult = await client.query(`SELECT id, nombre FROM usuario WHERE nombre ILIKE '%camilo%' LIMIT 1`);

        const jose = joseResult.rows[0];
        const yorman = yormanResult.rows[0];
        const camilo = camiloResult.rows[0];

        console.log('\n📋 Asignando técnicos:\n');

        // José Alberto → Tesoro
        if (jose) {
            await client.query(`
                INSERT INTO usuario_sucursal (id_usuario, id_sucursal)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [jose.id, idTesoro]);
            console.log(`✅ ${jose.nombre} (ID ${jose.id}) → Versa Tesoro`);
        } else {
            console.log('⚠️ No se encontró a José Alberto');
        }

        // Yorman → PI Mayo
        if (yorman) {
            await client.query(`
                INSERT INTO usuario_sucursal (id_usuario, id_sucursal)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [yorman.id, idMayo]);
            console.log(`✅ ${yorman.nombre} (ID ${yorman.id}) → PI Mayo`);
        } else {
            console.log('⚠️ No se encontró a Yorman');
        }

        // Camilo → PI Mayo
        if (camilo) {
            await client.query(`
                INSERT INTO usuario_sucursal (id_usuario, id_sucursal)
                VALUES ($1, $2)
                ON CONFLICT DO NOTHING
            `, [camilo.id, idMayo]);
            console.log(`✅ ${camilo.nombre} (ID ${camilo.id}) → PI Mayo`);
        } else {
            console.log('⚠️ No se encontró a Camilo');
        }

        // Verificar asignaciones finales
        const verificar = await client.query(`
            SELECT u.nombre as tecnico, s.nombre as sucursal
            FROM usuario_sucursal us
            JOIN usuario u ON us.id_usuario = u.id
            JOIN sucursal s ON us.id_sucursal = s.id
            ORDER BY s.nombre, u.nombre
        `);

        console.log('\n📋 Asignaciones finales:');
        verificar.rows.forEach(a => console.log(`  - ${a.tecnico} → ${a.sucursal}`));

        console.log('\n✅ Asignación completada');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

asignarTecnicosEspecificos();
