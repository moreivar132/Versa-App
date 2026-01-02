const pool = require('./db');
const fs = require('fs');

async function debug() {
    try {
        const cajaId = 6; // Caja de sucursal 2

        let output = `=== DEBUG CAJA ${cajaId} ===\n\n`;

        // 1. Pagos de ordenes
        const pagos = await pool.query(`
            SELECT mp.codigo, SUM(op.importe) as total
            FROM ordenpago op
            JOIN mediopago mp ON op.id_medio_pago = mp.id
            WHERE op.id_caja = $1
            GROUP BY mp.codigo
        `, [cajaId]);
        output += '1. PAGOS DE ORDENES:\n';
        let efectivoPagos = 0, tarjetaPagos = 0;
        pagos.rows.forEach(p => {
            output += `  ${p.codigo}: ${p.total}\n`;
            if (p.codigo === 'CASH') efectivoPagos = parseFloat(p.total);
            else tarjetaPagos += parseFloat(p.total);
        });
        output += `  => efectivoPagos = ${efectivoPagos}, tarjetaPagos = ${tarjetaPagos}\n\n`;

        // 2. Movimientos de caja (por tipo y método)
        const movs = await pool.query(`
            SELECT 
                cm.tipo,
                COALESCE(SUM(CASE WHEN mp.codigo = 'CASH' OR mp.codigo IS NULL THEN cm.monto ELSE 0 END), 0) as total_efectivo,
                COALESCE(SUM(CASE WHEN mp.codigo IN ('CARD', 'TRANSFER') THEN cm.monto ELSE 0 END), 0) as total_tarjeta,
                COALESCE(SUM(cm.monto), 0) as total
            FROM cajamovimiento cm
            LEFT JOIN mediopago mp ON cm.id_medio_pago = mp.id
            WHERE cm.id_caja = $1
            GROUP BY cm.tipo
        `, [cajaId]);
        output += '2. MOVIMIENTOS DE CAJA:\n';
        let totalIngresosEfectivo = 0, totalIngresosTarjeta = 0, totalIngresos = 0, totalEgresos = 0;
        movs.rows.forEach(m => {
            output += `  ${m.tipo}: efectivo=${m.total_efectivo}, tarjeta=${m.total_tarjeta}, total=${m.total}\n`;
            if (m.tipo === 'INGRESO') {
                totalIngresosEfectivo = parseFloat(m.total_efectivo);
                totalIngresosTarjeta = parseFloat(m.total_tarjeta);
                totalIngresos = parseFloat(m.total);
            } else if (m.tipo === 'EGRESO') {
                totalEgresos = parseFloat(m.total);
            }
        });
        output += `  => totalIngresosEfectivo=${totalIngresosEfectivo}, totalIngresosTarjeta=${totalIngresosTarjeta}\n`;
        output += `  => totalEgresos=${totalEgresos}\n\n`;

        // 3. Compras (egresos adicionales)
        output += '3. COMPRAS:\n';
        // No las consultamos porque no tenemos la fecha de creación de caja aquí
        output += '  (omitido en este test)\n\n';

        // 4. Cálculos finales
        output += '4. CÁLCULOS:\n';
        const saldoApertura = 50; // Según la imagen
        output += `  Saldo apertura: ${saldoApertura}\n`;
        output += `  Ingresos efectivo (cabecera) = efectivoPagos + totalIngresosEfectivo = ${efectivoPagos} + ${totalIngresosEfectivo} = ${efectivoPagos + totalIngresosEfectivo}\n`;
        output += `  Tarjeta/Transf (cabecera) = tarjetaPagos + totalIngresosTarjeta = ${tarjetaPagos} + ${totalIngresosTarjeta} = ${tarjetaPagos + totalIngresosTarjeta}\n`;

        fs.writeFileSync('debug-output.txt', output);
        console.log('Guardado');
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        pool.end();
    }
}
debug();
