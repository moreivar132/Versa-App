# MÓDULO MARKETPLACE - VERSA

## Descripción General

El módulo Marketplace permite que las sucursales de tu red se listen públicamente en un directorio estilo **Treatwell**, donde los clientes pueden:
- Buscar talleres cercanos
- Ver servicios y precios
- Aprovechar promociones
- Reservar citas online
- Dejar reseñas verificadas

Este módulo está diseñado con arquitectura **multi-tenant** y seguridad robusta.

---

## 🗂️ Estructura de Tablas

### 1. `marketplace_listing`
**Propósito:** Perfil público de cada sucursal habilitada en el marketplace.

**Campos principales:**
- `id_sucursal` (UNIQUE): Vinculación a la sucursal
- `activo`: Flag para activar/desactivar presencia en marketplace
- `descripcion_publica`: Texto que aparece en la ficha pública
- `fotos_json`: Array JSONB de URLs de fotos del taller
- `lat`, `lng`: Coordenadas GPS para búsqueda por proximidad
- `horario_json`: Horarios de atención
- `reserva_online_activa`: Si permite reservas desde el marketplace
- `deposito_activo`, `deposito_tipo`, `deposito_valor`: Configuración de señas/depósitos

**Restricción:** Solo **1 listing por sucursal**.

---

### 2. `marketplace_servicio`
**Propósito:** Catálogo global de servicios disponibles (ej: "Cambio de aceite", "Frenos", "ITV").

**Campos principales:**
- `nombre` (UNIQUE): Nombre del servicio
- `categoria`: Categoría (Mantenimiento, Frenos, Neumáticos, etc.)
- `descripcion`: Descripción del servicio
- `activo`: Si el servicio está disponible

**Ejemplos:**
- Cambio de aceite
- Revisión de frenos
- ITV pre-revisión
- Diagnóstico electrónico

---

### 3. `marketplace_servicio_sucursal`
**Propósito:** Asocia servicios a sucursales con **precio** y **duración** específicos.

**Campos principales:**
- `id_sucursal`: Sucursal que ofrece el servicio
- `id_servicio`: Servicio del catálogo global
- `precio`: Precio en euros
- `duracion_min`: Duración en minutos
- `precio_desde`: Boolean para indicar "desde X€"
- `rank_destacado`: Orden de destaque (menor = más destacado)
- `permite_reserva_online`: Si se puede reservar este servicio online

**Restricción:** Un servicio solo puede aparecer **una vez por sucursal**.

---

### 4. `marketplace_promo`
**Propósito:** Promociones y ofertas activas.

**Campos principales:**
- `id_sucursal`: Sucursal que ofrece la promo
- `id_servicio`: Servicio específico (NULL = promo general)
- `titulo`: Título de la promo ("20% descuento en cambio de aceite")
- `tipo_descuento`: "PORCENTAJE" o "FIJO"
- `valor_descuento`: Valor del descuento
- `fecha_inicio`, `fecha_fin`: Vigencia de la promo
- `dias_semana_json`: JSONB con días aplicables [1,2,3,4,5] (Lun-Vie)
- `horas_json`: JSONB con rango horario {"from":"10:00","to":"14:00"}
- `cupo_total`, `cupo_usado`: Control de cupos limitados

---

### 5. `marketplace_review`
**Propósito:** Reseñas **verificadas** de clientes (solo tras haber tenido una cita u orden).

**Campos principales:**
- `id_cliente`: Cliente que deja la reseña
- `id_sucursal`: Sucursal valorada
- `id_cita` o `id_orden`: Vinculación necesaria (al menos uno)
- `rating`: Puntuación 1-5 estrellas
- `comentario`: Texto de la reseña
- `visible`: Si la reseña está publicada (admin puede ocultar)

**Restricción:** 
- Solo **1 reseña por cita/orden** (evita duplicados)
- Debe existir una cita o una orden vinculada

---

## 🚀 Instalación

### Prerequisitos
- PostgreSQL con las tablas base ya creadas: `tenant`, `sucursal`, `clientefinal`, `citataller`, `orden`
- Node.js instalado
- Variables de entorno configuradas en `.env`

