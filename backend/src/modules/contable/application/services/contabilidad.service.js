/**
 * Contabilidad Service
 * Lógica de negocio para el módulo de contabilidad
 */

const repo = require('../../infra/repos/contabilidad.repo');

class ContabilidadService {
    // ===================================================================
    // IVA CALCULATIONS
    // ===================================================================

    /**
     * Calcula IVA con redondeo correcto a 2 decimales
     */
    calcularIVA(base, porcentaje) {
        const baseNum = parseFloat(base) || 0;
        const pctNum = parseFloat(porcentaje) || 0;

        const iva = Math.round(baseNum * (pctNum / 100) * 100) / 100;
        const total = Math.round((baseNum + iva) * 100) / 100;

        return {
            base_imponible: baseNum,
            iva_porcentaje: pctNum,
            iva_importe: iva,
            total: total
        };
    }

    /**
     * Valida que los totales sean coherentes
     */
    validarTotales(base, iva_importe, total) {
        const esperado = Math.round((parseFloat(base) + parseFloat(iva_importe)) * 100) / 100;
        const actual = parseFloat(total);

        // Permitir diferencia de 0.01 por redondeos
        return Math.abs(esperado - actual) <= 0.01;
    }

    // ===================================================================
    // FACTURAS
    // ===================================================================

    /**
     * Lista facturas con filtros
     */
    async listFacturas(tenantId, filters) {
        return repo.listFacturas(tenantId, filters);
    }

    /**
     * Obtiene factura por ID
     */
    async getFactura(tenantId, id) {
        const factura = await repo.getFacturaById(tenantId, id);
        if (!factura) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        // Obtener archivos y pagos
        factura.archivos = await repo.listArchivosByFactura(id);
        factura.pagos = await repo.listPagosByFactura(id);

        return factura;
    }

    /**
     * Crea factura manual
     */
    async createFactura(tenantId, data, userId) {
        // Auto-calcular IVA si no viene completo
        if (data.base_imponible && data.iva_porcentaje && !data.iva_importe) {
            const calc = this.calcularIVA(data.base_imponible, data.iva_porcentaje);
            data.iva_importe = calc.iva_importe;
            data.total = calc.total;
        }

        // Validar totales
        if (!this.validarTotales(data.base_imponible, data.iva_importe, data.total)) {
            const error = new Error('Los totales de la factura no son coherentes');
            error.status = 400;
            throw error;
        }

        // Establecer fecha_devengo igual a fecha_emision si no se proporciona
        if (!data.fecha_devengo) {
            data.fecha_devengo = data.fecha_emision;
        }

        return repo.createFactura(tenantId, data, userId);
    }

    /**
     * Actualiza factura
     */
    async updateFactura(tenantId, id, data, userId) {
        // Verificar que existe
        const existing = await repo.getFacturaById(tenantId, id);
        if (!existing) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        // No permitir editar facturas pagadas
        if (existing.estado === 'PAGADA' && data.estado !== 'ANULADA') {
            const error = new Error('No se puede editar una factura pagada');
            error.status = 400;
            throw error;
        }

        // Re-calcular IVA si cambia base o porcentaje
        if (data.base_imponible !== undefined || data.iva_porcentaje !== undefined) {
            const base = data.base_imponible ?? existing.base_imponible;
            const pct = data.iva_porcentaje ?? existing.iva_porcentaje;
            const calc = this.calcularIVA(base, pct);
            data.iva_importe = calc.iva_importe;
            data.total = calc.total;
        }

        return repo.updateFactura(tenantId, id, data, userId);
    }

    /**
     * Elimina factura (soft delete)
     */
    async deleteFactura(tenantId, id, userId) {
        const existing = await repo.getFacturaById(tenantId, id);
        if (!existing) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        if (existing.estado === 'PAGADA') {
            const error = new Error('No se puede eliminar una factura pagada');
            error.status = 400;
            throw error;
        }

        return repo.deleteFactura(tenantId, id, userId);
    }

    // ===================================================================
    // ARCHIVOS
    // ===================================================================

    async addArchivo(tenantId, facturaId, fileData, userId) {
        // Verificar factura existe
        const factura = await repo.getFacturaById(tenantId, facturaId);
        if (!factura) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        return repo.createArchivo(facturaId, fileData, userId);
    }

    async listArchivos(tenantId, facturaId) {
        // Verificar factura existe
        const factura = await repo.getFacturaById(tenantId, facturaId);
        if (!factura) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        return repo.listArchivosByFactura(facturaId);
    }

    // ===================================================================
    // PAGOS
    // ===================================================================

