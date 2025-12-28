const pool = require('../db');

async function repairIntegrity() {
    console.log('🛠 Starting Marketplace Data Integrity Repair...');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 1. Identify Orphans (Listing points to non-existent sucursal)
        console.log('🔍 Checking for orphans (invalid id_sucursal)...');
        const orphans = await client.query(`
            SELECT id, titulo_publico, id_sucursal 
            FROM marketplace_listing 
            WHERE id_sucursal NOT IN (SELECT id FROM sucursal)
        `);

        if (orphans.rows.length > 0) {
            console.log(`⚠️  Found ${orphans.rows.length} orphan listings. Deleting...`);
            await client.query(`
                DELETE FROM marketplace_listing 
                WHERE id IN (
                    SELECT id FROM marketplace_listing 
                    WHERE id_sucursal NOT IN (SELECT id FROM sucursal)
                )
            `);
            console.log('✅  Orphans deleted.');
        } else {
            console.log('✅  No orphans found.');
        }

        // 2. Identify Tenant Mismatches (Listing id_tenant != Sucursal id_tenant)
        console.log('🔍 Checking for tenant mismatches...');
        const mismatches = await client.query(`
            SELECT l.id, l.titulo_publico, l.id_tenant as listing_tenant, s.id_tenant as sucursal_tenant
            FROM marketplace_listing l
            JOIN sucursal s ON s.id = l.id_sucursal
            WHERE l.id_tenant != s.id_tenant
        `);

        if (mismatches.rows.length > 0) {
            console.log(`⚠️  Found ${mismatches.rows.length} tenant mismatches. Fixing...`);
            // Fix: Update listing id_tenant to match sucursal
            await client.query(`
                UPDATE marketplace_listing l
                SET id_tenant = s.id_tenant,
                    updated_at = NOW()
                FROM sucursal s
                WHERE l.id_sucursal = s.id
                AND l.id_tenant != s.id_tenant
            `);
            console.log('✅  Mismatches fixed (synced with sucursal).');
        } else {
            console.log('✅  No tenant mismatches found.');
        }

        // 3. Deactivate listings with no Address (Garbage data)
        console.log('🔍 Checking for incomplete listings (no address)...');
        const incomplete = await client.query(`
            SELECT l.id, l.titulo_publico, s.nombre
            FROM marketplace_listing l
            JOIN sucursal s ON s.id = l.id_sucursal
            WHERE l.activo = true
            AND (s.direccion IS NULL OR TRIM(s.direccion) = '')
        `);

        if (incomplete.rows.length > 0) {
            console.log(`⚠️  Found ${incomplete.rows.length} active listings without address. Deactivating...`);
            await client.query(`
                UPDATE marketplace_listing l
                SET activo = false
                FROM sucursal s
                WHERE l.id_sucursal = s.id
                AND l.activo = true
                AND (s.direccion IS NULL OR TRIM(s.direccion) = '')
           `);
            console.log('✅  Incomplete listings deactivated.');
        } else {
            console.log('✅  No incomplete active listings found.');
        }

        await client.query('COMMIT');
        console.log('✨ Data Integrity Repair Completed Successfully.');

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Error during repair:', error);
    } finally {
        client.release();
        pool.end(); // Close pool to exit script
    }
}

repairIntegrity();
