exports.up = async function (knex) {
    // -------------------------------------------------------------------------
    // 1) EXTENSIONS & FUNCTIONS
    // -------------------------------------------------------------------------
    // Re-creating required helper functions found in triggers/policies audit.
    await knex.raw(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    -- Time update helpers
    CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
    BEGIN
       NEW.updated_at = now();
       RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION update_timestamp() RETURNS TRIGGER AS $$
    BEGIN
       NEW.updated_at = now();
       RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE OR REPLACE FUNCTION update_dashboard_prefs_updated_at() RETURNS TRIGGER AS $$
    BEGIN
       NEW.last_updated = now();
       RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- RLS Helpers (Standard Implementation)
    CREATE OR REPLACE FUNCTION app_current_tenant() RETURNS varchar AS $$
      SELECT current_setting('app.current_tenant', true)::varchar;
    $$ LANGUAGE sql STABLE;

    CREATE OR REPLACE FUNCTION app_is_superadmin() RETURNS boolean AS $$
      SELECT current_setting('app.is_superadmin', true)::boolean;
    $$ LANGUAGE sql STABLE;
  `);

    // -------------------------------------------------------------------------
    // 3) TABLES (BASE & STRUCTURE)
    // Creating columns first. FK Constraints are added in step 4 to allow cycles.
    // -------------------------------------------------------------------------

    await knex.schema.createTable('accounting_adjunto', (table) => {
        table.increments('id').primary();
        table.integer('id_tenant').notNullable();
        table.integer('id_empresa').notNullable();
        table.string('entity_type', 255).notNullable();
        table.integer('entity_id').notNullable();
        table.string('storage_key', 255);
        table.text('file_url');
        table.string('mime_type', 255);
        table.integer('size_bytes');
        table.string('original_name', 255);
        table.integer('created_by');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('accounting_audit_log', (table) => {
        table.bigIncrements('id').primary();
        table.integer('id_tenant').notNullable();
        table.integer('id_empresa').notNullable();
        table.string('action', 255).notNullable();
        table.string('entity_type', 255).notNullable();
        table.integer('entity_id').notNullable();
        table.jsonb('changed_data');
        table.integer('performed_by');
        table.timestamp('performed_at', { useTz: true }).defaultTo(knex.fn.now());
        table.specificType('ip_address', 'inet');
        table.text('user_agent');
    });

    await knex.schema.createTable('accounting_category', (table) => {
        table.increments('id').primary();
        table.string('code', 255).notNullable();
        table.string('name', 255).notNullable();
        table.string('type', 255).notNullable();
        table.integer('parent_id');
        table.integer('id_tenant').notNullable();
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('accounting_cuenta_tesoreria', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('id_empresa').notNullable();
        table.string('nombre', 255).notNullable();
        table.string('tipo', 255).notNullable();
        table.string('moneda', 255).notNullable().defaultTo('EUR');
        table.decimal('saldo_actual', null, null).notNullable().defaultTo(0);
        table.string('numero_cuenta', 255);
        table.string('banco', 255);
        table.string('swift_bic', 255);
        table.integer('created_by');
        table.timestamp('last_synced_at', { useTz: true });
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('accounting_empresa', (table) => {
        table.bigIncrements('id').primary();
        table.integer('id_tenant').notNullable();
        table.string('nombre_fiscal', 255).notNullable();
        table.string('nif', 255).notNullable();
        table.text('direccion');
        table.string('ciudad', 255);
        table.string('codigo_postal', 255);
        table.string('pais', 255).defaultTo('ES');
        table.string('telefono', 255);
        table.string('email', 255);
        table.string('moneda_principal', 255).defaultTo('EUR');
        table.integer('created_by');
        table.integer('updated_by');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('accounting_gasto_documento', (table) => {
        table.increments('id').primary();
        table.string('source_id', 255).notNullable();
        table.string('source_type', 255).notNullable();
        table.string('external_reference', 255);
        table.string('status', 255).notNullable().defaultTo('pending');
        table.jsonb('raw_data');
        table.jsonb('processed_data');
        table.text('error_message');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('accounting_intake', (table) => {
        table.increments('id').primary();
        table.string('source_type', 255).notNullable();
        table.string('status', 255).notNullable().defaultTo('pending');
        table.jsonb('raw_payload').notNullable();
        table.jsonb('processed_payload');
        table.text('error_log');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('accounting_pago', (table) => {
        table.increments('id').primary();
        table.decimal('monto', null, null).notNullable();
        table.string('moneda', 255).notNullable().defaultTo('EUR');
        table.date('fecha_pago').notNullable().defaultTo(knex.raw('CURRENT_DATE'));
        table.string('metodo_pago', 255);
        table.string('referencia_pago', 255);
        table.string('estado', 255).notNullable().defaultTo('completed');
        table.text('notas');
        table.integer('id_factura');
        table.bigInteger('id_cuenta_tesoreria');
        table.bigInteger('id_transaccion');
        table.integer('created_by');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('accounting_transaccion', (table) => {
        table.bigIncrements('id').primary();
        table.bigInteger('id_cuenta_tesoreria').notNullable();
        table.date('fecha').notNullable();
        table.text('descripcion').notNullable();
        table.decimal('monto', null, null).notNullable();
        table.string('tipo', 255).notNullable();
        table.string('estado', 255).notNullable().defaultTo('posted');
        table.string('categoria', 255);
        table.string('referencia_externa', 255);
        table.integer('id_entidad_origen');
        table.string('tipo_entidad_origen', 255);
        table.integer('created_by');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('accounting_usuario_empresa', (table) => {
        table.bigIncrements('id').primary();
        table.integer('id_usuario').notNullable();
        table.bigInteger('id_empresa').notNullable();
        table.string('rol', 255).notNullable().defaultTo('viewer');
        table.integer('assigned_by');
        table.timestamp('assigned_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('almacen', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.string('ubicacion', 255);
        table.integer('capacidad');
        table.integer('id_sucursal');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('archivo', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.string('ruta', 255).notNullable();
        table.string('tipo_mime', 100);
        table.integer('tamanho');
        table.string('entidad_tipo', 50);
        table.integer('entidad_id');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('bank_account', (table) => {
        table.increments('id').primary();
        table.integer('connection_id');
        table.string('account_id', 255).notNullable();
        table.string('name', 255).notNullable();
        table.string('currency', 255).notNullable();
        table.string('type', 255);
        table.decimal('balance', null, null);
        table.timestamp('last_synced_at', { useTz: true });
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('bank_connection', (table) => {
        table.increments('id').primary();
        table.string('institution_id', 255).notNullable();
        table.text('access_token').notNullable();
        table.string('status', 255).notNullable().defaultTo('active');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('bank_reconciliation_rule', (table) => {
        table.increments('id').primary();
        table.string('condition_field', 255).notNullable();
        table.string('condition_operator', 255).notNullable();
        table.string('condition_value', 255).notNullable();
        table.integer('action_category_id').notNullable();
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('bank_transaction', (table) => {
        table.increments('id').primary();
        table.integer('account_id');
        table.string('transaction_id', 255).notNullable();
        table.decimal('amount', null, null).notNullable();
        table.date('date').notNullable();
        table.text('description');
        table.string('category', 255);
        table.string('status', 255).notNullable().defaultTo('pending');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.jsonb('raw_data');
    });

    await knex.schema.createTable('caja', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.decimal('saldo', null, null).defaultTo(0);
        table.integer('id_sucursal');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.string('estado', 20).defaultTo('cerrada');
        table.integer('usuario_apertura_id');
        table.timestamp('fecha_apertura', { useTz: false });
        table.decimal('saldo_inicial', 10, 2).defaultTo(0.00);
    });

    await knex.schema.createTable('cajachica', (table) => {
        table.increments('id').primary();
        table.string('descripcion', 255).notNullable();
        table.decimal('monto', null, null).notNullable();
        table.timestamp('fecha', { useTz: false }).notNullable();
        table.string('tipo', 255).notNullable();
        table.integer('id_sucursal');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('categoria', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.text('descripcion');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('clientefinal', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.string('apellido', 255);
        table.string('email', 255);
        table.string('telefono', 255);
        table.text('direccion');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.string('dni', 20);
        table.string('empresa', 100);
        table.text('notas');
    });

    await knex.schema.createTable('configuracion', (table) => {
        table.increments('id').primary();
        table.string('clave', 255).notNullable().unique();
        table.text('valor').notNullable();
        table.text('descripcion');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('contabilidad_contacto', (table) => {
        table.increments('id').primary();
        table.string('type', 50).notNullable();
        table.string('name', 255).notNullable();
        table.string('tax_id', 50);
        table.text('address');
        table.string('email', 255);
        table.string('phone', 50);
        table.integer('id_tenant').notNullable();
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('contabilidad_factura', (table) => {
        table.increments('id').primary();
        table.string('type', 50).notNullable();
        table.string('number', 50).notNullable();
        table.date('date').notNullable();
        table.date('due_date');
        table.integer('contact_id');
        table.string('status', 50).defaultTo('draft');
        table.decimal('total_amount', 15, 2).notNullable().defaultTo(0.00);
        table.decimal('tax_amount', 15, 2).defaultTo(0.00);
        table.string('currency', 10).defaultTo('EUR');
        table.text('notes');
        table.integer('id_tenant').notNullable();
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('contabilidad_trimestre', (table) => {
        table.increments('id').primary();
        table.integer('year').notNullable();
        table.integer('quarter').notNullable();
        table.string('status', 50).defaultTo('open');
        table.date('start_date').notNullable();
        table.date('end_date').notNullable();
        table.integer('id_tenant').notNullable();
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('contable_bill', (table) => {
        table.increments('id').primary();
        table.string('vendor_name', 255);
        table.decimal('amount', null, null).notNullable();
        table.date('date').notNullable();
        table.string('status', 255).defaultTo('pending');
        table.date('due_date');
        table.integer('category_id');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('contable_category', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.string('type', 255).notNullable();
        table.text('description');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('cuentacorriente', (table) => {
        table.increments('id').primary();
        table.decimal('saldo', null, null).defaultTo(0);
        table.decimal('limite_credito', null, null);
        table.integer('id_cliente');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('empresa', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.text('direccion');
        table.string('telefono', 255);
        table.string('email', 255);
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('inventory_movement', (table) => {
        table.increments('id').primary();
        table.integer('product_id').notNullable();
        table.string('type', 255).notNullable();
        table.integer('quantity').notNullable();
        table.integer('previous_stock').notNullable();
        table.integer('new_stock').notNullable();
        table.text('reason');
        table.string('reference_id', 255);
        table.string('reference_type', 255);
        table.integer('performed_by');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.integer('id_sucursal');
    });

    await knex.schema.createTable('marketplace_listing', (table) => {
        table.increments('id').primary();
        table.string('title', 255).notNullable();
        table.text('description').notNullable();
        table.decimal('price', null, null).notNullable();
        table.string('status', 255).defaultTo('active');
        table.integer('seller_id');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('mediopago', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.boolean('activo').defaultTo(true);
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('movimientocaja', (table) => {
        table.increments('id').primary();
        table.string('tipo', 255).notNullable();
        table.decimal('monto', null, null).notNullable();
        table.timestamp('fecha', { useTz: false }).notNullable();
        table.text('descripcion');
        table.integer('id_caja');
        table.integer('id_usuario');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.integer('id_venta');
        table.string('metodo_pago', 50);
        table.boolean('es_cierre').defaultTo(false);
    });

    await knex.schema.createTable('negocio', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.string('tipo', 255);
        table.integer('id_empresa');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('orden_trabajo', (table) => {
        table.increments('id').primary();
        table.text('numero_orden').notNullable().unique();
        table.integer('id_cliente').notNullable();
        table.integer('id_vehiculo').notNullable();
        table.timestamp('fecha_ingreso', { useTz: true }).notNullable().defaultTo(knex.fn.now());
        table.timestamp('fecha_entrega_estimada', { useTz: true });
        table.text('descripcion_problema').notNullable();
        table.text('estado').notNullable().defaultTo('pendiente');
        table.text('prioridad').notNullable().defaultTo('media');
        table.integer('id_tecnico_asignado');
        table.integer('kilometraje_actual');
        table.text('nivel_combustible');
        table.text('notas_internas');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
        table.integer('id_sucursal');
        table.decimal('costo_estimado', 10, 2);
        table.decimal('deposito_adelantado', 10, 2).defaultTo(0.00);
        table.jsonb('items_servicio').defaultTo('[]');
        table.jsonb('historial_estados').defaultTo('[]');
        table.jsonb('adjuntos').defaultTo('[]');
        table.text('id_tenant').notNullable();
    });

    await knex.schema.createTable('pago', (table) => {
        table.increments('id').primary();
        table.decimal('monto', null, null).notNullable();
        table.timestamp('fecha', { useTz: false }).notNullable();
        table.integer('id_medio_pago');
        table.integer('id_venta');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('permiso', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.text('descripcion');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('plan_suscripcion', (table) => {
        table.increments('id').primary();
        table.string('code', 255).notNullable();
        table.string('name', 255).notNullable();
        table.text('description');
        table.decimal('price_monthly', null, null).notNullable();
        table.decimal('price_yearly', null, null).notNullable();
        table.jsonb('features');
        table.jsonb('limits');
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('producto', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.text('descripcion');
        table.decimal('precio', null, null).notNullable();
        table.integer('stock').defaultTo(0);
        table.string('sku', 255);
        table.integer('id_categoria');
        table.integer('id_proveedor');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.string('tipo', 20).defaultTo('producto');
        table.integer('stock_minimo').defaultTo(0);
        table.string('codigo_barras', 50);
        table.decimal('costo', 10, 2).defaultTo(0.00);
        table.string('ubicacion', 100);
        table.text('imagen_url');
        table.integer('id_impuesto');
        table.boolean('permite_stock_negativo').defaultTo(false);
        table.boolean('activo').defaultTo(true);
    });

    await knex.schema.createTable('proveedor', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.string('contacto', 255);
        table.string('telefono', 255);
        table.string('email', 255);
        table.text('direccion');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.string('nif', 20);
        table.string('sitio_web', 255);
        table.text('notas');
        table.boolean('activo').defaultTo(true);
    });

    await knex.schema.createTable('rol', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.text('descripcion');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('services', (table) => {
        table.increments('id').primary();
        table.string('name', 255).notNullable();
        table.text('description');
        table.decimal('price', 10, 2).notNullable().defaultTo(0.00);
        table.integer('duration_minutes').notNullable().defaultTo(60);
        table.boolean('is_active').defaultTo(true);
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.text('id_tenant').notNullable();
    });

    await knex.schema.createTable('sucursal', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.text('direccion');
        table.string('telefono', 255);
        table.integer('id_empresa');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.string('ciudad', 100);
        table.string('codigo_postal', 20);
        table.string('pais', 50);
        table.string('email_contacto', 150);
        table.specificType('horaria_apertura', 'time');
        table.specificType('horario_cierre', 'time');
        table.boolean('activa').defaultTo(true);
    });

    await knex.schema.createTable('tenant', (table) => {
        table.increments('id').primary();
        table.string('nombre', 100).notNullable();
        table.string('plan', 50).defaultTo('free');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
        table.jsonb('settings');
        table.string('status', 20).defaultTo('active');
        table.integer('owner_id');
    });

    await knex.schema.createTable('tenant_suscripcion', (table) => {
        table.increments('id').primary();
        table.integer('id_tenant').notNullable();
        table.integer('plan_id').notNullable();
        table.string('status', 255).notNullable().defaultTo('active');
        table.timestamp('start_date', { useTz: true }).notNullable();
        table.timestamp('end_date', { useTz: true });
        table.timestamp('renewal_date', { useTz: true });
        table.string('payment_method_id', 255);
        table.jsonb('subscription_metadata');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('user_dashboard_prefs', (table) => {
        table.bigIncrements('id').primary();
        table.integer('id_usuario').notNullable();
        table.integer('id_tenant').notNullable();
        table.jsonb('layout_config').defaultTo('{}');
        table.jsonb('visible_widgets').defaultTo('[]');
        table.string('theme_preference', 20).defaultTo('system');
        table.integer('refresh_interval').defaultTo(300);
        table.jsonb('favorite_reports').defaultTo('[]');
        table.timestamp('last_updated', { useTz: true }).defaultTo(knex.fn.now());
        table.unique(['id_usuario', 'id_tenant']);
    });

    await knex.schema.createTable('user_permission_override', (table) => {
        table.increments('id').primary();
        table.integer('user_id').notNullable();
        table.string('permission', 255).notNullable();
        table.boolean('is_granted').notNullable();
        table.integer('id_tenant');
    });

    await knex.schema.createTable('usuario', (table) => {
        table.increments('id').primary();
        table.string('nombre', 255).notNullable();
        table.string('email', 255).notNullable().unique();
        table.string('password', 255).notNullable();
        table.integer('id_rol');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.boolean('must_change_password').defaultTo(false);
        table.timestamp('last_login_at', { useTz: true });
        table.integer('login_attempts').defaultTo(0);
        table.timestamp('locked_until', { useTz: true });
        table.string('status', 20).defaultTo('active');
        table.text('avatar_url');
        table.jsonb('preferences').defaultTo('{}');
    });

    await knex.schema.createTable('usuario_sucursal', (table) => {
        table.increments('id').primary();
        table.integer('id_usuario');
        table.integer('id_sucursal');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('vehiculo', (table) => {
        table.increments('id').primary();
        table.string('marca', 255).notNullable();
        table.string('modelo', 255).notNullable();
        table.integer('anio');
        table.string('placa', 255);
        table.string('color', 255);
        table.integer('id_cliente');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.string('vin', 50);
        table.integer('kilometraje').defaultTo(0);
        table.string('tipo_combustible', 20);
        table.string('transmision', 20);
        table.text('notas');
        table.integer('created_by');
    });

    await knex.schema.createTable('venta', (table) => {
        table.increments('id').primary();
        table.timestamp('fecha', { useTz: false }).notNullable();
        table.decimal('total', null, null).notNullable();
        table.integer('id_cliente');
        table.integer('id_usuario');
        table.integer('id_sucursal');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.integer('id_caja');
        table.string('estado', 20).defaultTo('completada');
        table.decimal('subtotal', 10, 2);
        table.decimal('impuestos', 10, 2);
        table.text('notas');
        table.integer('id_cuenta_corriente');
    });

    await knex.schema.createTable('ventalinea', (table) => {
        table.increments('id').primary();
        table.integer('id_venta');
        table.integer('id_producto');
        table.integer('cantidad').notNullable();
        table.decimal('precio_unitario', null, null).notNullable();
        table.decimal('subtotal', null, null).notNullable();
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
    });

    await knex.schema.createTable('ventapago', (table) => {
        table.increments('id').primary();
        table.integer('id_venta');
        table.integer('id_medio_pago');
        table.decimal('monto', 10, 2).notNullable();
        table.string('referencia', 100);
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.integer('id_tenant');
        table.integer('id_caja');
    });

    await knex.schema.createTable('vertical', (table) => {
        table.increments('id').primary();
        table.string('key', 255).notNullable().unique();
        table.string('name', 255).notNullable();
        table.text('description');
        table.boolean('is_active').defaultTo(true);
        table.jsonb('config_schema');
        table.timestamp('created_at', { useTz: true }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: true }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('whatsapp_chats', (table) => {
        table.increments('id').primary();
        table.string('chat_id', 255).notNullable().unique();
        table.string('phone', 255).notNullable();
        table.string('name', 255);
        table.text('last_message');
        table.integer('unread_count').defaultTo(0);
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
        table.timestamp('updated_at', { useTz: false }).defaultTo(knex.fn.now());
    });

    await knex.schema.createTable('whatsapp_messages', (table) => {
        table.increments('id').primary();
        table.string('chat_id', 255).notNullable();
        table.string('phone', 255).notNullable();
        table.text('message_text').notNullable();
        table.string('sender_type', 255).notNullable();
        table.string('sender_name', 255);
        table.string('status', 255).defaultTo('sent');
        table.string('timelines_message_id', 255);
        table.jsonb('metadata');
        table.timestamp('created_at', { useTz: false }).defaultTo(knex.fn.now());
    });

    // -------------------------------------------------------------------------
    // 4) FOREIGN KEYS (Massive Block to avoid Cycles)
    // -------------------------------------------------------------------------
    // We use knex.schema.alterTable for each table to add FKs.

    await knex.schema.alterTable('accounting_adjunto', (table) => {
        table.foreign('created_by').references('id').inTable('usuario');
    });
    await knex.schema.alterTable('accounting_audit_log', (table) => {
        table.foreign('performed_by').references('id').inTable('usuario');
        table.foreign('id_tenant').references('id').inTable('tenant');
        table.foreign('id_empresa').references('id').inTable('accounting_empresa');
    });
    await knex.schema.alterTable('accounting_category', (table) => {
        table.foreign('id_tenant').references('id').inTable('tenant');
        table.foreign('parent_id').references('id').inTable('accounting_category');
        table.unique(['id_tenant', 'code'], { indexName: 'ux_accounting_category_code' });
    });
    await knex.schema.alterTable('accounting_cuenta_tesoreria', (table) => {
        table.foreign('id_empresa').references('id').inTable('accounting_empresa');
        table.foreign('created_by').references('id').inTable('usuario');
    });
    await knex.schema.alterTable('accounting_empresa', (table) => {
        table.foreign('created_by').references('id').inTable('usuario');
        table.foreign('updated_by').references('id').inTable('usuario');
    });
    await knex.schema.alterTable('accounting_pago', (table) => {
        table.foreign('created_by').references('id').inTable('usuario');
        table.foreign('id_cuenta_tesoreria').references('id').inTable('accounting_cuenta_tesoreria');
        table.foreign('id_factura').references('id').inTable('contabilidad_factura');
        table.foreign('id_transaccion').references('id').inTable('accounting_transaccion');
    });
    await knex.schema.alterTable('accounting_transaccion', (table) => {
        table.foreign('created_by').references('id').inTable('usuario');
        table.foreign('id_cuenta_tesoreria').references('id').inTable('accounting_cuenta_tesoreria');
    });
    await knex.schema.alterTable('accounting_usuario_empresa', (table) => {
        table.foreign('id_empresa').references('id').inTable('accounting_empresa');
        table.foreign('id_usuario').references('id').inTable('usuario');
        table.foreign('assigned_by').references('id').inTable('usuario');
    });
    await knex.schema.alterTable('almacen', (table) => {
        table.foreign('id_sucursal').references('id').inTable('sucursal');
    });
    await knex.schema.alterTable('bank_account', (table) => {
        table.foreign('connection_id').references('id').inTable('bank_connection');
        table.unique('account_id');
    });
    await knex.schema.alterTable('bank_connection', (table) => {
        table.unique('institution_id');
    });
    await knex.schema.alterTable('bank_transaction', (table) => {
        table.foreign('account_id').references('id').inTable('bank_account');
        table.unique('transaction_id');
    });
    await knex.schema.alterTable('caja', (table) => {
        table.foreign('id_sucursal').references('id').inTable('sucursal');
    });
    await knex.schema.alterTable('cajachica', (table) => {
        table.foreign('id_sucursal').references('id').inTable('sucursal');
    });
    await knex.schema.alterTable('contabilidad_factura', (table) => {
        table.foreign('contact_id').references('id').inTable('contabilidad_contacto');
        table.unique(['number', 'id_tenant']);
    });
    await knex.schema.alterTable('contable_bill', (table) => {
        table.foreign('category_id').references('id').inTable('contable_category');
    });
    await knex.schema.alterTable('cuentacorriente', (table) => {
        table.foreign('id_cliente').references('id').inTable('clientefinal');
    });
    await knex.schema.alterTable('inventory_movement', (table) => {
        table.foreign('id_sucursal').references('id').inTable('sucursal');
        table.foreign('performed_by').references('id').inTable('usuario');
        table.foreign('product_id').references('id').inTable('producto');
    });
    await knex.schema.alterTable('marketplace_listing', (table) => {
        table.foreign('seller_id').references('id').inTable('usuario');
    });
    await knex.schema.alterTable('movimientocaja', (table) => {
        table.foreign('id_caja').references('id').inTable('caja');
        table.foreign('id_usuario').references('id').inTable('usuario');
        table.foreign('id_venta').references('id').inTable('venta');
    });
    await knex.schema.alterTable('negocio', (table) => {
        table.foreign('id_empresa').references('id').inTable('empresa');
    });
    await knex.schema.alterTable('orden_trabajo', (table) => {
        table.foreign('id_cliente').references('id').inTable('clientefinal');
        table.foreign('id_sucursal').references('id').inTable('sucursal');
        table.foreign('id_tecnico_asignado').references('id').inTable('usuario');
        table.foreign('id_vehiculo').references('id').inTable('vehiculo');
    });
    await knex.schema.alterTable('pago', (table) => {
        table.foreign('id_medio_pago').references('id').inTable('mediopago');
        table.foreign('id_venta').references('id').inTable('venta');
    });
    await knex.schema.alterTable('plan_suscripcion', (table) => {
        table.unique('code');
    });
    await knex.schema.alterTable('producto', (table) => {
        table.foreign('id_categoria').references('id').inTable('categoria');
        table.foreign('id_impuesto').references('id').inTable('configuracion');
        table.foreign('id_proveedor').references('id').inTable('proveedor');
    });
    await knex.schema.alterTable('sucursal', (table) => {
        table.foreign('id_empresa').references('id').inTable('empresa');
    });
    await knex.schema.alterTable('tenant', (table) => {
        table.foreign('owner_id').references('id').inTable('usuario');
    });
    await knex.schema.alterTable('tenant_suscripcion', (table) => {
        table.foreign('plan_id').references('id').inTable('plan_suscripcion');
        table.foreign('id_tenant').references('id').inTable('tenant');
    });
    await knex.schema.alterTable('user_dashboard_prefs', (table) => {
        table.foreign('id_usuario').references('id').inTable('usuario');
    });
    await knex.schema.alterTable('user_permission_override', (table) => {
        table.foreign('user_id').references('id').inTable('usuario');
    });
    await knex.schema.alterTable('usuario', (table) => {
        table.foreign('id_rol').references('id').inTable('rol');
    });
    await knex.schema.alterTable('usuario_sucursal', (table) => {
        table.foreign('id_sucursal').references('id').inTable('sucursal');
        table.foreign('id_usuario').references('id').inTable('usuario');
    });
    await knex.schema.alterTable('vehiculo', (table) => {
        table.foreign('created_by').references('id').inTable('usuario');
        table.foreign('id_cliente').references('id').inTable('clientefinal');
    });
    await knex.schema.alterTable('venta', (table) => {
        table.foreign('id_caja').references('id').inTable('caja');
        table.foreign('id_cliente').references('id').inTable('clientefinal');
        table.foreign('id_cuenta_corriente').references('id').inTable('cuentacorriente');
        table.foreign('id_sucursal').references('id').inTable('sucursal');
        table.foreign('id_usuario').references('id').inTable('usuario');
    });
    await knex.schema.alterTable('ventalinea', (table) => {
        table.foreign('id_producto').references('id').inTable('producto');
        table.foreign('id_venta').references('id').inTable('venta');
    });
    await knex.schema.alterTable('ventapago', (table) => {
        table.foreign('id_caja').references('id').inTable('caja');
        table.foreign('id_medio_pago').references('id').inTable('mediopago');
        table.foreign('id_venta').references('id').inTable('venta');
    });
    await knex.schema.alterTable('whatsapp_messages', (table) => {
        table.foreign('chat_id').references('chat_id').inTable('whatsapp_chats');
    });

    // -------------------------------------------------------------------------
    // 6) INDEXES
    // -------------------------------------------------------------------------
    await knex.schema.alterTable('accounting_adjunto', (table) => {
        table.index(['entity_type', 'entity_id'], 'idx_adjunto_entity');
    });
    await knex.schema.alterTable('accounting_audit_log', (table) => {
        table.index(['action', 'performed_at'], 'idx_audit_log_action');
        table.index(['id_tenant', 'id_empresa', 'performed_at'], 'idx_audit_log_tenant_empresa');
        table.index(['id_tenant', 'entity_type', 'entity_id'], 'idx_audit_log_tenant_entity');
    });
    await knex.schema.alterTable('vertical', (table) => {
        table.index('is_active', 'idx_vertical_active');
        table.index('key', 'idx_vertical_key');
    });
    await knex.schema.alterTable('whatsapp_chats', (table) => {
        table.index('chat_id', 'idx_whatsapp_chats_chat_id');
        table.index('phone', 'idx_whatsapp_chats_phone');
    });
    await knex.schema.alterTable('whatsapp_messages', (table) => {
        table.index('chat_id', 'idx_whatsapp_messages_chat_id');
        table.index('created_at', 'idx_whatsapp_messages_created_at');
    });

    // -------------------------------------------------------------------------
    // 7) TRIGGERS
    // -------------------------------------------------------------------------
    const triggers = [
        { table: 'accounting_gasto_documento', func: 'update_accounting_gasto_documento_updated_at', op: 'update_updated_at_column' },
        { table: 'accounting_intake', func: 'update_accounting_intake_updated_at', op: 'update_updated_at_column' },
        { table: 'almacen', func: 'trg_almacen_updated', op: 'update_timestamp' },
        { table: 'bank_account', func: 'update_bank_account_updated_at', op: 'update_updated_at_column' },
        { table: 'bank_connection', func: 'update_bank_connection_updated_at', op: 'update_updated_at_column' },
        { table: 'bank_reconciliation_rule', func: 'update_bank_reconciliation_rule_updated_at', op: 'update_updated_at_column' },
        { table: 'bank_transaction', func: 'update_bank_transaction_updated_at', op: 'update_updated_at_column' },
        { table: 'caja', func: 'trg_caja_updated', op: 'update_timestamp' },
        { table: 'cajachica', func: 'trg_cajachica_updated', op: 'update_timestamp' },
        { table: 'plan_suscripcion', func: 'update_plan_suscripcion_updated_at', op: 'update_updated_at_column' },
        { table: 'producto', func: 'trg_producto_updated', op: 'update_timestamp' },
        { table: 'proveedor', func: 'trg_proveedor_updated', op: 'update_timestamp' },
        { table: 'sucursal', func: 'trg_sucursal_updated', op: 'update_timestamp' },
        { table: 'tenant', func: 'trg_tenant_updated', op: 'update_timestamp' },
        { table: 'tenant_suscripcion', func: 'update_tenant_suscripcion_updated_at', op: 'update_updated_at_column' },
        { table: 'user_dashboard_prefs', func: 'trg_dashboard_prefs_updated_at', op: 'update_dashboard_prefs_updated_at' },
        { table: 'usuario', func: 'trg_usuario_updated', op: 'update_timestamp' },
        { table: 'vehiculo', func: 'trg_vehiculo_updated', op: 'update_timestamp' },
    ];

    for (const t of triggers) {
        await knex.raw(`
      DROP TRIGGER IF EXISTS ${t.func} ON ${t.table};
      CREATE TRIGGER ${t.func}
      BEFORE UPDATE ON ${t.table}
      FOR EACH ROW
      EXECUTE FUNCTION ${t.op}();
    `);
    }

    // -------------------------------------------------------------------------
    // 8) RLS POLICIES
    // -------------------------------------------------------------------------
    // First enable RLS on these tables
    const rlsTables = [
        'clientefinal', 'contabilidad_contacto', 'contabilidad_factura',
        'contabilidad_trimestre', 'contable_bill', 'contable_category',
        'marketplace_listing', 'sucursal', 'user_dashboard_prefs',
        'usuario', 'venta'
    ];

    for (const t of rlsTables) {
        await knex.raw(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`);

        // Create the generic RLS policy (tenant isolation)
        // Rule: ((app_is_superadmin() = true) OR (id_tenant = app_current_tenant()))
        // For 'usuario' table, there is an extra condition: OR (id_tenant IS NULL)

        let qual = "((app_is_superadmin() = true) OR (id_tenant = app_current_tenant()))";
        if (t === 'usuario') {
            qual = "((app_is_superadmin() = true) OR (id_tenant = app_current_tenant()) OR (id_tenant IS NULL))";
        }

        await knex.raw(`
      DROP POLICY IF EXISTS "rls_tenant_${t}" ON ${t};
      CREATE POLICY "rls_tenant_${t}" ON ${t}
      AS PERMISSIVE
      FOR ALL
      TO public
      USING (${qual})
      WITH CHECK (${qual});
    `);
    }
};

