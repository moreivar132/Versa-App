-- Add id_empresa to facturaconfigtenant
ALTER TABLE facturaconfigtenant 
ADD COLUMN id_empresa INTEGER REFERENCES accounting_empresa(id);

-- Add unique constraint to prevent multiple configs per company (optional but recommended)
-- Only one "default" config per company per tenant
CREATE UNIQUE INDEX idx_facturaconfig_tenant_empresa 
ON facturaconfigtenant (id_tenant, id_empresa) 
WHERE id_empresa IS NOT NULL;
