-- =====================================================
-- MIGRACIÓN: Módulo Fidelización
-- Descripción: Crea todas las tablas necesarias para el
--              sistema de puntos y tarjeta tipo wallet
-- Fecha: 2025-12-30
-- =====================================================

-- =====================================================
-- 1. TABLA: fidelizacion_programa
-- Configuración del programa de fidelización por tenant
-- =====================================================
CREATE TABLE IF NOT EXISTS fidelizacion_programa (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    nombre VARCHAR(120) NOT NULL DEFAULT 'VERSA Puntos',
    etiqueta_puntos VARCHAR(40) NOT NULL DEFAULT 'Puntos',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Solo un programa activo por tenant
CREATE UNIQUE INDEX IF NOT EXISTS ux_fidelizacion_programa_tenant
ON fidelizacion_programa(id_tenant);

CREATE INDEX IF NOT EXISTS idx_fidelizacion_programa_tenant_activo
ON fidelizacion_programa(id_tenant, activo)
WHERE activo = true;

COMMENT ON TABLE fidelizacion_programa IS 'Configuración del programa de fidelización por tenant';
COMMENT ON COLUMN fidelizacion_programa.etiqueta_puntos IS 'Nombre personalizado para los puntos (ej: Puntos, Estrellas, Créditos)';

-- =====================================================
-- 2. TABLA: fidelizacion_miembro
-- Clientes inscritos en el programa de fidelización
-- =====================================================
CREATE TABLE IF NOT EXISTS fidelizacion_miembro (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    id_programa BIGINT NOT NULL REFERENCES fidelizacion_programa(id) ON DELETE CASCADE,
    id_cliente BIGINT NOT NULL REFERENCES clientefinal(id) ON DELETE CASCADE,
    member_code VARCHAR(32) NOT NULL,
    estado VARCHAR(16) NOT NULL DEFAULT 'active' CHECK (estado IN ('active', 'blocked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Un cliente solo puede estar inscrito una vez por tenant
CREATE UNIQUE INDEX IF NOT EXISTS ux_fidelizacion_miembro_tenant_cliente
ON fidelizacion_miembro(id_tenant, id_cliente);

-- Código de miembro único por tenant
CREATE UNIQUE INDEX IF NOT EXISTS ux_fidelizacion_miembro_tenant_code
ON fidelizacion_miembro(id_tenant, member_code);

CREATE INDEX IF NOT EXISTS idx_fidelizacion_miembro_tenant_cliente
ON fidelizacion_miembro(id_tenant, id_cliente);

CREATE INDEX IF NOT EXISTS idx_fidelizacion_miembro_programa
ON fidelizacion_miembro(id_programa);

COMMENT ON TABLE fidelizacion_miembro IS 'Clientes inscritos en el programa de fidelización';
COMMENT ON COLUMN fidelizacion_miembro.member_code IS 'Código corto para identificar al miembro (uso staff/soporte)';
COMMENT ON COLUMN fidelizacion_miembro.estado IS 'Estado del miembro: active o blocked';

-- =====================================================
-- 3. TABLA: fidelizacion_movimiento
-- Historial de puntos (earn, adjust)
-- =====================================================
CREATE TABLE IF NOT EXISTS fidelizacion_movimiento (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    id_miembro BIGINT NOT NULL REFERENCES fidelizacion_miembro(id) ON DELETE CASCADE,
    tipo VARCHAR(16) NOT NULL CHECK (tipo IN ('earn', 'adjust')),
    puntos INT NOT NULL,
    motivo VARCHAR(120) NOT NULL,
    ref_tipo VARCHAR(40) NULL,
    ref_id BIGINT NULL,
    created_by BIGINT NULL REFERENCES usuario(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fidelizacion_movimiento_miembro
ON fidelizacion_movimiento(id_tenant, id_miembro, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fidelizacion_movimiento_tenant
ON fidelizacion_movimiento(id_tenant, created_at DESC);

COMMENT ON TABLE fidelizacion_movimiento IS 'Historial de movimientos de puntos (sumar/ajustar)';
COMMENT ON COLUMN fidelizacion_movimiento.tipo IS 'Tipo de movimiento: earn (suma) o adjust (ajuste manual)';
COMMENT ON COLUMN fidelizacion_movimiento.puntos IS 'Cantidad de puntos (positivo o negativo)';
COMMENT ON COLUMN fidelizacion_movimiento.ref_tipo IS 'Tipo de entidad relacionada (futuro: citataller, venta, orden)';
COMMENT ON COLUMN fidelizacion_movimiento.ref_id IS 'ID de entidad relacionada';

-- =====================================================
-- 4. TABLA: fidelizacion_promo
-- Promociones simples por tenant
-- =====================================================
CREATE TABLE IF NOT EXISTS fidelizacion_promo (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    titulo VARCHAR(80) NOT NULL,
    descripcion VARCHAR(200) NULL,
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_by BIGINT NULL REFERENCES usuario(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_promo_fechas CHECK (ends_at >= starts_at)
);

CREATE INDEX IF NOT EXISTS idx_fidelizacion_promo_tenant_activo
ON fidelizacion_promo(id_tenant, activo, starts_at, ends_at)
WHERE activo = true;

COMMENT ON TABLE fidelizacion_promo IS 'Promociones simples (texto) por tenant';
COMMENT ON COLUMN fidelizacion_promo.titulo IS 'Título corto de la promoción';
COMMENT ON COLUMN fidelizacion_promo.descripcion IS 'Descripción o condiciones de la promo';

-- =====================================================
-- 5. TABLA: fidelizacion_tarjeta_link
-- Acceso público a la tarjeta (token hasheado)
-- =====================================================
CREATE TABLE IF NOT EXISTS fidelizacion_tarjeta_link (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    id_miembro BIGINT NOT NULL REFERENCES fidelizacion_miembro(id) ON DELETE CASCADE,
    public_token_hash TEXT NOT NULL,
    token_last4 VARCHAR(4) NULL,
    expires_at TIMESTAMPTZ NULL,
    last_opened_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Un link por miembro
CREATE UNIQUE INDEX IF NOT EXISTS ux_fidelizacion_tarjeta_link_miembro
ON fidelizacion_tarjeta_link(id_miembro);

CREATE INDEX IF NOT EXISTS idx_fidelizacion_tarjeta_link_tenant_miembro
ON fidelizacion_tarjeta_link(id_tenant, id_miembro);

COMMENT ON TABLE fidelizacion_tarjeta_link IS 'Links públicos para acceso a la tarjeta (token hasheado)';
COMMENT ON COLUMN fidelizacion_tarjeta_link.public_token_hash IS 'SHA256(token + PEPPER) - nunca guardar token en claro';
COMMENT ON COLUMN fidelizacion_tarjeta_link.token_last4 IS 'Últimos 4 caracteres del token para referencia';

-- =====================================================
-- 6. TABLA: fidelizacion_qr_sesion
-- QR dinámico con nonce para prevenir fraude
-- =====================================================
CREATE TABLE IF NOT EXISTS fidelizacion_qr_sesion (
    id BIGSERIAL PRIMARY KEY,
    id_tenant BIGINT NOT NULL REFERENCES tenant(id) ON DELETE CASCADE,
    id_miembro BIGINT NOT NULL REFERENCES fidelizacion_miembro(id) ON DELETE CASCADE,
    nonce_hash TEXT NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fidelizacion_qr_sesion_miembro
ON fidelizacion_qr_sesion(id_tenant, id_miembro, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_fidelizacion_qr_sesion_expires
ON fidelizacion_qr_sesion(expires_at)
WHERE used_at IS NULL;

COMMENT ON TABLE fidelizacion_qr_sesion IS 'Sesiones de QR dinámico con nonce para prevenir reutilización';
COMMENT ON COLUMN fidelizacion_qr_sesion.nonce_hash IS 'SHA256(nonce + PEPPER) - el nonce solo se envía al cliente';
COMMENT ON COLUMN fidelizacion_qr_sesion.used_at IS 'Marca de tiempo cuando se usó el QR (NULL = no usado)';

-- =====================================================
-- 7. VIEW: vw_fidelizacion_saldo
-- Saldo actual de puntos por miembro
-- =====================================================
CREATE OR REPLACE VIEW vw_fidelizacion_saldo AS
SELECT 
    m.id AS id_miembro,
    m.id_tenant,
    m.id_cliente,
    m.member_code,
    m.estado,
    COALESCE(SUM(mov.puntos), 0)::INT AS balance
FROM fidelizacion_miembro m
LEFT JOIN fidelizacion_movimiento mov ON mov.id_miembro = m.id
GROUP BY m.id, m.id_tenant, m.id_cliente, m.member_code, m.estado;

COMMENT ON VIEW vw_fidelizacion_saldo IS 'Vista de saldos de puntos por miembro';

-- =====================================================
-- TRIGGERS para updated_at
-- =====================================================

-- Reusar la función update_updated_at_column si existe, si no crearla
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers a las tablas que lo necesitan
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fidelizacion_programa_updated_at') THEN
        CREATE TRIGGER update_fidelizacion_programa_updated_at
        BEFORE UPDATE ON fidelizacion_programa
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fidelizacion_miembro_updated_at') THEN
        CREATE TRIGGER update_fidelizacion_miembro_updated_at
        BEFORE UPDATE ON fidelizacion_miembro
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fidelizacion_promo_updated_at') THEN
        CREATE TRIGGER update_fidelizacion_promo_updated_at
        BEFORE UPDATE ON fidelizacion_promo
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_fidelizacion_tarjeta_link_updated_at') THEN
        CREATE TRIGGER update_fidelizacion_tarjeta_link_updated_at
        BEFORE UPDATE ON fidelizacion_tarjeta_link
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END$$;

-- =====================================================
-- FIN DE LA MIGRACIÓN
-- =====================================================
