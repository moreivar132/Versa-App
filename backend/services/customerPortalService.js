/**
 * VERSA - PASO 5: Portal Cliente
 * Servicio del portal para citas, pagos, etc.
 */

const customerRepo = require('../repositories/customerRepository');
const marketplaceService = require('./marketplaceService');

class CustomerPortalService {

    /**
     * Obtener citas del cliente
     */
    async getCitas(idCliente, scope = 'all') {
        const citas = await customerRepo.getClienteCitas(idCliente, scope);

        return citas.map(cita => ({
            id: cita.id,
            fecha_hora: cita.fecha_hora,
            duracion_estimada: cita.duracion_estimada,
            estado: cita.estado,
            notas: cita.notas,
            created_at: cita.created_at,
            sucursal: {
                id: cita.id_sucursal,
                nombre: cita.sucursal_nombre,
                direccion: cita.sucursal_direccion,
                telefono: cita.sucursal_telefono
            },
            vehiculo: cita.id_vehiculo ? {
                id: cita.id_vehiculo,
                matricula: cita.matricula,
                marca: cita.marca,
                modelo: cita.modelo
            } : null,
            servicio: cita.servicio_nombre ? {
                nombre: cita.servicio_nombre,
                precio: cita.servicio_precio,
                duracion: cita.servicio_duracion
            } : null,
            // Indica si se puede cancelar (cita futura)
            puede_cancelar: new Date(cita.fecha_hora) > new Date(),
            puede_reprogramar: new Date(cita.fecha_hora) > new Date()
        }));
    }

    /**
     * Cancelar una cita
     */
    async cancelarCita(idCliente, idCita) {
        // Obtener cita
        const cita = await customerRepo.getClienteCitaById(idCliente, idCita);

        if (!cita) {
            throw { status: 403, message: 'No tienes permiso para cancelar esta cita' };
        }

        // Verificar si la cita ya está cancelada
        if (cita.estado === 'cancelada') {
            throw { status: 400, message: 'La cita ya está cancelada' };
        }

        // Verificar límite de cancelación
        const horasLimite = cita.cancelacion_horas_limite || 24;
        const fechaCita = new Date(cita.fecha_hora);
        const ahora = new Date();
        const horasRestantes = (fechaCita - ahora) / (1000 * 60 * 60);

        if (horasRestantes < horasLimite) {
            throw {
                status: 422,
                message: `No puedes cancelar con menos de ${horasLimite} horas de anticipación`
            };
        }

        // Cancelar
        const citaCancelada = await customerRepo.cancelarCita(idCita, idCliente);

        return {
            id: citaCancelada.id,
            estado: citaCancelada.estado,
            mensaje: 'Cita cancelada exitosamente'
        };
    }

    /**
     * Reprogramar una cita
     */
    async reprogramarCita(idCliente, idCita, nuevaFecha, nuevaHora) {
        // Obtener cita actual
        const cita = await customerRepo.getClienteCitaById(idCliente, idCita);

        if (!cita) {
            throw { status: 403, message: 'No tienes permiso para reprogramar esta cita' };
        }

        // Verificar si la cita puede ser reprogramada
        if (cita.estado === 'cancelada') {
            throw { status: 400, message: 'No se puede reprogramar una cita cancelada' };
        }

        if (cita.estado === 'completada') {
            throw { status: 400, message: 'No se puede reprogramar una cita completada' };
        }

        // Verificar límite de cancelación/reprogramación
        const horasLimite = cita.cancelacion_horas_limite || 24;
        const fechaCita = new Date(cita.fecha_hora);
        const ahora = new Date();
        const horasRestantes = (fechaCita - ahora) / (1000 * 60 * 60);

        if (horasRestantes < horasLimite) {
            throw {
                status: 422,
                message: `No puedes reprogramar con menos de ${horasLimite} horas de anticipación`
            };
        }

        // Verificar disponibilidad del nuevo slot
        try {
            const slots = await marketplaceService.getAvailability(cita.id_sucursal, nuevaFecha);
            const slotDisponible = slots.find(s => s.hora === nuevaHora && s.disponible);

            if (!slotDisponible) {
                throw { status: 409, message: 'El horario seleccionado no está disponible' };
            }
        } catch (error) {
            if (error.status) throw error;
            // Si el marketplace no está configurado, verificar directamente
            const nuevaFechaHora = new Date(`${nuevaFecha}T${nuevaHora}:00`);
            const disponible = await customerRepo.checkSlotDisponible(cita.id_sucursal, nuevaFechaHora);

            if (!disponible) {
                throw { status: 409, message: 'El horario seleccionado no está disponible' };
            }
        }

        // Construir nueva fecha/hora
        const nuevaFechaHora = new Date(`${nuevaFecha}T${nuevaHora}:00`);

        // Verificar que la nueva fecha sea futura
        if (nuevaFechaHora <= ahora) {
            throw { status: 400, message: 'La nueva fecha debe ser en el futuro' };
        }

        // Reprogramar
        const citaReprogramada = await customerRepo.reprogramarCita(idCita, idCliente, nuevaFechaHora);

        return {
            id: citaReprogramada.id,
            fecha_hora: citaReprogramada.fecha_hora,
            estado: citaReprogramada.estado,
            mensaje: 'Cita reprogramada exitosamente'
        };
    }

