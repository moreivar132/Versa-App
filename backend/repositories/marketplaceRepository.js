const pool = require('../db');

const getExecutor = (client) => client || pool;

class MarketplaceRepository {

    // =====================================
    // BÚSQUEDA Y LISTADOS PÚBLICOS
    // =====================================

    /**
     * Buscar sucursales activas en el marketplace con filtros
     */
    async searchSucursales(filters = {}, client) {
        const executor = getExecutor(client);
        const {
            ubicacion,
            distancia,
            servicio,
            tipoVehiculo,
            precioMin,
            precioMax,
            ratingMin,
            soloOfertas,
            lat,
            lng,
            limit = 50,
            offset = 0
        } = filters;

        let query = `
            SELECT 
                l.id,
                l.id_sucursal,
                l.titulo_publico,
                l.descripcion_publica,
                l.lat,
                l.lng,
                l.fotos_json,
                l.telefono_publico,
                l.email_publico,
                l.whatsapp_publico,
                s.nombre as sucursal_nombre,
                s.direccion,
                COALESCE(AVG(r.rating), 0) as rating,
                COUNT(DISTINCT r.id) as reviews_count,
                (
                    SELECT json_agg(sub.item)
                    FROM (
                        SELECT json_build_object(
                            'nombre', ms.nombre,
                            'duracion_min', mss.duracion_min,
                            'precio', mss.precio,
                            'precio_desde', mss.precio_desde
                        ) as item
                        FROM marketplace_servicio_sucursal mss
                        JOIN marketplace_servicio ms ON ms.id = mss.id_servicio
                        WHERE mss.id_sucursal = l.id_sucursal 
                          AND mss.activo = true
                        ORDER BY mss.rank_destacado ASC
                        LIMIT 5
                    ) sub
                ) as servicios_destacados,
                EXISTS (
                    SELECT 1 FROM marketplace_promo p
                    WHERE p.id_sucursal = l.id_sucursal
                      AND p.activo = true
                      AND p.fecha_inicio <= CURRENT_DATE
                      AND p.fecha_fin >= CURRENT_DATE
                      AND (p.cupo_total IS NULL OR p.cupo_usado < p.cupo_total)
                ) as tiene_oferta
            FROM marketplace_listing l
            JOIN sucursal s ON s.id = l.id_sucursal AND s.id_tenant = l.id_tenant -- Ensure integrity
            LEFT JOIN marketplace_review r ON r.id_sucursal = l.id_sucursal AND r.visible = true
            WHERE l.activo = true
              AND l.reserva_online_activa = true
              AND (s.direccion IS NOT NULL AND TRIM(s.direccion) != '') -- Filter out incomplete profiles
        `;

        const params = [];
        let paramCount = 1;

        // Filtro por servicio
        if (servicio) {
            query += `
                AND EXISTS (
                    SELECT 1 FROM marketplace_servicio_sucursal mss
                    JOIN marketplace_servicio ms ON ms.id = mss.id_servicio
                    WHERE mss.id_sucursal = l.id_sucursal
                      AND mss.activo = true
                      AND ms.nombre ILIKE $${paramCount}
                )
            `;
            params.push(`%${servicio}%`);
            paramCount++;
        }

        // Filtro por categoría/tipo vehículo
        if (tipoVehiculo) {
            query += `
                AND EXISTS (
                    SELECT 1 FROM marketplace_servicio_sucursal mss
                    JOIN marketplace_servicio ms ON ms.id = mss.id_servicio
                    WHERE mss.id_sucursal = l.id_sucursal
                      AND mss.activo = true
                      AND ms.categoria ILIKE $${paramCount}
                )
            `;
            params.push(`%${tipoVehiculo}%`);
            paramCount++;
        }

        // Filtro por precio
        if (precioMin !== undefined) {
            query += `
                AND EXISTS (
                    SELECT 1 FROM marketplace_servicio_sucursal mss
                    WHERE mss.id_sucursal = l.id_sucursal
                      AND mss.activo = true
                      AND mss.precio >= $${paramCount}
                )
            `;
            params.push(precioMin);
            paramCount++;
        }

        if (precioMax !== undefined) {
            query += `
                AND EXISTS (
                    SELECT 1 FROM marketplace_servicio_sucursal mss
                    WHERE mss.id_sucursal = l.id_sucursal
                      AND mss.activo = true
                      AND mss.precio <= $${paramCount}
                )
            `;
            params.push(precioMax);
            paramCount++;
        }

        // Filtro solo ofertas
        if (soloOfertas) {
            query += `
                AND EXISTS (
                    SELECT 1 FROM marketplace_promo p
                    WHERE p.id_sucursal = l.id_sucursal
                      AND p.activo = true
                      AND p.fecha_inicio <= CURRENT_DATE
                      AND p.fecha_fin >= CURRENT_DATE
                      AND (p.cupo_total IS NULL OR p.cupo_usado < p.cupo_total)
                )
            `;
        }

        query += `
            GROUP BY l.id, l.id_sucursal, l.titulo_publico, l.descripcion_publica, 
                     l.lat, l.lng, l.fotos_json, l.telefono_publico, l.email_publico, 
                     l.whatsapp_publico, s.nombre, s.direccion
        `;

        // Filtro por rating mínimo
        if (ratingMin) {
            query += ` HAVING COALESCE(AVG(r.rating), 0) >= $${paramCount}`;
            params.push(ratingMin);
            paramCount++;
        }

        query += ` ORDER BY rating DESC NULLS LAST LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
        params.push(limit, offset);

        const result = await executor.query(query, params);
        return result.rows;
    }

    /**
     * Obtener detalle completo de una sucursal
     */
    async getSucursalDetail(idSucursal, client) {
        const executor = getExecutor(client);

        const query = `
            SELECT 
                l.*,
                s.nombre as sucursal_nombre,
                s.direccion,
                s.id_tenant,
                COALESCE(AVG(r.rating), 0) as rating,
                COUNT(DISTINCT r.id) as reviews_count
            FROM marketplace_listing l
            JOIN sucursal s ON s.id = l.id_sucursal
            LEFT JOIN marketplace_review r ON r.id_sucursal = l.id_sucursal AND r.visible = true
            WHERE l.id_sucursal = $1
            GROUP BY l.id, s.nombre, s.direccion, s.id_tenant
        `;

        const result = await executor.query(query, [idSucursal]);
        return result.rows[0];
    }

    /**
     * Obtener servicios de una sucursal
     */
    async getServiciosBySucursal(idSucursal, client) {
        const executor = getExecutor(client);

        const query = `
            SELECT 
                mss.id,
                ms.id as id_servicio,
                ms.nombre,
                ms.categoria,
                ms.descripcion,
                mss.precio,
                mss.duracion_min,
                mss.precio_desde,
                mss.rank_destacado
            FROM marketplace_servicio_sucursal mss
            JOIN marketplace_servicio ms ON ms.id = mss.id_servicio
            WHERE mss.id_sucursal = $1
              AND mss.activo = true
            ORDER BY mss.rank_destacado ASC, ms.nombre ASC
        `;

        const result = await executor.query(query, [idSucursal]);
        return result.rows;
    }

    /**
     * Obtener promociones activas de una sucursal
     */
    async getPromosBySucursal(idSucursal, client) {
        const executor = getExecutor(client);

        const query = `
            SELECT 
                p.*,
                ms.nombre as servicio_nombre
            FROM marketplace_promo p
            LEFT JOIN marketplace_servicio ms ON ms.id = p.id_servicio
            WHERE p.id_sucursal = $1
              AND p.activo = true
              AND p.fecha_inicio <= CURRENT_DATE
              AND p.fecha_fin >= CURRENT_DATE
              AND (p.cupo_total IS NULL OR p.cupo_usado < p.cupo_total)
            ORDER BY p.valor_descuento DESC
        `;

        const result = await executor.query(query, [idSucursal]);
        return result.rows;
    }

    /**
     * Obtener reseñas de una sucursal
     */
    async getReviewsBySucursal(idSucursal, limit = 10, offset = 0, client) {
        const executor = getExecutor(client);

        const query = `
            SELECT 
                r.id,
                r.rating,
                r.comentario,
                r.fotos_json,
                r.created_at,
                c.nombre as cliente_nombre
            FROM marketplace_review r
            JOIN clientefinal c ON c.id = r.id_cliente
            WHERE r.id_sucursal = $1
              AND r.visible = true
            ORDER BY r.created_at DESC
            LIMIT $2 OFFSET $3
        `;

        const result = await executor.query(query, [idSucursal, limit, offset]);

        // Debug fotos
        if (result.rows.length > 0) {
            console.log(`[DEBUG] Reviews found: ${result.rows.length}`);
            result.rows.forEach((r, i) => console.log(`Review ${i} fotos_json:`, r.fotos_json, typeof r.fotos_json));
        }

        return result.rows;
    }

    // =====================================
    // GESTIÓN ADMIN
    // =====================================

    /**
     * Activar/desactivar marketplace para una sucursal
     */
    async upsertListing(listingData, client) {
        const executor = getExecutor(client);
        const {
            id_tenant,
            id_sucursal,
            activo,
            titulo_publico,
            descripcion_publica,
            telefono_publico,
            email_publico,
            whatsapp_publico,
            lat,
            lng,
            fotos_json,
            horario_json,
            politica_cancelacion,
            reserva_online_activa,
            min_horas_anticipacion,
            cancelacion_horas_limite,
            deposito_activo,
            deposito_tipo,
            deposito_valor
        } = listingData;

        const query = `
            INSERT INTO marketplace_listing (
                id_tenant, id_sucursal, activo, titulo_publico, descripcion_publica,
                telefono_publico, email_publico, whatsapp_publico, lat, lng,
                fotos_json, horario_json, politica_cancelacion,
                reserva_online_activa, min_horas_anticipacion, cancelacion_horas_limite,
                deposito_activo, deposito_tipo, deposito_valor,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
                $11, $12, $13, $14, $15, $16, $17, $18, $19,
                NOW(), NOW()
            )
            ON CONFLICT (id_sucursal)
            DO UPDATE SET
                activo = EXCLUDED.activo,
                titulo_publico = EXCLUDED.titulo_publico,
                descripcion_publica = EXCLUDED.descripcion_publica,
                telefono_publico = EXCLUDED.telefono_publico,
                email_publico = EXCLUDED.email_publico,
                whatsapp_publico = EXCLUDED.whatsapp_publico,
                lat = EXCLUDED.lat,
                lng = EXCLUDED.lng,
                fotos_json = EXCLUDED.fotos_json,
                horario_json = EXCLUDED.horario_json,
                politica_cancelacion = EXCLUDED.politica_cancelacion,
                reserva_online_activa = EXCLUDED.reserva_online_activa,
                min_horas_anticipacion = EXCLUDED.min_horas_anticipacion,
                cancelacion_horas_limite = EXCLUDED.cancelacion_horas_limite,
                deposito_activo = EXCLUDED.deposito_activo,
                deposito_tipo = EXCLUDED.deposito_tipo,
                deposito_valor = EXCLUDED.deposito_valor,
                updated_at = NOW()
            RETURNING *
        `;

        const values = [
            id_tenant, id_sucursal, activo, titulo_publico, descripcion_publica,
            telefono_publico, email_publico, whatsapp_publico, lat, lng,
            fotos_json || '[]', horario_json, politica_cancelacion,
            reserva_online_activa, min_horas_anticipacion, cancelacion_horas_limite,
            deposito_activo, deposito_tipo, deposito_valor
        ];

        const result = await executor.query(query, values);
        return result.rows[0];
    }

    /**
     * Agregar/actualizar servicio de una sucursal
     */
    async upsertServicioSucursal(servicioData, client) {
        const executor = getExecutor(client);
        const {
            id_tenant,
            id_sucursal,
            id_servicio,
            precio,
            duracion_min,
            precio_desde,
            activo,
            rank_destacado,
            permite_reserva_online
        } = servicioData;

        const query = `
            INSERT INTO marketplace_servicio_sucursal (
                id_tenant, id_sucursal, id_servicio, precio, duracion_min,
                precio_desde, activo, rank_destacado, permite_reserva_online,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
            )
            ON CONFLICT (id_sucursal, id_servicio)
            DO UPDATE SET
                precio = EXCLUDED.precio,
                duracion_min = EXCLUDED.duracion_min,
                precio_desde = EXCLUDED.precio_desde,
                activo = EXCLUDED.activo,
                rank_destacado = EXCLUDED.rank_destacado,
                permite_reserva_online = EXCLUDED.permite_reserva_online,
                updated_at = NOW()
            RETURNING *
        `;

        const values = [
            id_tenant, id_sucursal, id_servicio, precio, duracion_min,
            precio_desde, activo, rank_destacado, permite_reserva_online
        ];

        const result = await executor.query(query, values);
        return result.rows[0];
    }

    /**
     * Crear promoción
     */
    async createPromo(promoData, client) {
        const executor = getExecutor(client);
        const {
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
            horas_json,
            cupo_total,
            activo
        } = promoData;

        const query = `
            INSERT INTO marketplace_promo (
                id_tenant, id_sucursal, id_servicio, titulo, descripcion,
                tipo_descuento, valor_descuento, fecha_inicio, fecha_fin,
                dias_semana_json, horas_json, cupo_total, activo,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
                NOW(), NOW()
            )
            RETURNING *
        `;

        const values = [
            id_tenant, id_sucursal, id_servicio, titulo, descripcion,
            tipo_descuento, valor_descuento, fecha_inicio, fecha_fin,
            dias_semana_json, horas_json, cupo_total, activo
        ];

        const result = await executor.query(query, values);
        return result.rows[0];
    }

    /**
     * Obtener todos los servicios del catálogo
     */
    async getAllServicios(client) {
        const executor = getExecutor(client);

        const query = `
            SELECT * FROM marketplace_servicio
            WHERE activo = true
            ORDER BY categoria, nombre
        `;

        const result = await executor.query(query);
        return result.rows;
    }

    /**
     * Verificar si una sucursal pertenece a un tenant
     */
    async checkSucursalTenant(idSucursal, idTenant, client) {
        const executor = getExecutor(client);
        const result = await executor.query(
            'SELECT id FROM sucursal WHERE id = $1 AND id_tenant = $2',
            [idSucursal, idTenant]
        );
        return result.rows.length > 0;
    }
}

module.exports = new MarketplaceRepository();