exports.down = async function (knex) {
    // This is a BASELINE migration replacing all previous state.
    // Rolling back implies destroying the entire database schema to a blank state.
    // We use CASCADE to handle the complex dependency graph automatically.

    const tables = [
        'accounting_adjunto', 'accounting_audit_log', 'accounting_category', 'accounting_cuenta_tesoreria',
        'accounting_empresa', 'accounting_gasto_documento', 'accounting_intake', 'accounting_pago',
        'accounting_transaccion', 'accounting_usuario_empresa', 'almacen', 'archivo', 'bank_account',
        'bank_connection', 'bank_reconciliation_rule', 'bank_transaction', 'caja', 'cajachica',
        'categoria', 'clientefinal', 'configuracion', 'contabilidad_contacto', 'contabilidad_factura',
        'contabilidad_trimestre', 'contable_bill', 'contable_category', 'cuentacorriente', 'empresa',
        'inventory_movement', 'marketplace_listing', 'mediopago', 'movimientocaja', 'negocio',
        'orden_trabajo', 'pago', 'permiso', 'plan_suscripcion', 'producto', 'proveedor', 'rol',
        'services', 'sucursal', 'tenant', 'tenant_suscripcion', 'user_dashboard_prefs',
        'user_permission_override', 'usuario', 'usuario_sucursal', 'vehiculo', 'venta',
        'ventalinea', 'ventapago', 'vertical', 'whatsapp_chats', 'whatsapp_messages'
    ];

    // Dropping variables/functions used in RLS if necessary, but here we focus on tables.
    for (const t of tables) {
        await knex.raw(`DROP TABLE IF EXISTS "${t}" CASCADE`);
    }

    // Drop functions?
    await knex.raw('DROP FUNCTION IF EXISTS update_updated_at_column CASCADE');
    await knex.raw('DROP FUNCTION IF EXISTS update_timestamp CASCADE');
    await knex.raw('DROP FUNCTION IF EXISTS update_dashboard_prefs_updated_at CASCADE');
    await knex.raw('DROP FUNCTION IF EXISTS app_current_tenant CASCADE');
    await knex.raw('DROP FUNCTION IF EXISTS app_is_superadmin CASCADE');
    await knex.raw('DROP EXTENSION IF EXISTS "uuid-ossp"');
};

