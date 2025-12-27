const marketplaceRepo = require('../repositories/marketplaceRepository');
const pool = require('../db');

class MarketplaceService {

    /**
     * Buscar talleres en el marketplace
     */
    async searchTalleres(filters) {
        try {
            const talleres = await marketplaceRepo.searchSucursales(filters);

            // Formatear respuesta
            return talleres.map(taller => ({
                id_sucursal: taller.id_sucursal,
                nombre: taller.titulo_publico || taller.sucursal_nombre,
                direccion: taller.direccion,
                zona: taller.zona,
                lat: parseFloat(taller.lat),
                lng: parseFloat(taller.lng),
                rating: parseFloat(taller.rating) || 0,
                reviews_count: parseInt(taller.reviews_count) || 0,
                fotos: taller.fotos_json || [],
                telefono: taller.telefono_publico,
                email: taller.email_publico,
                whatsapp: taller.whatsapp_publico,
                servicios_destacados: taller.servicios_destacados || [],
                tiene_oferta: taller.tiene_oferta || false
            }));
        } catch (error) {
            console.error('Error en searchTalleres:', error);
            throw error;
        }
    }

    /**
     * Obtener detalle completo de un taller
     */
    async getTallerDetail(idSucursal) {
        try {
            // Obtener datos básicos
            const taller = await marketplaceRepo.getSucursalDetail(idSucursal);

            if (!taller) {
                throw new Error('Taller no encontrado o no activo en marketplace');
            }

            // Obtener servicios
            const servicios = await marketplaceRepo.getServiciosBySucursal(idSucursal);

            // Obtener promociones
            const promociones = await marketplaceRepo.getPromosBySucursal(idSucursal);

            // Obtener reseñas
            const resenas = await marketplaceRepo.getReviewsBySucursal(idSucursal, 10, 0);

            return {
                id_sucursal: taller.id_sucursal,
                nombre: taller.titulo_publico || taller.sucursal_nombre,
                descripcion: taller.descripcion_publica,
                direccion: taller.direccion,
                zona: taller.zona,
                provincia: taller.provincia,
                pais: taller.pais,
                lat: parseFloat(taller.lat),
                lng: parseFloat(taller.lng),
                telefono: taller.telefono_publico,
                email: taller.email_publico,
                whatsapp: taller.whatsapp_publico,
                fotos: taller.fotos_json || [],
                horario: taller.horario_json,
                politica_cancelacion: taller.politica_cancelacion,
                rating: parseFloat(taller.rating) || 0,
                reviews_count: parseInt(taller.reviews_count) || 0,
                servicios_completos: servicios.map(s => ({
                    id: s.id_servicio,
                    nombre: s.nombre,
                    categoria: s.categoria,
                    descripcion: s.descripcion,
                    precio: parseFloat(s.precio),
                    duracion_min: parseInt(s.duracion_min),
                    precio_desde: s.precio_desde
                })),
                ofertas: promociones.map(p => ({
                    id: p.id,
                    titulo: p.titulo,
                    descripcion: p.descripcion,
                    tipo_descuento: p.tipo_descuento,
                    descuento: parseFloat(p.valor_descuento),
                    validez: p.fecha_fin
                })),
                resenas: resenas.map(r => ({
                    id: r.id,
                    cliente: r.cliente_nombre,
                    rating: r.rating,
                    fecha: r.created_at,
                    comentario: r.comentario
                })),
                configuracion: {
                    reserva_online: taller.reserva_online_activa,
                    min_horas_anticipacion: taller.min_horas_anticipacion,
                    cancelacion_horas_limite: taller.cancelacion_horas_limite,
                    deposito_activo: taller.deposito_activo,
                    deposito_tipo: taller.deposito_tipo,
                    deposito_valor: taller.deposito_valor ? parseFloat(taller.deposito_valor) : null
                }
            };
        } catch (error) {
            console.error('Error en getTallerDetail:', error);
            throw error;
        }
    }

