/**
 * Migración: Cuenta Corriente como Método de Pago
 * 
 * Este script:
 * 1. Agrega el método de pago "CUENTA_CORRIENTE"
 * 2. Agrega campos de auditoría a cuentacorriente
 * 3. Agrega campos a venta para cuenta corriente
 */

const pool = require('../db');

async function migrate() {
    const client = await pool.connect();

    try {
        console.log('🚀 Iniciando migración de Cuenta Corriente...\n');

        await client.query('BEGIN');

        // 1. Agregar método de pago CUENTA_CORRIENTE
        console.log('1️⃣ Agregando método de pago CUENTA_CORRIENTE...');

        // Verificar si ya existe
        const existeMP = await client.query(
            `SELECT id FROM mediopago WHERE codigo = 'CUENTA_CORRIENTE'`
        );

        if (existeMP.rows.length === 0) {
            const medioPagoResult = await client.query(`
                INSERT INTO mediopago (codigo, nombre, afecta_caja, activo)
                VALUES ('CUENTA_CORRIENTE', 'Cuenta Corriente', false, true)
                RETURNING id
            `);
            console.log(`   ✅ Método de pago creado: ID ${medioPagoResult.rows[0].id}`);
        } else {
            console.log(`   ℹ️ Método de pago ya existe: ID ${existeMP.rows[0].id}`);
        }

        // 2. Agregar campos de auditoría a cuentacorriente
        console.log('\n2️⃣ Agregando campos de auditoría a cuentacorriente...');

        await client.query(`
            ALTER TABLE cuentacorriente 
            ADD COLUMN IF NOT EXISTS limite_modificado_por BIGINT REFERENCES usuario(id)
        `);
        console.log('   ✅ Campo limite_modificado_por agregado');

        await client.query(`
            ALTER TABLE cuentacorriente 
            ADD COLUMN IF NOT EXISTS limite_modificado_at TIMESTAMPTZ
        `);
        console.log('   ✅ Campo limite_modificado_at agregado');

        // 3. Agregar campos a tabla venta
        console.log('\n3️⃣ Agregando campos a tabla venta...');

        await client.query(`
            ALTER TABLE venta 
            ADD COLUMN IF NOT EXISTS en_cuenta_corriente BOOLEAN DEFAULT false
        `);
        console.log('   ✅ Campo en_cuenta_corriente agregado a venta');

        await client.query(`
            ALTER TABLE venta 
            ADD COLUMN IF NOT EXISTS id_cuenta_corriente BIGINT REFERENCES cuentacorriente(id)
        `);
        console.log('   ✅ Campo id_cuenta_corriente agregado a venta');

        await client.query('COMMIT');

        console.log('\n✅ Migración completada exitosamente!');

        // Mostrar resumen
        const medioPagos = await pool.query(`
            SELECT id, codigo, nombre, afecta_caja FROM mediopago WHERE codigo = 'CUENTA_CORRIENTE'
        `);
        console.log('\n📋 Resumen:');
        console.log('   Método de pago:', medioPagos.rows[0]);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error en migración:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

migrate()
    .then(() => {
        console.log('\n👋 Proceso finalizado.');
        process.exit(0);
    })
    .catch((err) => {
        console.error('Error fatal:', err);
        process.exit(1);
    });
