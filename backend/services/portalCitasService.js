/**
 * VERSA - Portal Cliente: Servicio de Citas
 * 
 * ARQUITECTURA: tenant → sucursal → citataller
 * 
 * Reglas:
 * - citataller NO tiene id_tenant (scope por sucursal)
 * - id_vehiculo es NOT NULL en citataller
 * - Validar propiedad del vehículo si viene id_vehiculo
 * - motivo = nombre del servicio
 */

/**
 * VERSA - Portal Cliente: Servicio de Citas
 * 
 * ARQUITECTURA: tenant → sucursal → citataller
 * 
 * Reglas:
 * - citataller NO tiene id_tenant (scope por sucursal)
 * - id_vehiculo es NOT NULL en citataller
 * - Validar propiedad del vehículo si viene id_vehiculo
 * - motivo = nombre del servicio
 */

// const pool = require('../db'); // REMOVED
const { getTenantDb } = require('../src/core/db/tenant-db');

function resolveDb(ctxOrDb, options) {
    if (!ctxOrDb) return getTenantDb(null, { allowNoTenant: true }); // Fallback for legacy calls
    if (typeof ctxOrDb.query === 'function') return ctxOrDb; // db/tx
    return getTenantDb(ctxOrDb, options); // ctx
}

class PortalCitasService {

    /**
     * Obtener datos del cliente + sus vehículos
     * GET /api/portal/me
     * 
     * Supports: getClienteConVehiculos(idCliente) OR getClienteConVehiculos(ctx, idCliente)
     */
    async getClienteConVehiculos(ctxOrId, optionalId) {
        let ctx = ctxOrId;
        let idCliente = optionalId;

        // Dual-mode handling
        if (typeof ctxOrId === 'number' || typeof ctxOrId === 'string') {
            ctx = null;
            idCliente = ctxOrId;
        }

        const db = resolveDb(ctx);

        // Datos del cliente
        const clienteResult = await db.query(
            `SELECT id, nombre, email, telefono, direccion, id_tenant
             FROM clientefinal WHERE id = $1`,
            [idCliente]
        );

        if (clienteResult.rows.length === 0) {
            throw { status: 404, message: 'Cliente no encontrado' };
        }

        const cliente = clienteResult.rows[0];

        // Vehículos del cliente
        const vehiculosResult = await db.query(
            `SELECT id, matricula, marca, modelo, year, "Color" as color, "CC" as cc, "Serial" as serial
             FROM vehiculo 
             WHERE id_cliente = $1
             ORDER BY created_at DESC`,
            [idCliente]
        );

        return {
            cliente,
            vehiculos: vehiculosResult.rows
        };
    }

