/**
 * Fixtures: Datos de prueba para Órdenes
 */

const ordenes = {
    // Orden válida completa
    ordenCompleta: {
        id: 1,
        id_sucursal: 1,
        id_cliente: 10,
        id_vehiculo: 5,
        total: 1500.00,
        subtotal: 1240.50,
        iva: 259.50,
        estado: 'EN_PROGRESO',
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-01')
    },

    // Orden sin sucursal asignada
    ordenSinSucursal: {
        id: 2,
        id_sucursal: null,
        id_cliente: 10,
        total: 500.00,
        estado: 'PENDIENTE'
    },

    // Orden pagada completamente
    ordenPagada: {
        id: 3,
        id_sucursal: 1,
        id_cliente: 11,
        total: 2000.00,
        total_pagado: 2000.00,
        estado: 'COMPLETADA'
    },

    // Orden con pago parcial
    ordenPagoParcial: {
        id: 4,
        id_sucursal: 1,
        id_cliente: 12,
        total: 1000.00,
        total_pagado: 400.00,
        saldo_pendiente: 600.00,
        estado: 'EN_PROGRESO'
    }
};

const lineasOrden = {
    // Línea de producto
    lineaProducto: {
        id: 1,
        id_orden: 1,
        tipo_item: 'PRODUCTO',
        id_producto: 100,
        descripcion: 'Aceite Motor 5W-30',
        cantidad: 2,
        precio_unitario: 25.00,
        descuento: 0,
        iva_porcentaje: 21,
        subtotal: 50.00,
        iva: 10.50,
        total: 60.50
    },

    // Línea de servicio (mano de obra)
    lineaServicio: {
        id: 2,
        id_orden: 1,
        tipo_item: 'SERVICIO',
        id_servicio: 50,
        descripcion: 'Cambio de aceite',
        cantidad: 1,
        precio_unitario: 30.00,
        descuento: 5,
        iva_porcentaje: 21,
        subtotal: 28.50,
        iva: 5.99,
        total: 34.49
    },

    // Línea con descuento
    lineaConDescuento: {
        id: 3,
        id_orden: 1,
        tipo_item: 'PRODUCTO',
        id_producto: 101,
        descripcion: 'Filtro de aire',
        cantidad: 1,
        precio_unitario: 100.00,
        descuento: 15,
        iva_porcentaje: 21,
        subtotal: 85.00,
        iva: 17.85,
        total: 102.85
    }
};

// Datos para crear una orden nueva
const crearOrdenData = {
    valida: {
        id_cliente: 10,
        id_vehiculo: 5,
        id_sucursal: 1,
        lineas: [
            {
                tipo_item: 'PRODUCTO',
                id_producto: 100,
                descripcion: 'Aceite Motor 5W-30',
                cantidad: 2,
                precio_unitario: 25.00,
                iva_porcentaje: 21
            }
        ]
    },

    sinCliente: {
        id_vehiculo: 5,
        id_sucursal: 1,
        lineas: []
    },

    sinLineas: {
        id_cliente: 10,
        id_vehiculo: 5,
        id_sucursal: 1,
        lineas: []
    }
};

module.exports = {
    ordenes,
    lineasOrden,
    crearOrdenData
};