### Paso 1: Ejecutar Migración

```bash
cd backend
node ejecutar_migracion_marketplace.js
```

**Este script:**
1. ✅ Crea las 5 tablas del marketplace
2. ✅ Crea todos los índices y constraints
3. ✅ Crea triggers de `updated_at`
4. ✅ Puebla el catálogo con +40 servicios
5. ✅ Verifica la instalación

### Paso 2: Verificar Instalación

Ejecuta estas queries para verificar:

```sql
-- Ver tablas creadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name LIKE 'marketplace_%'
ORDER BY table_name;

-- Contar servicios disponibles
SELECT COUNT(*) as total_servicios 
FROM marketplace_servicio 
WHERE activo = true;

-- Ver servicios por categoría
SELECT categoria, COUNT(*) as total
FROM marketplace_servicio
WHERE activo = true
GROUP BY categoria
ORDER BY total DESC;
```

---

## 📝 Uso Básico

### 1. Activar Marketplace para una Sucursal

```sql
INSERT INTO marketplace_listing (
    id_tenant, 
    id_sucursal, 
    activo,
    titulo_publico,
    descripcion_publica,
    telefono_publico,
    email_publico,
    reserva_online_activa
) VALUES (
    1,  -- ID del tenant
    1,  -- ID de la sucursal
    true,
    'Taller MotoExpress - Centro Madrid',
    'Especialistas en motos deportivas y custom. Más de 15 años de experiencia.',
    '+34 91 123 45 67',
    'info@motoexpress.com',
    true
);
```

### 2. Agregar Fotos al Listing

```sql
UPDATE marketplace_listing 
SET fotos_json = '[
    "https://misfotos.com/taller1.jpg",
    "https://misfotos.com/taller2.jpg",
    "https://misfotos.com/taller3.jpg"
]'::jsonb
WHERE id_sucursal = 1;
```

### 3. Configurar Ubicación GPS

```sql
UPDATE marketplace_listing 
SET lat = 40.41678, 
    lng = -3.70379
WHERE id_sucursal = 1;
```

### 4. Agregar Servicios a la Sucursal

```sql
-- Primero, encontrar el ID del servicio
SELECT id, nombre, categoria 
FROM marketplace_servicio 
WHERE nombre LIKE '%aceite%';

-- Luego, agregarlo a la sucursal con precio y duración
INSERT INTO marketplace_servicio_sucursal (
    id_tenant,
    id_sucursal,
    id_servicio,
    precio,
    duracion_min,
    rank_destacado,
    activo
) VALUES 
(1, 1, 1, 45.00, 30, 1, true),  -- Cambio de aceite
(1, 1, 3, 65.00, 45, 2, true),  -- Revisión de frenos
(1, 1, 10, 85.00, 60, 3, true); -- Diagnosis electrónica
```

### 5. Crear una Promoción

```sql
INSERT INTO marketplace_promo (
    id_tenant,
    id_sucursal,
    id_servicio,
    titulo,
    descripcion,
    tipo_descuento,
    valor_descuento,
    fecha_inicio,
    fecha_fin,
    dias_semana_json,
    activo
) VALUES (
    1,
    1,
    1,  -- ID del servicio "Cambio de aceite"
    '20% descuento en cambio de aceite',
    'Válido de lunes a viernes hasta fin de mes',
    'PORCENTAJE',
    20.00,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    '[1,2,3,4,5]'::jsonb,  -- Lun-Vie
    true
);
```

---

## 🔍 Queries Útiles

### Buscar Talleres Activos con sus Servicios

```sql
SELECT 
    l.id,
    l.titulo_publico,
    s.nombre as sucursal_nombre,
    s.direccion,
    l.lat,
    l.lng,
    l.fotos_json,
    COUNT(DISTINCT ss.id) as total_servicios,
    AVG(r.rating) as rating_promedio,
    COUNT(DISTINCT r.id) as total_reviews
FROM marketplace_listing l
JOIN sucursal s ON s.id = l.id_sucursal
LEFT JOIN marketplace_servicio_sucursal ss ON ss.id_sucursal = l.id_sucursal AND ss.activo = true
LEFT JOIN marketplace_review r ON r.id_sucursal = l.id_sucursal AND r.visible = true
WHERE l.activo = true
GROUP BY l.id, l.titulo_publico, s.nombre, s.direccion, l.lat, l.lng, l.fotos_json
ORDER BY rating_promedio DESC NULLS LAST;
```

