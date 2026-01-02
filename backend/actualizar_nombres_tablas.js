/**
 * Script para actualizar nombres de tablas de facturación
 * De PascalCase con comillas a lowercase sin comillas
 */

const fs = require('fs');
const path = require('path');

const reemplazos = [
    { de: '"FacturaSerie"', a: 'facturaserie' },
    { de: '"FacturaConfigTenant"', a: 'facturaconfigtenant' },
    { de: '"FacturaCabecera"', a: 'facturacabecera' },
    { de: '"FacturaLinea"', a: 'facturalinea' },
    { de: '"FacturaPago"', a: 'facturapago' },
    { de: '"Sucursal"', a: 'sucursal' },
    { de: '"ClienteFinal"', a: 'clientefinal' },
    { de: '"Orden"', a: 'orden' },
    { de: '"Producto"', a: 'producto' },
    { de: '"Impuesto"', a: 'impuesto' },
    { de: '"MedioPago"', a: 'mediopago' },
    { de: '"OrdenLinea"', a: 'ordenlinea' },
    { de: '"OrdenPago"', a: 'ordenpago' },
    { de: '"Vehiculo"', a: 'vehiculo' },
    { de: '"Usuario"', a: 'usuario' },
    { de: '"EstadoOrden"', a: 'estadoorden' },
    { de: '"Tenant"', a: 'tenant' }
];

function actualizarArchivo(rutaArchivo) {
    try {
        let contenido = fs.readFileSync(rutaArchivo, 'utf-8');
        let cambios = 0;

        reemplazos.forEach(({ de, a }) => {
            const regex = new RegExp(de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            const matches = contenido.match(regex);
            if (matches) {
                cambios += matches.length;
                contenido = contenido.replace(regex, a);
            }
        });

        if (cambios > 0) {
            fs.writeFileSync(rutaArchivo, contenido, 'utf-8');
            console.log(`✓ ${path.basename(rutaArchivo)}: ${cambios} reemplazos`);
            return cambios;
        }

        return 0;
    } catch (error) {
        console.error(`Error en ${rutaArchivo}:`, error.message);
        return 0;
    }
}

function actualizarDirectorio(directorio) {
    let totalCambios = 0;

    const archivos = fs.readdirSync(directorio);

    archivos.forEach(archivo => {
        const rutaCompleta = path.join(directorio, archivo);
        const stats = fs.statSync(rutaCompleta);

        if (stats.isFile() && archivo.endsWith('.js')) {
            totalCambios += actualizarArchivo(rutaCompleta);
        }
    });

    return totalCambios;
}

console.log('Actualizando nombres de tablas en servicios y rutas...\n');

const directorios = [
    path.join(__dirname, 'services'),
    path.join(__dirname, 'routes')
];

let totalGeneral = 0;

directorios.forEach(dir => {
    console.log(`\nDirectorio: ${path.basename(dir)}`);
    console.log('='.repeat(60));
    const cambios = actualizarDirectorio(dir);
    totalGeneral += cambios;
});

console.log('\n' + '='.repeat(60));
console.log(`Total de reemplazos: ${totalGeneral}`);
console.log('✅ Actualización completada!');
