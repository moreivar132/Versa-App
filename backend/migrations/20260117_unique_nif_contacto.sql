-- ================================================================
-- UNIQUE NIF/CIF CONSTRAINT FOR CONTACTS
-- ================================================================
-- Ensures no duplicate NIF/CIF within the same tenant
-- ================================================================

-- First, let's find and handle any existing duplicates
-- We'll keep the most recently updated one and deactivate others

-- 1. Identify duplicates and mark older ones as inactive
WITH duplicates AS (
    SELECT id, nif_cif, id_tenant,
           ROW_NUMBER() OVER (
               PARTITION BY id_tenant, UPPER(TRIM(nif_cif)) 
               ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
           ) as rn
    FROM contabilidad_contacto
    WHERE nif_cif IS NOT NULL 
      AND nif_cif != '' 
      AND deleted_at IS NULL
)
UPDATE contabilidad_contacto c
SET activo = false,
    notas = COALESCE(notas, '') || ' [DESACTIVADO: NIF/CIF duplicado]',
    updated_at = now()
FROM duplicates d
WHERE c.id = d.id AND d.rn > 1;

-- 2. Create unique index on tenant + normalized NIF/CIF
-- Only applies to active, non-deleted contacts with a NIF/CIF
CREATE UNIQUE INDEX IF NOT EXISTS ux_contacto_tenant_nif 
    ON contabilidad_contacto (id_tenant, UPPER(TRIM(nif_cif)))
    WHERE nif_cif IS NOT NULL 
      AND nif_cif != '' 
      AND deleted_at IS NULL 
      AND activo = true;

COMMENT ON INDEX ux_contacto_tenant_nif IS 'Ensures unique NIF/CIF per tenant for active contacts';

-- ================================================================
-- END OF MIGRATION
-- ================================================================
