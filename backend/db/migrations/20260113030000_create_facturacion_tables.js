/**
 * Migration: create_facturacion_tables
 * Source: backend/migrations/create_facturacion_tables.sql (archived at backend/legacy/sql-migrations-archive/)
 * 
 * Creates invoicing system tables:
 * - facturaserie: invoice series numbering
 * - facturaconfigtenant: invoice design config per tenant
 * - facturacabecera: invoice headers
 * - facturalinea: invoice line items
 * - facturapago: invoice payments
 * Also adds requiere_factura and id_factura columns to orden table
 */

exports.up = async function (knex) {
    console.log('[Migration] Creating facturacion tables...');

    await knex.raw(`
        -- =====================================================
        -- 1. TABLA: facturaserie
        -- =====================================================
        CREATE TABLE IF NOT EXISTS facturaserie (
            id            BIGSERIAL PRIMARY KEY,
            id_sucursal   BIGINT NOT NULL REFERENCES sucursal(id) ON DELETE CASCADE,
            nombre_serie  TEXT   NOT NULL,
            prefijo       TEXT   NOT NULL,
            sufijo        TEXT   NULL,
            ultimo_numero BIGINT NOT NULL DEFAULT 0,
            tipo_documento TEXT NOT NULL DEFAULT 'FACTURA',
            activo        BOOLEAN NOT NULL DEFAULT true,
            es_por_defecto BOOLEAN NOT NULL DEFAULT false,
            creado_en     TIMESTAMPTZ NOT NULL DEFAULT now(),
            creado_por    BIGINT NULL REFERENCES usuario(id)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_facturaserie_sucursal_tipo_serie
        ON facturaserie(id_sucursal, tipo_documento, nombre_serie);

        CREATE UNIQUE INDEX IF NOT EXISTS ux_facturaserie_default
        ON facturaserie(id_sucursal, tipo_documento)
        WHERE es_por_defecto = true;

        COMMENT ON TABLE facturaserie IS 'Series de numeración de facturas por sucursal';

        -- =====================================================
        -- 2. TABLA: facturaconfigtenant
        -- =====================================================
        CREATE TABLE IF NOT EXISTS facturaconfigtenant (
            id              BIGSERIAL PRIMARY KEY,
            id_tenant       BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
            nombre_plantilla TEXT NOT NULL DEFAULT 'Por defecto',
            logo_url        TEXT NULL,
            color_primario  TEXT NOT NULL DEFAULT '#ff4400',
            cabecera_html   TEXT NULL,
            pie_html        TEXT NULL,
            texto_legal     TEXT NULL,
            mostrar_columna_iva          BOOLEAN NOT NULL DEFAULT true,
            mostrar_columna_descuento    BOOLEAN NOT NULL DEFAULT true,
            mostrar_domicilio_cliente    BOOLEAN NOT NULL DEFAULT true,
            mostrar_matricula_vehiculo   BOOLEAN NOT NULL DEFAULT true,
            config_json     JSONB NOT NULL DEFAULT '{}'::jsonb,
            es_por_defecto  BOOLEAN NOT NULL DEFAULT true,
            creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
            creado_por      BIGINT NULL REFERENCES usuario(id)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_facturaconfigtenant_default
        ON facturaconfigtenant(id_tenant)
        WHERE es_por_defecto = true;

        COMMENT ON TABLE facturaconfigtenant IS 'Configuración de diseño de facturas por tenant';

        -- =====================================================
        -- 3. TABLA: facturacabecera
        -- =====================================================
        CREATE TABLE IF NOT EXISTS facturacabecera (
            id             BIGSERIAL PRIMARY KEY,
            id_sucursal    BIGINT NOT NULL REFERENCES sucursal(id),
            id_cliente     BIGINT NOT NULL REFERENCES clientefinal(id),
            id_orden       BIGINT NULL REFERENCES orden(id),
            id_serie       BIGINT NOT NULL REFERENCES facturaserie(id),
            correlativo    BIGINT NOT NULL,
            numero_factura TEXT   NOT NULL,
            fecha_emision  DATE NOT NULL DEFAULT current_date,
            fecha_vencimiento DATE NULL,
            base_imponible NUMERIC(14,2) NOT NULL DEFAULT 0,
            importe_iva    NUMERIC(14,2) NOT NULL DEFAULT 0,
            total          NUMERIC(14,2) NOT NULL DEFAULT 0,
            estado         TEXT NOT NULL DEFAULT 'EMITIDA',
            observaciones  TEXT NULL,
            id_config_tenant BIGINT NULL REFERENCES facturaconfigtenant(id),
            config_snapshot JSONB NULL,
            pdf_url TEXT NULL,
            creado_por     BIGINT NOT NULL REFERENCES usuario(id),
            creado_en      TIMESTAMPTZ NOT NULL DEFAULT now()
        );

        CREATE UNIQUE INDEX IF NOT EXISTS ux_facturacabecera_serie_correlativo
        ON facturacabecera(id_serie, correlativo);

        CREATE UNIQUE INDEX IF NOT EXISTS ux_facturacabecera_numero
        ON facturacabecera(id_sucursal, numero_factura);

        CREATE UNIQUE INDEX IF NOT EXISTS ux_factura_por_orden
        ON facturacabecera(id_orden)
        WHERE id_orden IS NOT NULL;

        CREATE INDEX IF NOT EXISTS idx_facturacabecera_fecha_emision
        ON facturacabecera(fecha_emision DESC);

        CREATE INDEX IF NOT EXISTS idx_facturacabecera_estado
        ON facturacabecera(estado);

        CREATE INDEX IF NOT EXISTS idx_facturacabecera_cliente
        ON facturacabecera(id_cliente);

        COMMENT ON TABLE facturacabecera IS 'Cabecera de facturas emitidas';

        -- =====================================================
        -- 4. TABLA: facturalinea
        -- =====================================================
        CREATE TABLE IF NOT EXISTS facturalinea (
            id              BIGSERIAL PRIMARY KEY,
            id_factura      BIGINT NOT NULL REFERENCES facturacabecera(id) ON DELETE CASCADE,
            id_producto     BIGINT NULL REFERENCES producto(id),
            descripcion     TEXT   NOT NULL,
            cantidad        NUMERIC(12,3) NOT NULL,
            precio_unitario NUMERIC(14,4) NOT NULL,
            porcentaje_descuento NUMERIC(5,2) NOT NULL DEFAULT 0,
            base_imponible  NUMERIC(14,2) NOT NULL,
            importe_iva     NUMERIC(14,2) NOT NULL,
            total_linea     NUMERIC(14,2) NOT NULL,
            id_impuesto     BIGINT NULL REFERENCES impuesto(id),
            posicion        SMALLINT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_facturalinea_factura
        ON facturalinea(id_factura);

        COMMENT ON TABLE facturalinea IS 'Líneas de detalle de las facturas';

        -- =====================================================
        -- 5. TABLA: facturapago
        -- =====================================================
        CREATE TABLE IF NOT EXISTS facturapago (
            id           BIGSERIAL PRIMARY KEY,
            id_factura   BIGINT NOT NULL REFERENCES facturacabecera(id) ON DELETE CASCADE,
            id_orden_pago BIGINT NULL REFERENCES ordenpago(id),
            id_medio_pago BIGINT NOT NULL REFERENCES mediopago(id),
            importe      NUMERIC(14,2) NOT NULL,
            fecha_pago   DATE NOT NULL DEFAULT current_date,
            referencia_externa TEXT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_facturapago_factura
        ON facturapago(id_factura);

        COMMENT ON TABLE facturapago IS 'Registro de pagos asociados a facturas';

        -- =====================================================
        -- 6. ALTERACIÓN TABLA orden
        -- =====================================================
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='orden' AND column_name='requiere_factura'
            ) THEN
                ALTER TABLE orden
                ADD COLUMN requiere_factura BOOLEAN NOT NULL DEFAULT false;
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='orden' AND column_name='id_factura'
            ) THEN
                ALTER TABLE orden
                ADD COLUMN id_factura BIGINT NULL REFERENCES facturacabecera(id);
            END IF;
        END $$;

        COMMENT ON COLUMN orden.requiere_factura IS 'Indica si el cliente solicitó factura para esta orden';
        COMMENT ON COLUMN orden.id_factura IS 'Referencia a la factura generada, si existe';
    `);

    console.log('[Migration] ✅ Facturacion tables created');
};

exports.down = async function (knex) {
    console.log('[Migration] 🗑️ Dropping facturacion tables...');

    await knex.raw(`
        -- Remove columns from orden first (before dependencies)
        ALTER TABLE orden DROP COLUMN IF EXISTS id_factura;
        ALTER TABLE orden DROP COLUMN IF EXISTS requiere_factura;
        
        DROP TABLE IF EXISTS facturapago CASCADE;
        DROP TABLE IF EXISTS facturalinea CASCADE;
        DROP TABLE IF EXISTS facturacabecera CASCADE;
        DROP TABLE IF EXISTS facturaconfigtenant CASCADE;
        DROP TABLE IF EXISTS facturaserie CASCADE;
    `);

    console.log('[Migration] ✅ Facturacion tables dropped');
};

exports.config = { transaction: true };
