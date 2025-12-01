const pool = require('./db');

async function updateCompraCabeceraSchema() {
    const client = await pool.connect();
    try {
        console.log('Updating compracabecera schema...');

        // Add fecha_emision
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compracabecera' AND column_name='fecha_emision') THEN 
                    ALTER TABLE compracabecera ADD COLUMN fecha_emision TIMESTAMP;
                END IF;
            END $$;
        `);

        // Add metodo_pago
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compracabecera' AND column_name='metodo_pago') THEN 
                    ALTER TABLE compracabecera ADD COLUMN metodo_pago VARCHAR(50);
                END IF;
            END $$;
        `);

        // Add observaciones
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compracabecera' AND column_name='observaciones') THEN 
                    ALTER TABLE compracabecera ADD COLUMN observaciones TEXT;
                END IF;
            END $$;
        `);

        // Add total
        await client.query(`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compracabecera' AND column_name='total') THEN 
                    ALTER TABLE compracabecera ADD COLUMN total NUMERIC(10, 2) DEFAULT 0;
                END IF;
            END $$;
        `);

        console.log('Columns added successfully.');
    } catch (err) {
        console.error('Error updating schema:', err);
    } finally {
        client.release();
        await pool.end();
    }
}

updateCompraCabeceraSchema();
