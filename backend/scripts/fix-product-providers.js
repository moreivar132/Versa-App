/**
 * Script para actualizar productos existentes con información del proveedor
 * basándose en el historial de compras
 */

require('dotenv').config({ path: '../.env' });
const pool = require('../db');

async function fixProductProviders() {
    const client = await pool.connect();

    try {
        console.log('🔧 Iniciando corrección de proveedores en productos...\n');

        // 1. Actualizar productos con proveedor desde compras
        const updateFromCompras = await client.query(`
            WITH compra_proveedores AS (
                SELECT DISTINCT ON (cl.id_producto)
                    cl.id_producto,
                    cc.id_proveedor,
                    cl.precio_unitario as costo
                FROM compralinea cl
                JOIN compracabecera cc ON cl.id_compra = cc.id
                WHERE cc.id_proveedor IS NOT NULL
                ORDER BY cl.id_producto, cc.fecha_emision DESC
            )
            UPDATE producto p
            SET 
                id_proveedor = cp.id_proveedor,
                costo = COALESCE(p.costo, cp.costo),
                unidad_medida = COALESCE(NULLIF(p.unidad_medida, ''), 'Unidades'),
                updated_at = NOW()
            FROM compra_proveedores cp
            WHERE p.id = cp.id_producto
            AND p.id_proveedor IS NULL
        `);

        console.log(`✅ Actualizados ${updateFromCompras.rowCount} productos con proveedor desde compras`);

        // 2. Establecer unidad de medida por defecto para productos sin ella
        const updateUnidades = await client.query(`
            UPDATE producto
            SET unidad_medida = 'Unidades'
            WHERE unidad_medida IS NULL OR unidad_medida = ''
        `);

        console.log(`✅ Actualizados ${updateUnidades.rowCount} productos con unidad de medida por defecto`);

        // 3. Mostrar resumen
        const stats = await client.query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN id_proveedor IS NOT NULL THEN 1 END) as con_proveedor,
                COUNT(CASE WHEN id_proveedor IS NULL THEN 1 END) as sin_proveedor,
                COUNT(CASE WHEN unidad_medida IS NOT NULL AND unidad_medida != '' THEN 1 END) as con_unidad
            FROM producto
        `);

        console.log('\n📊 Resumen de productos:');
        console.log(`   Total: ${stats.rows[0].total}`);
        console.log(`   Con proveedor: ${stats.rows[0].con_proveedor}`);
        console.log(`   Sin proveedor: ${stats.rows[0].sin_proveedor}`);
        console.log(`   Con unidad de medida: ${stats.rows[0].con_unidad}`);

        console.log('\n✅ Corrección completada');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        client.release();
        await pool.end();
    }
}

fixProductProviders();