    async registrarPago(tenantId, facturaId, data, userId) {
        const factura = await repo.getFacturaById(tenantId, facturaId);
        if (!factura) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        if (factura.estado === 'PAGADA') {
            const error = new Error('La factura ya está completamente pagada');
            error.status = 400;
            throw error;
        }

        if (factura.estado === 'ANULADA') {
            const error = new Error('No se puede pagar una factura anulada');
            error.status = 400;
            throw error;
        }

        // Validar que no se pague más de lo pendiente
        const pendiente = parseFloat(factura.total) - parseFloat(factura.total_pagado);
        if (parseFloat(data.importe) > pendiente + 0.01) {
            const error = new Error(`El importe excede el pendiente (${pendiente.toFixed(2)}€)`);
            error.status = 400;
            throw error;
        }

        return repo.createPago(facturaId, data, userId);
    }

    async listPagos(tenantId, facturaId) {
        const factura = await repo.getFacturaById(tenantId, facturaId);
        if (!factura) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        return repo.listPagosByFactura(facturaId);
    }

    async eliminarPago(pagoId) {
        const result = await repo.deletePago(pagoId);
        if (!result) {
            const error = new Error('Pago no encontrado');
            error.status = 404;
            throw error;
        }
        return result;
    }

    // ===================================================================
    // CONTACTOS
    // ===================================================================

    async listContactos(tenantId, filters) {
        return repo.listContactos(tenantId, filters);
    }

    async getContacto(tenantId, id) {
        const contacto = await repo.getContactoById(tenantId, id);
        if (!contacto) {
            const error = new Error('Contacto no encontrado');
            error.status = 404;
            throw error;
        }
        return contacto;
    }

    async createContacto(tenantId, data, userId) {
        return repo.createContacto(tenantId, data, userId);
    }

    async updateContacto(tenantId, id, data, userId) {
        const existing = await repo.getContactoById(tenantId, id);
        if (!existing) {
            const error = new Error('Contacto no encontrado');
            error.status = 404;
            throw error;
        }
        return repo.updateContacto(tenantId, id, data, userId);
    }

    async deleteContacto(tenantId, id, userId) {
        return repo.deleteContacto(tenantId, id, userId);
    }

    // ===================================================================
    // TRIMESTRES
    // ===================================================================

    async listTrimestres(tenantId, filters) {
        return repo.listTrimestres(tenantId, filters);
    }

    async getTrimestre(tenantId, empresaId, anio, trimestre) {
        // Obtener o crear trimestre
        let tri = await repo.getTrimestreByPeriod(tenantId, anio, trimestre);

        // Calcular datos en vivo
        const resumen = await repo.getResumenIVA(tenantId, empresaId, anio, trimestre);

        return {
            ...tri,
            resumen_actual: resumen
        };
    }

    async cerrarTrimestre(tenantId, anio, trimestre, userId) {
        // Calcular resumen
        const resumen = await repo.getResumenIVA(tenantId, anio, trimestre);

        const data = {
            estado: 'CERRADO',
            base_ingresos: resumen.ingresos.base,
            iva_repercutido: resumen.iva_repercutido,
            base_gastos: resumen.gastos.base,
            iva_soportado: resumen.iva_soportado,
            resultado_iva: resumen.resultado
        };

        return repo.createOrUpdateTrimestre(tenantId, anio, trimestre, data, userId);
    }

    async reabrirTrimestre(tenantId, anio, trimestre, reason, userId) {
        const existing = await repo.getTrimestreByPeriod(tenantId, anio, trimestre);
        if (!existing || existing.estado === 'ABIERTO') {
            const error = new Error('El trimestre no está cerrado');
            error.status = 400;
            throw error;
        }

        return repo.reabrirTrimestre(tenantId, anio, trimestre, reason, userId);
    }

    // ===================================================================
    // CATEGORÍAS
    // ===================================================================

    async listCategorias(tenantId, filters) {
        return repo.listCategorias(tenantId, filters);
    }

    async createCategoria(tenantId, data, userId) {
        return repo.createCategoria(tenantId, data, userId);
    }

    async updateCategoria(tenantId, id, data) {
        return repo.updateCategoria(tenantId, id, data);
    }

    async deleteCategoria(tenantId, id) {
        return repo.deleteCategoria(tenantId, id);
    }

    // ===================================================================
    // DASHBOARD / REPORTS
    // ===================================================================

    async getDashboard(tenantId, empresaId, anio, trimestre) {
        return repo.getDashboardKPIs(tenantId, empresaId, anio, trimestre);
    }

    async getReporteIVA(tenantId, empresaId, anio, trimestre) {
        return repo.getResumenIVA(tenantId, empresaId, anio, trimestre);
    }

    async getGastosPorCategoria(tenantId, empresaId, fechaDesde, fechaHasta) {
        return repo.getGastosPorCategoria(tenantId, empresaId, fechaDesde, fechaHasta);
    }
}

module.exports = new ContabilidadService();
