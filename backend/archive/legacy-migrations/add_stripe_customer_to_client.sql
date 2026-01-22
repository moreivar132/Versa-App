-- =====================================================
-- VERSA - FASE 6 (BLOQUE 4): Stripe Customer para Clientes
-- Añade columnas de Stripe a clientefinal_auth para gestión de payment methods
-- =====================================================

-- Añadir stripe_customer_id a clientefinal_auth
ALTER TABLE clientefinal_auth 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Índice único para stripe_customer_id (un customer de Stripe = un cliente)
CREATE UNIQUE INDEX IF NOT EXISTS idx_clientefinal_auth_stripe_customer_id 
ON clientefinal_auth(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- (Opcional) Guardar el ID del método de pago predeterminado
ALTER TABLE clientefinal_auth 
ADD COLUMN IF NOT EXISTS stripe_default_payment_method_id TEXT;

-- Comentarios
COMMENT ON COLUMN clientefinal_auth.stripe_customer_id IS 'ID del Customer en Stripe para gestión de payment methods';
COMMENT ON COLUMN clientefinal_auth.stripe_default_payment_method_id IS 'ID del PaymentMethod predeterminado en Stripe (opcional)';

-- =====================================================
-- FIN DE MIGRACIÓN
-- =====================================================