    /**
     * Obtener pagos del cliente
     */
    async getPagos(idCliente) {
        try {
            const pagos = await customerRepo.getClientePagos(idCliente);

            return pagos.map(pago => ({
                tipo: pago.tipo,
                referencia_id: pago.referencia_id,
                fecha: pago.fecha,
                concepto: pago.concepto,
                importe: parseFloat(pago.importe) || 0,
                status: pago.status,
                metodo_pago: pago.metodo_pago
            }));
        } catch (error) {
            // Si la tabla de pagos no existe aún, devolver vacío
            console.error('Error obteniendo pagos:', error.message);
            return [];
        }
    }

    /**
     * Obtener disponibilidad para reprogramar
     */
    async getDisponibilidadReprogramar(idCliente, idCita, fecha) {
        // Verificar que la cita pertenece al cliente
        const cita = await customerRepo.getClienteCitaById(idCliente, idCita);

        if (!cita) {
            throw { status: 403, message: 'No tienes permiso para ver esta cita' };
        }

        // Obtener disponibilidad del marketplace
        try {
            const slots = await marketplaceService.getAvailability(cita.id_sucursal, fecha);
            return slots;
        } catch (error) {
            console.error('Error obteniendo disponibilidad:', error);
            return [];
        }
    }

    // =============================================
    // RESEÑAS
    // =============================================

    /**
     * Crear reseña para una cita
     */
    async crearResena(idCliente, idCita, puntuacion, comentario, fotos = []) {
        // Verificar que la cita pertenece al cliente
        const cita = await customerRepo.getClienteCitaById(idCliente, idCita);

        if (!cita) {
            throw { status: 403, message: 'No tienes permiso para esta cita' };
        }

        // Verificar que la cita esté completada
        if (!['completada', 'completado'].includes(cita.estado)) {
            throw { status: 400, message: 'Solo puedes dejar reseña en citas completadas' };
        }

        // Verificar que no exista ya una reseña
        const existente = await customerRepo.getResenaPorCita(idCliente, idCita);
        if (existente) {
            throw { status: 409, message: 'Ya existe una reseña para esta cita' };
        }

        const resena = await customerRepo.createResena(idCita, puntuacion, comentario, fotos);

        return {
            id: resena.id,
            rating: resena.rating,
            comentario: resena.comentario,
            fotos: resena.fotos_json || [],
            created_at: resena.created_at
        };
    }

    /**
     * Obtener reseña de una cita
     */
    async getResenaPorCita(idCliente, idCita) {
        const resena = await customerRepo.getResenaPorCita(idCliente, idCita);

        if (!resena) {
            return null;
        }

        return {
            id: resena.id,
            rating: resena.rating,
            comentario: resena.comentario,
            fotos: resena.fotos_json || [],
            sucursal_nombre: resena.sucursal_nombre,
            cita_fecha: resena.cita_fecha,
            created_at: resena.created_at,
            updated_at: resena.updated_at
        };
    }

    /**
     * Actualizar reseña de una cita
     */
    async actualizarResena(idCliente, idCita, data) {
        // Verificar que existe la reseña
        const existente = await customerRepo.getResenaPorCita(idCliente, idCita);
        if (!existente) {
            throw { status: 404, message: 'No tienes una reseña para esta cita' };
        }

        const resena = await customerRepo.updateResena(idCliente, idCita, data);

        return {
            id: resena.id,
            rating: resena.rating,
            comentario: resena.comentario,
            fotos: resena.fotos_json || [],
            updated_at: resena.updated_at
        };
    }

    /**
     * Eliminar reseña de una cita
     */
    async eliminarResena(idCliente, idCita) {
        await customerRepo.deleteResena(idCliente, idCita);
        return true;
    }

    /**
     * Obtener todas las reseñas del cliente
     */
    async getResenasCliente(idCliente) {
        const resenas = await customerRepo.getAllResenasCliente(idCliente);

        return resenas.map(r => ({
            id: r.id,
            id_cita: r.id_cita,
            rating: r.rating,
            comentario: r.comentario,
            fotos: r.fotos_json || [],
            sucursal_nombre: r.sucursal_nombre,
            sucursal_direccion: r.sucursal_direccion,
            cita_fecha: r.cita_fecha,
            created_at: r.created_at,
            updated_at: r.updated_at
        }));
    }
}

module.exports = new CustomerPortalService();
