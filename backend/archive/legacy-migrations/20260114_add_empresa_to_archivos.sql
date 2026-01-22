-- Migración: Añadir id_empresa a contabilidad_factura_archivo
-- Fecha: 2026-01-14

-- 1. Añadir la columna
ALTER TABLE contabilidad_factura_archivo ADD COLUMN IF NOT EXISTS id_empresa BIGINT REFERENCES accounting_empresa(id);

-- 2. Poblar datos existentes desde la tabla de facturas
UPDATE contabilidad_factura_archivo a
SET id_empresa = f.id_empresa
FROM contabilidad_factura f
WHERE a.id_factura = f.id AND a.id_empresa IS NULL;

-- 3. Crear índice para mejorar filtrado
CREATE INDEX IF NOT EXISTS idx_contab_factura_archivo_empresa ON contabilidad_factura_archivo(id_empresa);
