/**
 * Fixtures: Datos de prueba para Productos e Inventario
 */

const productos = {
    // Producto con stock disponible
    productoConStock: {
        id: 100,
        codigo_barras: '7501234567890',
        nombre: 'Aceite Motor 5W-30',
        descripcion: 'Aceite sintético para motor',
        precio_venta: 25.00,
        precio_compra: 15.00,
        stock_actual: 50,
        stock_minimo: 10,
        id_categoria: 1,
        iva_porcentaje: 21,
        activo: true,
        tenant_id: 1
    },

    // Producto con stock bajo
    productoStockBajo: {
        id: 101,
        codigo_barras: '7501234567891',
        nombre: 'Filtro de Aire',
        descripcion: 'Filtro de aire universal',
        precio_venta: 80.00,
        precio_compra: 45.00,
        stock_actual: 5,
        stock_minimo: 10,
        id_categoria: 1,
        iva_porcentaje: 21,
        activo: true,
        tenant_id: 1
    },

    // Producto sin stock
    productoSinStock: {
        id: 102,
        codigo_barras: '7501234567892',
        nombre: 'Bujía NGK',
        descripcion: 'Bujía de encendido',
        precio_venta: 12.00,
        precio_compra: 6.00,
        stock_actual: 0,
        stock_minimo: 20,
        id_categoria: 2,
        iva_porcentaje: 21,
        activo: true,
        tenant_id: 1
    },

    // Producto inactivo
    productoInactivo: {
        id: 103,
        codigo_barras: '7501234567893',
        nombre: 'Producto Descontinuado',
        descripcion: 'Ya no se vende',
        precio_venta: 50.00,
        precio_compra: 30.00,
        stock_actual: 10,
        stock_minimo: 5,
        id_categoria: 1,
        iva_porcentaje: 21,
        activo: false,
        tenant_id: 1
    }
};

const movimientosInventario = {
    // Movimiento de entrada (compra)
    entradaCompra: {
        id: 1,
        id_producto: 100,
        tipo: 'ENTRADA',
        cantidad: 20,
        motivo: 'COMPRA',
        referencia: 'COMPRA-001',
        created_by: 1,
        created_at: new Date('2025-01-01')
    },

    // Movimiento de salida (venta)
    salidaVenta: {
        id: 2,
        id_producto: 100,
        tipo: 'SALIDA',
        cantidad: 5,
        motivo: 'VENTA',
        referencia: 'ORDEN-001',
        created_by: 1,
        created_at: new Date('2025-01-02')
    },

    // Ajuste de inventario (positivo)
    ajustePositivo: {
        id: 3,
        id_producto: 101,
        tipo: 'ENTRADA',
        cantidad: 3,
        motivo: 'AJUSTE',
        referencia: 'AJUSTE-INVENTARIO-001',
        created_by: 1,
        created_at: new Date('2025-01-03')
    },

    // Ajuste de inventario (negativo)
    ajusteNegativo: {
        id: 4,
        id_producto: 102,
        tipo: 'SALIDA',
        cantidad: 2,
        motivo: 'AJUSTE',
        referencia: 'AJUSTE-INVENTARIO-002',
        created_by: 1,
        created_at: new Date('2025-01-03')
    }
};

const categorias = {
    lubricantes: {
        id: 1,
        nombre: 'Lubricantes',
        descripcion: 'Aceites y lubricantes'
    },

    electricidad: {
        id: 2,
        nombre: 'Electricidad',
        descripcion: 'Componentes eléctricos'
    },

    frenos: {
        id: 3,
        nombre: 'Frenos',
        descripcion: 'Sistema de frenos'
    }
};

// Datos para crear un nuevo producto
const crearProductoData = {
    valido: {
        codigo_barras: '7501234567899',
        nombre: 'Nuevo Producto',
        descripcion: 'Descripción del producto',
        precio_venta: 100.00,
        precio_compra: 60.00,
        stock_actual: 25,
        stock_minimo: 5,
        id_categoria: 1,
        iva_porcentaje: 21
    },

    sinPrecioVenta: {
        codigo_barras: '7501234567898',
        nombre: 'Producto Sin Precio',
        precio_compra: 60.00,
        stock_actual: 10
    },

    codigoDuplicado: {
        codigo_barras: '7501234567890', // Ya existe
        nombre: 'Otro Producto',
        precio_venta: 50.00
    }
};

module.exports = {
    productos,
    movimientosInventario,
    categorias,
    crearProductoData
};