    /**
 * Obtener disponibilidad de un taller para una fecha
 * Genera slots basados en el horario configurado y las citas existentes
 */
    async getAvailability(idSucursal, fecha, servicioId) {
        try {
            // Get listing with schedule
            const listingResult = await pool.query(
                'SELECT horario_json, min_horas_anticipacion FROM marketplace_listing WHERE id_sucursal = $1 AND activo = true AND reserva_online_activa = true',
                [idSucursal]
            );

            if (listingResult.rows.length === 0) {
                throw new Error('Taller no disponible para reservas online');
            }

            const listing = listingResult.rows[0];
            const horario = listing.horario_json || {};
            const minHorasAnticipacion = listing.min_horas_anticipacion || 2;

            // Parse the date and get day of week
            const fechaDate = new Date(fecha + 'T00:00:00');
            const diasSemana = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            const diaSemana = diasSemana[fechaDate.getDay()];

            // Get schedule for this day
            const diaHorario = horario[diaSemana];

            if (!diaHorario || !diaHorario.activo) {
                // Day is closed
                return [];
            }

            // Parse start and end times
            const [horaInicio, minInicio] = diaHorario.inicio.split(':').map(Number);
            const [horaFin, minFin] = diaHorario.fin.split(':').map(Number);

            // Get existing appointments for this day (from citataller table)
            const citasResult = await pool.query(
                `SELECT fecha_hora FROM citataller 
             WHERE id_sucursal = $1 
             AND DATE(fecha_hora) = $2
             AND estado NOT IN ('cancelada', 'no_asistio')`,
                [idSucursal, fecha]
            );

            const citasOcupadas = citasResult.rows.map(c => {
                const citaDate = new Date(c.fecha_hora);
                return citaDate.getHours().toString().padStart(2, '0') + ':' + citaDate.getMinutes().toString().padStart(2, '0');
            });

            // Generate slots (every 30 minutes)
            const slots = [];
            const now = new Date();
            const fechaHoy = now.toISOString().split('T')[0];

            for (let hora = horaInicio; hora < horaFin; hora++) {
                for (let min = 0; min < 60; min += 30) {
                    // Skip if past end time
                    if (hora === horaFin - 1 && min >= minFin) continue;

                    const horaStr = hora.toString().padStart(2, '0') + ':' + min.toString().padStart(2, '0');

                    // Check if slot is available
                    let disponible = !citasOcupadas.includes(horaStr);

                    // Check anticipation time for today
                    if (fecha === fechaHoy && disponible) {
                        const slotTime = new Date(fecha + 'T' + horaStr + ':00');
                        const diffHours = (slotTime - now) / (1000 * 60 * 60);
                        if (diffHours < minHorasAnticipacion) {
                            disponible = false;
                        }
                    }

                    // Check if date is in the past
                    if (fecha < fechaHoy) {
                        disponible = false;
                    }

                    slots.push({
                        hora: horaStr,
                        disponible
                    });
                }
            }

            return slots;
        } catch (error) {
            console.error('Error en getAvailability:', error);
            throw error;
        }
    }
    /**
     * Crear una reserva desde el marketplace
     * ARQUITECTURA: tenant → sucursal → citataller
     * 
     * Campos NOT NULL en citataller: id_sucursal, id_cliente, id_vehiculo
     */
    async createBooking(bookingData) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            const {
                sucursalId,
                servicioId,
                fecha,
                hora,
                nombre,
                telefono,
                email,
                tipoVehiculo,
                matricula,
                notas,
                id_cliente // Puede venir del cliente logueado o null
            } = bookingData;

            // =====================================================
            // 1. VALIDAR SUCURSAL Y OBTENER id_tenant
            // =====================================================
            const taller = await marketplaceRepo.getSucursalDetail(sucursalId, client);
            if (!taller) {
                throw new Error('Sucursal no encontrada');
            }
            if (!taller.reserva_online_activa) {
                throw new Error('Este taller no acepta reservas online');
            }

            const idTenant = taller.id_tenant;
            if (!idTenant) {
                throw new Error('Error de configuración: Sucursal sin tenant asociado');
            }

            // =====================================================
            // 2. CLIENTE (NOT NULL) - Buscar o crear
            // =====================================================
            let clienteId = id_cliente;

