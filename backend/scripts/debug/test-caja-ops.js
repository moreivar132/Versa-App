require('dotenv').config();
const pool = require('./db');

async function testCaja() {
    try {
        console.log('Conectando...');
        // Asumimos id_sucursal = 1 (o la que tenga el usuario)
        const idSucursal = 1;

        // 1. Obtener caja abierta
        const cajaResult = await pool.query(
            `SELECT * FROM caja WHERE id_sucursal = $1 AND estado = 'ABIERTA' ORDER BY created_at DESC LIMIT 1`,
            [idSucursal]
        );

        if (cajaResult.rows.length === 0) {
            console.log('No hay caja abierta');
            return;
        }

        const caja = cajaResult.rows[0];
        console.log('Caja ID:', caja.id);

        // 2. Ejecutar consulta de detalle operaciones
        console.log('Ejecutando consulta detalle operaciones...');
        const detalleOperacionesResult = await pool.query(`
            SELECT 
                COALESCE(to2.codigo, 'OTRO') as tipo_codigo,
                COALESCE(to2.nombre, 'Otros') as tipo_nombre,
                COALESCE(SUM(CASE WHEN mp.codigo = 'CASH' THEN op.importe ELSE 0 END), 0) as efectivo,
                COALESCE(SUM(CASE WHEN mp.codigo != 'CASH' THEN op.importe ELSE 0 END), 0) as tarjeta,
                COALESCE(SUM(op.importe), 0) as total
            FROM ordenpago op
            JOIN mediopago mp ON op.id_medio_pago = mp.id
            JOIN orden o ON op.id_orden = o.id
            LEFT JOIN tipoorden to2 ON o.id_tipoorden = to2.id
            WHERE op.id_caja = $1
            GROUP BY to2.codigo, to2.nombre
            ORDER BY total DESC
        `, [caja.id]);

        console.log('Filas devueltas:', detalleOperacionesResult.rows.length);
        console.log(detalleOperacionesResult.rows);

    } catch (error) {
        console.error('ERROR:', error);
    } finally {
        pool.end();
    }
}

testCaja();
