-- Add phone and email columns to sucursal table
ALTER TABLE sucursal
ADD COLUMN IF NOT EXISTS telefono VARCHAR(50),
ADD COLUMN IF NOT EXISTS email VARCHAR(255);