            if (clienteId) {
                // Verificar que el cliente existe
                const clienteCheck = await client.query(
                    'SELECT id FROM clientefinal WHERE id = $1',
                    [clienteId]
                );
                if (clienteCheck.rows.length === 0) {
                    throw new Error('Sesión inválida. Por favor, cierra sesión e inicia de nuevo.');
                }
            } else {
                // Buscar cliente existente por email en este tenant
                const clienteExistente = await client.query(
                    `SELECT id FROM clientefinal 
                     WHERE LOWER(email) = LOWER($1) AND id_tenant = $2 
                     LIMIT 1`,
                    [email, idTenant]
                );

                if (clienteExistente.rows.length > 0) {
                    clienteId = clienteExistente.rows[0].id;
                } else {
                    // Crear nuevo cliente (guest) en el tenant correcto
                    const nuevoCliente = await client.query(
                        `INSERT INTO clientefinal (nombre, email, telefono, id_tenant)
                         VALUES ($1, $2, $3, $4)
                         RETURNING id`,
                        [nombre, email, telefono, idTenant]
                    );
                    clienteId = nuevoCliente.rows[0].id;
                }
            }

            // =====================================================
            // 3. VEHÍCULO (NOT NULL) - Buscar o crear SIEMPRE
            // =====================================================
            let vehiculoId = null;
            const matriculaReal = matricula ? matricula.toUpperCase().trim() : null;

            if (matriculaReal) {
                // Buscar vehículo por matrícula Y cliente (validar propiedad)
                const vehiculoExistente = await client.query(
                    `SELECT id, id_cliente FROM vehiculo 
                     WHERE UPPER(matricula) = $1 
                     LIMIT 1`,
                    [matriculaReal]
                );

                if (vehiculoExistente.rows.length > 0) {
                    const veh = vehiculoExistente.rows[0];
                    // Validar que pertenece al cliente o asignarlo
                    if (veh.id_cliente && veh.id_cliente !== clienteId) {
                        // Vehículo de otro cliente - crear uno nuevo para este cliente
                        const nuevoVehiculo = await client.query(
                            `INSERT INTO vehiculo (matricula, id_cliente, id_sucursal, marca, modelo)
                             VALUES ($1, $2, $3, $4, $5)
                             RETURNING id`,
                            [matriculaReal + '-DUP', clienteId, sucursalId, tipoVehiculo || 'Marketplace', 'Reserva Online']
                        );
                        vehiculoId = nuevoVehiculo.rows[0].id;
                    } else {
                        vehiculoId = veh.id;
                    }
                } else {
                    // Crear nuevo vehículo
                    const nuevoVehiculo = await client.query(
                        `INSERT INTO vehiculo (matricula, id_cliente, id_sucursal, marca, modelo)
                         VALUES ($1, $2, $3, $4, $5)
                         RETURNING id`,
                        [matriculaReal, clienteId, sucursalId, tipoVehiculo || 'Marketplace', 'Reserva Online']
                    );
                    vehiculoId = nuevoVehiculo.rows[0].id;
                }
            } else {
                // Sin matrícula - crear vehículo genérico (id_vehiculo es NOT NULL)
                const nuevoVehiculo = await client.query(
                    `INSERT INTO vehiculo (matricula, id_cliente, id_sucursal, marca, modelo)
                     VALUES ($1, $2, $3, $4, $5)
                     RETURNING id`,
                    [`TEMP-${Date.now()}`, clienteId, sucursalId, tipoVehiculo || 'Sin especificar', 'Reserva Online']
                );
                vehiculoId = nuevoVehiculo.rows[0].id;
            }

            // =====================================================
            // 4. OBTENER INFO DEL SERVICIO (para motivo y duración)
            // =====================================================
            let duracionEstimada = 60;
            let motivoServicio = 'Reserva online';

            if (servicioId) {
                const servicioResult = await client.query(
                    `SELECT ms.nombre, mss.duracion_min 
                     FROM marketplace_servicio_sucursal mss
                     JOIN marketplace_servicio ms ON ms.id = mss.id_servicio
                     WHERE mss.id_sucursal = $1 AND mss.id_servicio = $2`,
                    [sucursalId, servicioId]
                );
                if (servicioResult.rows.length > 0) {
                    duracionEstimada = servicioResult.rows[0].duracion_min || 60;
                    motivoServicio = servicioResult.rows[0].nombre || 'Reserva online';
                }
            }

            // =====================================================
            // 5. CREAR CITA (citataller)
            // NOT NULL: id_sucursal, id_cliente, id_vehiculo
            // =====================================================
            const fechaHora = new Date(`${fecha}T${hora}:00`);

