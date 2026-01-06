/**
 * Fixtures: Datos de prueba para Pagos
 */

const mediosPago = {
    efectivo: {
        id: 1,
        codigo: 'CASH',
        nombre: 'Efectivo',
        activo: true
    },

    tarjeta: {
        id: 2,
        codigo: 'CARD',
        nombre: 'Tarjeta',
        activo: true
    },

    transferencia: {
        id: 3,
        codigo: 'TRANSFER',
        nombre: 'Transferencia',
        activo: true
    },

    cuentaCorriente: {
        id: 4,
        codigo: 'CC',
        nombre: 'Cuenta Corriente',
        activo: true
    }
};

const pagos = {
    // Pago válido en efectivo
    pagoEfectivo: {
        id: 1,
        id_orden: 1,
        id_medio_pago: 1,
        importe: 500.00,
        referencia: null,
        id_caja: 1,
        created_by: 1,
        created_at: new Date('2025-01-01')
    },

    // Pago con tarjeta
    pagoTarjeta: {
        id: 2,
        id_orden: 1,
        id_medio_pago: 2,
        importe: 750.00,
        referencia: 'TXN-123456',
        id_caja: 1,
        created_by: 1,
        created_at: new Date('2025-01-01')
    },

    // Pago a cuenta corriente
    pagoCuentaCorriente: {
        id: 3,
        id_orden: 2,
        id_medio_pago: 4,
        importe: 1000.00,
        referencia: 'CC-CLIENTE-001',
        id_caja: null,
        created_by: 1,
        created_at: new Date('2025-01-02')
    }
};

// Datos para registrar un nuevo pago
const registrarPagoData = {
    // Datos válidos completos
    valido: {
        medioPago: 'CASH',
        importe: 500.00,
        referencia: null,
        idCaja: 1,
        createdBy: 1
    },

    // Con código de medio de pago
    validoConCodigo: {
        medioPago: 'CARD',
        importe: 250.50,
        referencia: 'REF-001',
        idCaja: 1,
        createdBy: 1
    },

    // Con ID de medio de pago
    validoConId: {
        medioPago: 1,
        importe: 100.00,
        referencia: null,
        idCaja: 1,
        createdBy: 1
    },

    // Sin caja (debe auto-detectar)
    sinCaja: {
        medioPago: 'CASH',
        importe: 300.00,
        referencia: null,
        idCaja: null,
        createdBy: 1
    },

    // Importe inválido (cero)
    importeCero: {
        medioPago: 'CASH',
        importe: 0,
        referencia: null,
        idCaja: 1,
        createdBy: 1
    },

    // Importe inválido (negativo)
    importeNegativo: {
        medioPago: 'CASH',
        importe: -50.00,
        referencia: null,
        idCaja: 1,
        createdBy: 1
    },

    // Sin medio de pago
    sinMedioPago: {
        medioPago: null,
        importe: 500.00,
        idCaja: 1,
        createdBy: 1
    },

    // Medio de pago inexistente
    medioPagoInexistente: {
        medioPago: 'CRYPTO',
        importe: 500.00,
        idCaja: 1,
        createdBy: 1
    }
};

const cajas = {
    abierta: {
        id: 1,
        id_sucursal: 1,
        estado: 'ABIERTA',
        saldo_apertura: 1000.00,
        fecha_apertura: new Date('2025-01-01'),
        opened_by: 1
    },

    cerrada: {
        id: 2,
        id_sucursal: 1,
        estado: 'CERRADA',
        saldo_apertura: 500.00,
        saldo_cierre: 2500.00,
        fecha_apertura: new Date('2024-12-31'),
        fecha_cierre: new Date('2024-12-31'),
        opened_by: 1,
        closed_by: 1
    }
};

module.exports = {
    mediosPago,
    pagos,
    registrarPagoData,
    cajas
};
