-- Increase column sizes for sucursal table to prevent overflow errors
ALTER TABLE sucursal
ALTER COLUMN telefono TYPE VARCHAR(255),
ALTER COLUMN direccion_iframe TYPE TEXT;
