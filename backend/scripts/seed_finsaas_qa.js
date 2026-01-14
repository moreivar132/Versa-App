/**
 * Seed Script: FinSaaS QA Data
 * Creates test data for FinSaaS module debugging
 * 
 * Usage: node scripts/seed_finsaas_qa.js
 */

require('dotenv').config();
const pool = require('../db');

async function seedFinSaaSData() {
    console.log('🚀 Seeding FinSaaS QA data...\n');

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Get first tenant (or create one)
        let tenantResult = await client.query('SELECT id FROM tenant LIMIT 1');
        let tenantId;

        if (tenantResult.rows.length === 0) {
            const newTenant = await client.query(`
                INSERT INTO tenant (nombre, activo) 
                VALUES ('Tenant FinSaaS QA', true) 
                RETURNING id
            `);
            tenantId = newTenant.rows[0].id;
            console.log(`✅ Created tenant: ${tenantId}`);
        } else {
            tenantId = tenantResult.rows[0].id;
            console.log(`📋 Using existing tenant: ${tenantId}`);
        }

        // 2. Get first admin user for this tenant
        let userResult = await client.query(`
            SELECT id FROM usuario 
            WHERE id_tenant = $1 OR is_super_admin = true 
            LIMIT 1
        `, [tenantId]);

        let userId;
        if (userResult.rows.length === 0) {
            console.log('⚠️  No user found. Skipping user-related seeds.');
            userId = null;
        } else {
            userId = userResult.rows[0].id;
            console.log(`📋 Using user: ${userId}`);
        }

        // 3. Create or get default empresa
        let empresaResult = await client.query(`
            SELECT id FROM accounting_empresa 
            WHERE id_tenant = $1 AND es_default = true 
            LIMIT 1
        `, [tenantId]);

        let empresaId;
        if (empresaResult.rows.length === 0) {
            const newEmpresa = await client.query(`
                INSERT INTO accounting_empresa (
                    id_tenant, nombre_legal, nombre_comercial, nif_cif, 
                    direccion, codigo_postal, ciudad, provincia, pais,
                    moneda, iva_defecto, regimen, activo, es_default, created_by
                ) VALUES (
                    $1, 'Empresa Demo S.L.', 'Demo FinSaaS', 'B12345678',
                    'Calle Principal 1', '28001', 'Madrid', 'Madrid', 'ES',
                    'EUR', 21, 'GENERAL', true, true, $2
                ) RETURNING id
            `, [tenantId, userId]);
            empresaId = newEmpresa.rows[0].id;
            console.log(`✅ Created empresa: ${empresaId}`);

            // Create default caja
            await client.query(`
                INSERT INTO accounting_cuenta_tesoreria (
                    id_empresa, nombre, tipo, es_default, saldo_actual, created_by
                ) VALUES ($1, 'Caja Principal', 'CAJA', true, 0, $2)
            `, [empresaId, userId]);
            console.log(`✅ Created cuenta caja for empresa`);
        } else {
            empresaId = empresaResult.rows[0].id;
            console.log(`📋 Using existing empresa: ${empresaId}`);
        }

        // 4. Assign user to empresa if not already
        if (userId) {
            await client.query(`
                INSERT INTO accounting_usuario_empresa (id_usuario, id_empresa, rol_empresa, created_by)
                VALUES ($1, $2, 'empresa_admin', $1)
                ON CONFLICT (id_usuario, id_empresa) DO NOTHING
            `, [userId, empresaId]);
            console.log(`✅ Assigned user ${userId} to empresa ${empresaId}`);
        }

        // 5. Ensure contabilidad permissions exist and are assigned
        const permisos = [
            'contabilidad.read', 'contabilidad.write', 'contabilidad.approve', 'contabilidad.admin',
            'contabilidad.empresa.read', 'contabilidad.empresa.write',
            'contabilidad.tesoreria.read', 'contabilidad.tesoreria.write'
        ];

        for (const key of permisos) {
            // Check if permission exists
            const exists = await client.query('SELECT id FROM permiso WHERE key = $1', [key]);
            if (exists.rows.length === 0) {
                await client.query(`
                    INSERT INTO permiso (nombre, key, module, descripcion)
                    VALUES ($1, $2, 'contabilidad', $3)
                `, [key, key, `Permiso ${key}`]);
            }
        }
        console.log(`✅ Ensured ${permisos.length} contabilidad permissions exist`);

        // Assign permissions to admin role if user has one
        if (userId) {
            const userRoles = await client.query(`
                SELECT ur.id_rol FROM usuariorol ur WHERE ur.id_usuario = $1
            `, [userId]);

            if (userRoles.rows.length > 0) {
                const roleId = userRoles.rows[0].id_rol;
                for (const key of permisos) {
                    // Check if role-permission link exists
                    const linkExists = await client.query(`
                        SELECT 1 FROM rolpermiso rp
                        JOIN permiso p ON p.id = rp.id_permiso
                        WHERE rp.id_rol = $1 AND p.key = $2
                    `, [roleId, key]);

                    if (linkExists.rows.length === 0) {
                        await client.query(`
                            INSERT INTO rolpermiso (id_rol, id_permiso)
                            SELECT $1, p.id FROM permiso p WHERE p.key = $2
                        `, [roleId, key]);
                    }
                }
                console.log(`✅ Assigned contabilidad permissions to role ${roleId}`);
            }
        }

        // 6. Create sample contactos
        const contactos = [
            { tipo: 'CLIENTE', nombre: 'Cliente Demo S.A.', nif: 'A12345678', email: 'cliente@demo.com' },
            { tipo: 'PROVEEDOR', nombre: 'Proveedor Test S.L.', nif: 'B87654321', email: 'proveedor@test.com' },
            { tipo: 'AMBOS', nombre: 'Partner Global', nif: 'B11111111', email: 'partner@global.com' }
        ];

        for (const c of contactos) {
            await client.query(`
                INSERT INTO contabilidad_contacto (
                    id_tenant, id_empresa, tipo, nombre, nif_cif, email, activo, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, true, $7)
                ON CONFLICT DO NOTHING
            `, [tenantId, empresaId, c.tipo, c.nombre, c.nif, c.email, userId]);
        }
        console.log(`✅ Created ${contactos.length} sample contactos`);

        // 7. Create sample facturas
        const today = new Date().toISOString().split('T')[0];
        const facturas = [
            { tipo: 'INGRESO', numero: 'FAC-2026-001', base: 1000, iva: 210, total: 1210 },
            { tipo: 'GASTO', numero: 'GASTO-2026-001', base: 500, iva: 105, total: 605 }
        ];

        for (const f of facturas) {
            await client.query(`
                INSERT INTO contabilidad_factura (
                    id_tenant, id_empresa, tipo, numero_factura, 
                    fecha_emision, fecha_devengo, 
                    base_imponible, iva_porcentaje, iva_importe, total,
                    estado, created_by
                ) VALUES ($1, $2, $3, $4, $5, $5, $6, 21, $7, $8, 'PENDIENTE', $9)
                ON CONFLICT DO NOTHING
            `, [tenantId, empresaId, f.tipo, f.numero, today, f.base, f.iva, f.total, userId]);
        }
        console.log(`✅ Created ${facturas.length} sample facturas`);

        await client.query('COMMIT');
        console.log('\n✨ FinSaaS seed completed successfully!');

        // Summary
        console.log('\n📊 Summary:');
        console.log(`   Tenant ID: ${tenantId}`);
        console.log(`   Empresa ID: ${empresaId}`);
        console.log(`   User ID: ${userId || 'N/A'}`);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Seed failed:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

seedFinSaaSData();