    /**
     * Crear cita con validación completa
     * POST /api/portal/citas
     * 
     * Supports: crearCita(idCliente, data) OR crearCita(ctx, idCliente, data)
     * 
     * @param {number} idCliente - Del token de auth
     * @param {object} data - Datos de la cita
     */
    async crearCita(ctxOrId, idClienteOrData, dataOrUndefined) {
        let ctx = ctxOrId;
        let idCliente = idClienteOrData;
        let data = dataOrUndefined;

        // Dual-mode handling
        if (typeof ctxOrId === 'number' || typeof ctxOrId === 'string') {
            ctx = null;
            idCliente = ctxOrId;
            data = idClienteOrData;
        }

        const {
            id_sucursal,
            fecha_hora,
            id_servicio,
            id_vehiculo,       // Opcional - si viene, validar propiedad
            vehiculo_data,     // Obligatorio si no viene id_vehiculo
            notas
        } = data;

        // Validaciones básicas
        if (!id_sucursal) throw { status: 400, message: 'id_sucursal es obligatorio' };
        if (!fecha_hora) throw { status: 400, message: 'fecha_hora es obligatorio' };
        if (!id_servicio) throw { status: 400, message: 'id_servicio es obligatorio' };
        if (!id_vehiculo && !vehiculo_data) {
            throw { status: 400, message: 'Debe enviar id_vehiculo o vehiculo_data' };
        }
        if (vehiculo_data && !vehiculo_data.tipo) {
            throw { status: 400, message: 'vehiculo_data.tipo es obligatorio' };
        }

        // Validar fecha futura
        const fechaCita = new Date(fecha_hora);
        if (fechaCita <= new Date()) {
            throw { status: 400, message: 'La fecha de la cita debe ser futura' };
        }

        const db = resolveDb(ctx);

        // Transaction using db.txWithRLS
        return db.txWithRLS(async (tx) => {
            // =====================================================
            // 1. VALIDAR SUCURSAL
            // =====================================================
            const sucursalResult = await tx.query(
                `SELECT s.id, s.id_tenant, s.nombre, ml.reserva_online_activa
                 FROM sucursal s
                 LEFT JOIN marketplace_listing ml ON ml.id_sucursal = s.id
                 WHERE s.id = $1`,
                [id_sucursal]
            );

            if (sucursalResult.rows.length === 0) {
                throw { status: 404, message: 'Sucursal no encontrada' };
            }

            const sucursal = sucursalResult.rows[0];

            // Opcional: validar que acepta reservas online
            // if (!sucursal.reserva_online_activa) {
            //     throw { status: 400, message: 'Esta sucursal no acepta reservas online' };
            // }

            // =====================================================
            // 2. RESOLVER SERVICIO → MOTIVO
            // =====================================================
            const servicioResult = await tx.query(
                `SELECT id, nombre, categoria FROM marketplace_servicio WHERE id = $1`,
                [id_servicio]
            );

            if (servicioResult.rows.length === 0) {
                throw { status: 400, message: 'Servicio no encontrado' };
            }

            const servicio = servicioResult.rows[0];
            const motivo = servicio.nombre;

            // Obtener duración si está configurada
            let duracionMin = 60; // default
            const duracionResult = await tx.query(
                `SELECT duracion_min FROM marketplace_servicio_sucursal 
                 WHERE id_sucursal = $1 AND id_servicio = $2`,
                [id_sucursal, id_servicio]
            );
            if (duracionResult.rows.length > 0 && duracionResult.rows[0].duracion_min) {
                duracionMin = duracionResult.rows[0].duracion_min;
            }

            // =====================================================
            // 3. RESOLVER VEHÍCULO
            // =====================================================
            let vehiculoIdFinal = null;
            let vehiculoCreado = null;

            if (id_vehiculo) {
                // Validar que el vehículo existe y pertenece al cliente
                const vehiculoResult = await tx.query(
                    `SELECT id, id_cliente, matricula, marca, modelo 
                     FROM vehiculo WHERE id = $1`,
                    [id_vehiculo]
                );

                if (vehiculoResult.rows.length === 0) {
                    throw { status: 404, message: 'Vehículo no encontrado' };
                }

                const vehiculo = vehiculoResult.rows[0];

                // Validar propiedad
                if (vehiculo.id_cliente && vehiculo.id_cliente !== idCliente) {
                    throw { status: 403, message: 'No tienes permiso para usar este vehículo' };
                }

                vehiculoIdFinal = vehiculo.id;

            } else {
                // Crear nuevo vehículo con los datos del formulario
                const vd = vehiculo_data;

                const nuevoVehiculoResult = await tx.query(
                    `INSERT INTO vehiculo 
                     (id_cliente, id_sucursal, matricula, marca, modelo, year, "Color", "CC", "Serial")
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     RETURNING id, matricula, marca, modelo`,
                    [
                        idCliente,
                        id_sucursal,
                        vd.matricula || null,
                        vd.marca || vd.tipo,  // Si no hay marca, usar tipo como fallback
                        vd.modelo || 'Sin especificar',
                        vd.anio || null,
                        vd.color || null,
                        vd.cc || null,
                        vd.numero_chasis || null
                    ]
                );

                vehiculoIdFinal = nuevoVehiculoResult.rows[0].id;
                vehiculoCreado = nuevoVehiculoResult.rows[0];
            }

            // =====================================================
            // 4. CREAR CITA (citataller)
            // NOT NULL: id_sucursal, id_cliente, id_vehiculo
            // NO existe id_tenant en esta tabla
            // =====================================================
            const citaResult = await tx.query(
                `INSERT INTO citataller 
                 (id_sucursal, id_cliente, id_vehiculo, fecha_hora, duracion_min, estado, motivo, notas)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING id, fecha_hora, estado, motivo`,
                [
                    id_sucursal,
                    idCliente,
                    vehiculoIdFinal,
                    fechaCita,
                    duracionMin,
                    'pendiente',
                    motivo,
                    notas || null
                ]
            );

            const cita = citaResult.rows[0];

            return {
                cita: {
                    id: cita.id,
                    fecha_hora: cita.fecha_hora,
                    estado: cita.estado,
                    motivo: cita.motivo,
                    duracion_min: duracionMin
                },
                sucursal: {
                    id: sucursal.id,
                    nombre: sucursal.nombre
                },
                servicio: {
                    id: servicio.id,
                    nombre: servicio.nombre,
                    categoria: servicio.categoria
                },
                vehiculo: vehiculoCreado ? {
                    id: vehiculoCreado.id,
                    matricula: vehiculoCreado.matricula,
                    marca: vehiculoCreado.marca,
                    modelo: vehiculoCreado.modelo,
                    creado: true
                } : { id: vehiculoIdFinal, creado: false }
            };
        });
    }
}

module.exports = new PortalCitasService();