            const citaResult = await client.query(
                `INSERT INTO citataller 
                 (id_sucursal, id_cliente, id_vehiculo, fecha_hora, duracion_min, estado, motivo, notas, nombre_cliente, telefono_cliente, correo_cliente)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                 RETURNING id`,
                [
                    sucursalId,          // NOT NULL
                    clienteId,           // NOT NULL
                    vehiculoId,          // NOT NULL
                    fechaHora,
                    duracionEstimada,
                    'pendiente',
                    motivoServicio,
                    notas || null,
                    nombre,
                    telefono,
                    email
                ]
            );

            const reservaId = citaResult.rows[0].id;

            await client.query('COMMIT');

            return {
                success: true,
                reservaId: reservaId,
                mensaje: 'Reserva creada exitosamente',
                detalles: {
                    sucursal: taller.titulo_publico || taller.sucursal_nombre,
                    fecha,
                    hora,
                    cliente: nombre,
                    servicio: motivoServicio,
                    isLoggedIn: !!id_cliente
                }
            };
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error en createBooking:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    // =====================================
    // ADMIN METHODS
    // =====================================

    /**
     * Actualizar/crear listing de una sucursal (solo admin del tenant)
     */
    async updateListing(idTenant, listingData) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Verificar que la sucursal pertenezca al tenant
            const belongsToTenant = await marketplaceRepo.checkSucursalTenant(
                listingData.id_sucursal,
                idTenant,
                client
            );

            if (!belongsToTenant) {
                throw new Error('Sucursal no pertenece a tu organización');
            }

            listingData.id_tenant = idTenant;
            const listing = await marketplaceRepo.upsertListing(listingData, client);

            await client.query('COMMIT');
            return listing;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error en updateListing:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Agregar/actualizar servicio de una sucursal
     */
    async updateServicioSucursal(idTenant, servicioData) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Verificar que la sucursal pertenezca al tenant
            const belongsToTenant = await marketplaceRepo.checkSucursalTenant(
                servicioData.id_sucursal,
                idTenant,
                client
            );

            if (!belongsToTenant) {
                throw new Error('Sucursal no pertenece a tu organización');
            }

            servicioData.id_tenant = idTenant;
            const servicio = await marketplaceRepo.upsertServicioSucursal(servicioData, client);

            await client.query('COMMIT');
            return servicio;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error en updateServicioSucursal:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Crear promoción
     */
    async createPromocion(idTenant, promoData) {
        const client = await pool.connect();

        try {
            await client.query('BEGIN');

            // Verificar que la sucursal pertenezca al tenant
            const belongsToTenant = await marketplaceRepo.checkSucursalTenant(
                promoData.id_sucursal,
                idTenant,
                client
            );

            if (!belongsToTenant) {
                throw new Error('Sucursal no pertenece a tu organización');
            }

            promoData.id_tenant = idTenant;
            const promo = await marketplaceRepo.createPromo(promoData, client);

            await client.query('COMMIT');
            return promo;
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('Error en createPromocion:', error);
            throw error;
        } finally {
            client.release();
        }
    }

    /**
     * Obtener catálogo de servicios disponibles
     */
    async getCatalogoServicios() {
        try {
            const servicios = await marketplaceRepo.getAllServicios();

            // Agrupar por categoría
            const categorias = {};
            servicios.forEach(s => {
                if (!categorias[s.categoria]) {
                    categorias[s.categoria] = [];
                }
                categorias[s.categoria].push({
                    id: s.id,
                    nombre: s.nombre,
                    descripcion: s.descripcion
                });
            });

            return categorias;
        } catch (error) {
            console.error('Error en getCatalogoServicios:', error);
            throw error;
        }
    }

    /**
     * Obtener reseñas de un taller
     */
    async getReviews(idSucursal, limit = 10, offset = 0) {
        try {
            const resenas = await marketplaceRepo.getReviewsBySucursal(idSucursal, limit, offset);
            return resenas.map(r => ({
                id: r.id,
                rating: r.rating,
                comentario: r.comentario,
                fotos: r.fotos_json || [],
                created_at: r.created_at,
                cliente_nombre: r.cliente_nombre
            }));
        } catch (error) {
            console.error('Error en getReviews:', error);
            throw error;
        }
    }
}

module.exports = new MarketplaceService();