### Servicios Destacados de una Sucursal

```sql
SELECT 
    ms.nombre,
    ms.categoria,
    mss.precio,
    mss.duracion_min,
    mss.precio_desde,
    mss.rank_destacado
FROM marketplace_servicio_sucursal mss
JOIN marketplace_servicio ms ON ms.id = mss.id_servicio
WHERE mss.id_sucursal = 1
  AND mss.activo = true
ORDER BY mss.rank_destacado ASC
LIMIT 5;
```

### Promociones Activas Ahora

```sql
SELECT 
    p.*,
    ms.nombre as servicio_nombre,
    s.nombre as sucursal_nombre
FROM marketplace_promo p
LEFT JOIN marketplace_servicio ms ON ms.id = p.id_servicio
JOIN sucursal s ON s.id = p.id_sucursal
WHERE p.activo = true
  AND p.fecha_inicio <= CURRENT_DATE
  AND p.fecha_fin >= CURRENT_DATE
  AND (p.cupo_total IS NULL OR p.cupo_usado < p.cupo_total)
ORDER BY p.valor_descuento DESC;
```

### Reseñas Recientes de una Sucursal

```sql
SELECT 
    r.rating,
    r.comentario,
    r.created_at,
    c.nombre as cliente_nombre
FROM marketplace_review r
JOIN clientefinal c ON c.id = r.id_cliente
WHERE r.id_sucursal = 1
  AND r.visible = true
ORDER BY r.created_at DESC
LIMIT 10;
```

---

## 🔐 Seguridad Multi-Tenant

Todas las tablas incluyen `id_tenant` para garantizar aislamiento de datos entre tenants.

**Ejemplo de query seguro:**

```sql
-- ❌ MAL: Sin filtrar por tenant
SELECT * FROM marketplace_listing WHERE activo = true;

-- ✅ BIEN: Filtrando por tenant
SELECT * FROM marketplace_listing 
WHERE id_tenant = :tenant_id AND activo = true;
```

**En los endpoints backend, siempre:**
```javascript
const { id_tenant } = req.user;  // Del token JWT
const listings = await pool.query(`
    SELECT * FROM marketplace_listing 
    WHERE id_tenant = $1 AND activo = true
`, [id_tenant]);
```

---

## 📊 Índices Creados

El módulo crea automáticamente índices para optimizar:
- ✅ Búsquedas por ubicación GPS (`idx_marketplace_listing_geo`)
- ✅ Filtros por activo/inactivo
- ✅ Búsquedas por servicio
- ✅ Ordenación por rating y fecha
- ✅ Búsquedas multi-tenant

---

## 🔄 Próximos Pasos

1. **Crear Endpoints Backend**
   - `GET /api/marketplace/search` - Búsqueda de talleres
   - `GET /api/marketplace/sucursales/:id` - Detalle de taller
   - `GET /api/marketplace/sucursales/:id/availability` - Disponibilidad
   - `POST /api/marketplace/book` - Crear reserva

2. **Panel de Administración**
   - Gestión de fotos del taller
   - Configuración de servicios y precios
   - Creación/edición de promociones
   - Moderación de reseñas

3. **Automatizaciones**
   - Email de confirmación de reserva
   - Recordatorios automáticos
   - Solicitud de reseña post-servicio

---

## 📞 Soporte

Para más información sobre el módulo Marketplace, consulta:
- `backend/migrations/create_marketplace_tables.sql` - Definición de tablas
- `backend/migrations/populate_marketplace_servicios.sql` - Catálogo de servicios
- `backend/ejecutar_migracion_marketplace.js` - Script de migración

---

**Última actualización:** 2025-12-27  
**Versión:** 1.0.0
