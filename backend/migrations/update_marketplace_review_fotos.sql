-- =====================================================
-- MIGRACIÓN: Actualizar marketplace_review para fotos y edición
-- Añade campos para fotos y fecha de actualización
-- =====================================================

-- Añadir columna de fotos (array de URLs)
ALTER TABLE marketplace_review 
ADD COLUMN IF NOT EXISTS fotos_json JSONB DEFAULT '[]'::jsonb;

-- Añadir columna de updated_at
ALTER TABLE marketplace_review 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Trigger para updated_at
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_marketplace_review_updated_at') THEN
        CREATE TRIGGER update_marketplace_review_updated_at
        BEFORE UPDATE ON marketplace_review
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

COMMENT ON COLUMN marketplace_review.fotos_json IS 'Array de URLs de fotos subidas por el cliente con la reseña';

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
