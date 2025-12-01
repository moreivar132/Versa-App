const pool = require('./db');

async function updateCompraLineaSchema() {
    const client = await pool.connect();
    try {
        console.log('Updating compralinea schema...');

        // Add descripcion
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compralinea' AND column_name='descripcion') THEN 
                    ALTER TABLE compralinea ADD COLUMN descripcion TEXT;
                END IF;
            END $$;
        `);

        // Add precio_unitario (alias for costo_unitario if needed, but code uses precio_unitario)
        // Or we can map precio_unitario to costo_unitario in the query.
        // Let's add precio_unitario to match the code, or rename. 
        // Code uses: precio_unitario, iva, total_linea

        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compralinea' AND column_name='precio_unitario') THEN 
                    ALTER TABLE compralinea ADD COLUMN precio_unitario NUMERIC(10, 2);
                END IF;
            END $$;
        `);

        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compralinea' AND column_name='iva') THEN 
                    ALTER TABLE compralinea ADD COLUMN iva NUMERIC(5, 2);
                END IF;
            END $$;
        `);

        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compralinea' AND column_name='total_linea') THEN 
                    ALTER TABLE compralinea ADD COLUMN total_linea NUMERIC(10, 2);
                END IF;
            END $$;
        `);

        console.log('Columns added successfully to compralinea.');
    } catch (err) {
        console.error('Error updating schema:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

updateCompraLineaSchema();
