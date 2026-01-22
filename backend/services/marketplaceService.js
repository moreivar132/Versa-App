const marketplaceRepo = require('../repositories/marketplaceRepository');

const { getTenantDb, getSystemDb } = require('../src/core/db/index');

function resolveDb(ctxOrDb) {
    // If it has .query, it's likely a DB instance (TenantDb or SystemDb)
    if (ctxOrDb && typeof ctxOrDb.query === 'function') return ctxOrDb;
    // If it has tenantId or isSuperAdmin, it's a context object
    if (ctxOrDb && (ctxOrDb.tenantId || ctxOrDb.isSuperAdmin)) return getTenantDb(ctxOrDb);
    // Otherwise, default to System DB for public marketplace usage
    return getSystemDb({ source: 'marketplaceService', reason: 'public_access' });
}

/**
 * Safely parse a value to float, returning null if invalid
 */
function safeParseFloat(value) {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'string' ? parseFloat(value.replace(',', '.')) : Number(value);
    return Number.isFinite(n) ? n : null;
}

class MarketplaceService {

    /**
     * Buscar talleres en el marketplace
     */
    async searchTalleres(filters, ctxOrDb) {
        try {
            const db = resolveDb(ctxOrDb);
            const talleres = await marketplaceRepo.searchSucursales(filters, db);

            // Formatear respuesta con coords normalizadas
            return talleres.map(taller => ({
                id_sucursal: taller.id_sucursal,
                nombre: taller.titulo_publico || taller.sucursal_nombre,
                direccion: taller.direccion,
                zona: taller.zona,
                lat: safeParseFloat(taller.lat),  // ✅ number | null (never NaN)
                lng: safeParseFloat(taller.lng),  // ✅ number | null (never NaN)
                rating: safeParseFloat(taller.rating) || 0,
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
    async getTallerDetail(idSucursal, ctxOrDb) {
        try {
            const db = resolveDb(ctxOrDb);
            // Obtener datos básicos
            const taller = await marketplaceRepo.getSucursalDetail(idSucursal, db);

            if (!taller) {
                throw new Error('Taller no encontrado o no activo en marketplace');
            }

            // Obtener servicios
            const servicios = await marketplaceRepo.getServiciosBySucursal(idSucursal, db);

            // Obtener promociones
            const promociones = await marketplaceRepo.getPromosBySucursal(idSucursal, db);

            // Obtener reseñas
            const resenas = await marketplaceRepo.getReviewsBySucursal(idSucursal, 10, 0, db);

            return {
                id_sucursal: taller.id_sucursal,
                nombre: taller.titulo_publico || taller.sucursal_nombre,
                descripcion: taller.descripcion_publica,
                direccion: taller.direccion,
                zona: taller.zona,
                provincia: taller.provincia,
                pais: taller.pais,
                lat: safeParseFloat(taller.lat),  // ✅ number | null
                lng: safeParseFloat(taller.lng),  // ✅ number | null
                telefono: taller.telefono_publico,
                email: taller.email_publico,
                whatsapp: taller.whatsapp_publico,
                fotos: taller.fotos_json || [],
                horario: taller.horario_json,
                politica_cancelacion: taller.politica_cancelacion,
                rating: safeParseFloat(taller.rating) || 0,
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
                    comentario: r.comentario,
                    fotos: r.fotos_json || []
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
    async getAvailability(idSucursal, fecha, servicioId, ctxOrDb) {
        try {
            const db = resolveDb(ctxOrDb);
            // Get listing with schedule
            const listingResult = await db.query(
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
            const citasResult = await db.query(
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
     * FLUJO COMPLETO:
     * 1. Validar sucursal y obtener tenant
     * 2. Crear/buscar cliente
     * 3. Crear/buscar vehículo
     * 4. Obtener servicio y precio
     * 5. Crear cita
     * 6. Calcular monto (depósito o total)
     * 7. Crear Stripe Checkout Session
     * 8. Guardar registro de pago
     * 9. Enviar WhatsApp de confirmación
     * 
     * Campos NOT NULL en citataller: id_sucursal, id_cliente, id_vehiculo
     */
    async createBooking(bookingData, ctxOrDb) {
        const db = resolveDb(ctxOrDb);

        // Variables que necesitamos fuera del try para el WhatsApp
        let reservaId = null;
        let tallerNombre = null;
        let paymentResult = null;

        try {
            await db.txWithRLS(async (client) => {
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
                    id_cliente, // Puede venir del cliente logueado o null
                    payment_mode // 'DEPOSITO' | 'TOTAL' | 'NONE' | null
                } = bookingData;

                // =====================================================
                // 1. VALIDAR SUCURSAL Y OBTENER id_tenant + config depósito
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

                tallerNombre = taller.titulo_publico || taller.sucursal_nombre;

                // Configuración de depósito del listing
                const depositoConfig = {
                    activo: taller.deposito_activo || false,
                    tipo: taller.deposito_tipo || 'FIJO', // 'FIJO' o 'PORCENTAJE'
                    valor: taller.deposito_valor ? parseFloat(taller.deposito_valor) : 0
                };

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
                // 4. OBTENER INFO DEL SERVICIO (nombre, duración Y PRECIO)
                // =====================================================
                let duracionEstimada = 60;
                let motivoServicio = 'Reserva online';
                let precioServicio = 0;

                if (servicioId) {
                    const servicioResult = await client.query(
                        `SELECT ms.nombre, mss.duracion_min, mss.precio
                         FROM marketplace_servicio_sucursal mss
                         JOIN marketplace_servicio ms ON ms.id = mss.id_servicio
                         WHERE mss.id_sucursal = $1 AND mss.id_servicio = $2`,
                        [sucursalId, servicioId]
                    );
                    if (servicioResult.rows.length > 0) {
                        duracionEstimada = servicioResult.rows[0].duracion_min || 60;
                        motivoServicio = servicioResult.rows[0].nombre || 'Reserva online';
                        precioServicio = parseFloat(servicioResult.rows[0].precio) || 0;
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

                reservaId = citaResult.rows[0].id;

                // =====================================================
                // 6. DETERMINAR payment_mode Y CALCULAR MONTO
                // =====================================================
                let finalPaymentMode = payment_mode;

                // Si no viene payment_mode, decidir automáticamente
                if (!finalPaymentMode || finalPaymentMode === 'NONE') {
                    if (depositoConfig.activo && depositoConfig.valor > 0) {
                        finalPaymentMode = 'DEPOSITO';
                    } else if (precioServicio > 0) {
                        finalPaymentMode = 'TOTAL';
                    } else {
                        finalPaymentMode = 'NONE';
                    }
                }

                let amount = 0;
                if (finalPaymentMode === 'TOTAL') {
                    amount = precioServicio;
                } else if (finalPaymentMode === 'DEPOSITO') {
                    if (depositoConfig.tipo === 'PORCENTAJE') {
                        amount = (precioServicio * depositoConfig.valor) / 100;
                    } else {
                        // FIJO
                        amount = depositoConfig.valor;
                    }
                }

                // Redondear a 2 decimales
                amount = Math.round(amount * 100) / 100;

                // =====================================================
                // 7. CREAR STRIPE CHECKOUT SESSION (si hay pago)
                // =====================================================
                if (finalPaymentMode !== 'NONE' && amount > 0) {
                    try {
                        const stripeService = require('./stripeService');

                        const stripeSession = await stripeService.createCheckoutSessionForBooking({
                            id_tenant: idTenant,
                            id_sucursal: sucursalId,
                            id_cita: reservaId,
                            id_cliente: clienteId,
                            payment_mode: finalPaymentMode,
                            amount: amount,
                            currency: 'eur',
                            customer_email: email,
                            customer_phone: telefono,
                            service_name: motivoServicio,
                            sucursal_name: tallerNombre
                        });

                        // =====================================================
                        // 8. GUARDAR REGISTRO DE PAGO EN marketplace_reserva_pago
                        // =====================================================
                        await client.query(
                            `INSERT INTO marketplace_reserva_pago 
                             (id_tenant, id_sucursal, id_cita, id_cliente, payment_mode, amount, currency, status, stripe_checkout_session_id, checkout_url, metadata_json)
                             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                            [
                                idTenant,
                                sucursalId,
                                reservaId,
                                clienteId || null,
                                finalPaymentMode,
                                amount,
                                'eur',
                                'PENDING',
                                stripeSession.session_id,
                                stripeSession.checkout_url,
                                JSON.stringify({
                                    servicio: motivoServicio,
                                    precio_total_servicio: precioServicio,
                                    cliente_nombre: nombre,
                                    cliente_telefono: telefono
                                })
                            ]
                        );

                        paymentResult = {
                            requires_payment: true,
                            payment_mode: finalPaymentMode,
                            amount: amount,
                            checkout_url: stripeSession.checkout_url,
                            session_id: stripeSession.session_id
                        };

                    } catch (stripeError) {
                        console.error('Error creando Stripe session:', stripeError);
                        // No fallar el booking por error de Stripe, pero registrar
                        paymentResult = {
                            requires_payment: true,
                            payment_mode: finalPaymentMode,
                            amount: amount,
                            checkout_url: null,
                            error: 'No se pudo generar el enlace de pago. Contacta con el taller.'
                        };
                    }
                } else {
                    paymentResult = {
                        requires_payment: false,
                        payment_mode: 'NONE',
                        amount: 0
                    };
                }

            }); // End transaction

        } catch (error) {
            console.error('Error en createBooking:', error);
            throw error;
        }

        // =====================================================
        // 9. ENVIAR WHATSAPP DE CONFIRMACIÓN (fuera de transacción)
        // =====================================================
        // Esto va fuera del try-catch de la transacción para que
        // un error de WhatsApp no afecte la reserva
        try {
            const timelinesService = require('./timelinesService');
            const { telefono, nombre, fecha, hora } = bookingData;

            // Formatear fecha para mensaje
            const fechaFormateada = new Date(`${fecha}T${hora}:00`).toLocaleDateString('es-ES', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            let mensajeWhatsApp = `¡Hola ${nombre}! 👋\n\n`;
            mensajeWhatsApp += `Tu reserva en *${tallerNombre}* ha sido registrada:\n\n`;
            mensajeWhatsApp += `📅 *${fechaFormateada}*\n`;
            mensajeWhatsApp += `🔧 Servicio: ${bookingData.servicioId ? paymentResult?.service_name || 'Servicio' : 'Por confirmar'}\n`;
            mensajeWhatsApp += `📍 Referencia: #${reservaId}\n\n`;

            if (paymentResult?.requires_payment && paymentResult.checkout_url) {
                mensajeWhatsApp += `💳 *Pago pendiente*: ${paymentResult.amount.toFixed(2)}€ (${paymentResult.payment_mode === 'DEPOSITO' ? 'Señal' : 'Total'})\n\n`;
                mensajeWhatsApp += `👉 Completa tu pago aquí:\n${paymentResult.checkout_url}\n\n`;
                mensajeWhatsApp += `⏰ El enlace expira en 30 minutos.\n\n`;
            }

            mensajeWhatsApp += `Si tienes alguna pregunta, responde a este mensaje. ¡Gracias por confiar en nosotros! 🚗`;

            // Enviar mensaje
            if (telefono && telefono.startsWith('+')) {
                await timelinesService.sendInitialMessage(telefono, `Reserva confirmada: ${tallerNombre} - ${fechaFormateada}`);
                console.log(`[WhatsApp] Mensaje de confirmación enviado a ${telefono}`);
            }
        } catch (whatsappError) {
            // No fallar el booking por error de WhatsApp
            console.warn('[WhatsApp] No se pudo enviar mensaje de confirmación:', whatsappError.message);
        }

        // =====================================================
        // 10. RETORNAR RESPUESTA
        // =====================================================
        return {
            success: true,
            id_cita: reservaId,
            reservaId: reservaId, // Mantener compatibilidad
            mensaje: 'Reserva creada exitosamente',
            detalles: {
                sucursal: tallerNombre,
                fecha: bookingData.fecha,
                hora: bookingData.hora,
                cliente: bookingData.nombre,
                servicio: bookingData.servicioId ? 'Servicio confirmado' : 'Reserva online',
                isLoggedIn: !!bookingData.id_cliente
            },
            // Datos de pago
            ...paymentResult
        };
    }

    // =====================================
    // ADMIN METHODS
    // =====================================

    /**
     * Actualizar/crear listing de una sucursal (solo admin del tenant)
     */
    async updateListing(idTenant, listingData, ctxOrDb) {
        const db = resolveDb(ctxOrDb);

        try {
            return await db.txWithRLS(async (client) => {

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

                return listing;
            });
        } catch (error) {
            console.error('Error en updateListing:', error);
            throw error;
        }
    }

    /**
     * Agregar/actualizar servicio de una sucursal
     */
    async updateServicioSucursal(idTenant, servicioData, ctxOrDb) {
        const db = resolveDb(ctxOrDb);

        try {
            return await db.txWithRLS(async (client) => {

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

                return servicio;
            });
        } catch (error) {
            console.error('Error en updateServicioSucursal:', error);
            throw error;
        }
    }

    /**
     * Crear promoción
     */
    async createPromocion(idTenant, promoData, ctxOrDb) {
        const db = resolveDb(ctxOrDb);

        try {
            return await db.txWithRLS(async (client) => {

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

                return promo;
            });
        } catch (error) {
            console.error('Error en createPromocion:', error);
            throw error;
        }
    }

    /**
     * Obtener catálogo de servicios disponibles
     */
    async getCatalogoServicios(ctxOrDb) {
        try {
            const db = resolveDb(ctxOrDb);
            const servicios = await marketplaceRepo.getAllServicios(db);

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
    async getReviews(idSucursal, limit = 10, offset = 0, ctxOrDb) {
        try {
            const db = resolveDb(ctxOrDb);
            const resenas = await marketplaceRepo.getReviewsBySucursal(idSucursal, limit, offset, db);
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
