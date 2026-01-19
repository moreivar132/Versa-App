-- Tabla principal de ventas
CREATE TABLE IF NOT EXISTS venta (
    id SERIAL PRIMARY KEY,
    id_tenant INTEGER NOT NULL,
    id_sucursal INTEGER NOT NULL REFERENCES sucursal(id),
    id_cliente INTEGER NOT NULL REFERENCES clientefinal(id),
    id_caja INTEGER REFERENCES caja(id),
    fecha TIMESTAMP DEFAULT NOW(),
    total_bruto NUMERIC(12,2) DEFAULT 0,
    total_descuento NUMERIC(12,2) DEFAULT 0,
    total_iva NUMERIC(12,2) DEFAULT 0,
    total_neto NUMERIC(12,2) DEFAULT 0,
    estado VARCHAR(20) DEFAULT 'COMPLETADA', -- COMPLETADA, ANULADA
    observaciones TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by INTEGER
);

-- Tabla de líneas/items de venta
CREATE TABLE IF NOT EXISTS ventalinea (
    id SERIAL PRIMARY KEY,
    id_venta INTEGER NOT NULL REFERENCES venta(id) ON DELETE CASCADE,
    id_producto INTEGER REFERENCES producto(id),
    descripcion VARCHAR(255) NOT NULL,
    cantidad NUMERIC(10,2) NOT NULL,
    precio NUMERIC(12,2) NOT NULL,
    descuento NUMERIC(5,2) DEFAULT 0,
    iva_porcentaje NUMERIC(5,2) DEFAULT 0,
    iva_monto NUMERIC(12,2) DEFAULT 0,
    subtotal NUMERIC(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabla de pagos de venta
CREATE TABLE IF NOT EXISTS ventapago (
    id SERIAL PRIMARY KEY,
    id_venta INTEGER NOT NULL REFERENCES venta(id) ON DELETE CASCADE,
    id_medio_pago INTEGER NOT NULL REFERENCES mediopago(id),
    id_caja INTEGER REFERENCES caja(id),
    importe NUMERIC(12,2) NOT NULL,
    referencia VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    created_by INTEGER
);

-- Índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_venta_tenant ON venta(id_tenant);
CREATE INDEX IF NOT EXISTS idx_venta_sucursal ON venta(id_sucursal);
CREATE INDEX IF NOT EXISTS idx_venta_cliente ON venta(id_cliente);
CREATE INDEX IF NOT EXISTS idx_venta_fecha ON venta(fecha);
CREATE INDEX IF NOT EXISTS idx_ventalinea_venta ON ventalinea(id_venta);
CREATE INDEX IF NOT EXISTS idx_ventapago_venta ON ventapago(id_venta);
