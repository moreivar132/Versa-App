/**
 * Script para verificar y asignar técnicos a TODAS las sucursales
 */

require('dotenv').config();
const pool = require('../db');

async function verificarYAsignar() {
    const client = await pool.connect();
    try {
        console.log('🔄 Verificando estado actual de técnicos y sucursales...\n');

        // Ver sucursales
        const sucursalesResult = await client.query('SELECT id, nombre FROM sucursal ORDER BY id');
        console.log('📍 Sucursales disponibles:');
        sucursalesResult.rows.forEach(s => console.log(`  - ID ${s.id}: ${s.nombre}`));

        // Ver técnicos (usuarios que pueden ser asignados)
        const tecnicosResult = await client.query(`
            SELECT id, nombre, rol
            FROM usuario 
            WHERE (is_super_admin = false OR is_super_admin IS NULL)
            ORDER BY nombre
        `);
        console.log('\n👤 Técnicos disponibles:');
        tecnicosResult.rows.forEach(u => console.log(`  - ID ${u.id}: ${u.nombre} (${u.rol})`));

        // Ver asignaciones actuales
        const asignacionesResult = await client.query(`
            SELECT us.id_usuario, u.nombre as tecnico, us.id_sucursal, s.nombre as sucursal
            FROM usuario_sucursal us
            JOIN usuario u ON us.id_usuario = u.id
            JOIN sucursal s ON us.id_sucursal = s.id
            ORDER BY s.nombre, u.nombre
        `);

        console.log('\n📋 Asignaciones actuales:');
        if (asignacionesResult.rows.length === 0) {
            console.log('  ⚠️ No hay asignaciones');
        } else {
            asignacionesResult.rows.forEach(a =>
                console.log(`  - ${a.tecnico} → ${a.sucursal}`)
            );
        }

        // Preguntar si se desea asignar a todos
        console.log('\n---');
        console.log('Para asignar TODOS los técnicos a TODAS las sucursales,');
        console.log('ejecuta: node scripts/asignar-todos-tecnicos.js --apply');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        pool.end();
    }
}

verificarYAsignar();
