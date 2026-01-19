-- ================================================================
-- RETENCIONES (IRPF) SUPPORT FOR INVOICES
-- ================================================================
-- Adds fields to track IRPF withholdings for Spanish invoices
-- Common for autonomos and professional services
-- ================================================================

-- 1. Add retention fields to contabilidad_factura
ALTER TABLE contabilidad_factura 
    ADD COLUMN IF NOT EXISTS retencion_porcentaje NUMERIC(5,2) DEFAULT 0;

ALTER TABLE contabilidad_factura 
    ADD COLUMN IF NOT EXISTS retencion_importe NUMERIC(14,2) DEFAULT 0;

-- 2. Add comments
COMMENT ON COLUMN contabilidad_factura.retencion_porcentaje IS 'Porcentaje de retención IRPF (ej: 15%, 7%, 1%)';
COMMENT ON COLUMN contabilidad_factura.retencion_importe IS 'Importe de retención IRPF = base_imponible * retencion_porcentaje / 100';

-- 3. Drop old constraint that doesn't account for retention
ALTER TABLE contabilidad_factura DROP CONSTRAINT IF EXISTS chk_contab_factura_totales;

-- 4. Add new constraint that allows for negative retention effect on total
-- Formula: total = base_imponible + iva_importe - retencion_importe
ALTER TABLE contabilidad_factura 
    ADD CONSTRAINT chk_contab_factura_totales 
    CHECK (total >= 0 AND base_imponible >= 0 AND iva_importe >= 0 AND retencion_importe >= 0);

-- 5. Add retention check constraint
ALTER TABLE contabilidad_factura 
    ADD CONSTRAINT chk_contab_factura_retencion 
    CHECK (retencion_porcentaje >= 0 AND retencion_porcentaje <= 100);

-- ================================================================
-- END OF MIGRATION
-- ================================================================
