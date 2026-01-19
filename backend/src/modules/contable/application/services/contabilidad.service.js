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
     * Calcula IVA y retención con redondeo correcto a 2 decimales
     * Formula: Total = Base + IVA - Retención
     */
    calcularIVA(base, porcentajeIva, porcentajeRetencion = 0) {
        const baseNum = parseFloat(base) || 0;
        const ivaNum = parseFloat(porcentajeIva) || 0;
        const retencionNum = parseFloat(porcentajeRetencion) || 0;

        const iva = Math.round(baseNum * (ivaNum / 100) * 100) / 100;
        const retencion = Math.round(baseNum * (retencionNum / 100) * 100) / 100;
        const total = Math.round((baseNum + iva - retencion) * 100) / 100;

        return {
            base_imponible: baseNum,
            iva_porcentaje: ivaNum,
            iva_importe: iva,
            retencion_porcentaje: retencionNum,
            retencion_importe: retencion,
            total: total
        };
    }

    /**
     * Valida que los totales sean coherentes (incluyendo retención)
     * Formula: Total = Base + IVA - Retención
     */
    validarTotales(base, iva_importe, total, retencion_importe = 0) {
        const baseNum = parseFloat(base) || 0;
        const ivaNum = parseFloat(iva_importe) || 0;
        const retencionNum = parseFloat(retencion_importe) || 0;
        const esperado = Math.round((baseNum + ivaNum - retencionNum) * 100) / 100;
        const actual = parseFloat(total);

        // Permitir diferencia de 0.10 por redondeos
        return Math.abs(esperado - actual) <= 0.10;
    }

    // ===================================================================
    // FACTURAS
    // ===================================================================

    /**
     * Lista facturas con filtros
     */
    async listFacturas(ctx, filters) {
        return repo.listFacturas(ctx, filters);
    }

    /**
     * Obtiene factura por ID
     */
    async getFactura(ctx, id) {
        const factura = await repo.getFacturaById(ctx, id);
        if (!factura) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        // Obtener archivos y pagos
        factura.archivos = await repo.listArchivosByFactura(ctx, id);
        factura.pagos = await repo.listPagosByFactura(ctx, id);

        return factura;
    }

    /**
     * Crea factura manual
     */
    async createFactura(ctx, data) {
        // Auto-calcular IVA y retención si no viene completo
        if (data.base_imponible && data.iva_porcentaje && !data.iva_importe) {
            const calc = this.calcularIVA(data.base_imponible, data.iva_porcentaje, data.retencion_porcentaje);
            data.iva_importe = calc.iva_importe;
            data.retencion_importe = calc.retencion_importe;
            data.total = calc.total;
        }

        // Auto-calcular retención si viene el porcentaje pero no el importe
        if (data.base_imponible && data.retencion_porcentaje && !data.retencion_importe) {
            data.retencion_importe = Math.round(data.base_imponible * (data.retencion_porcentaje / 100) * 100) / 100;
        }

        // Validar totales (incluyendo retención)
        const retencion = parseFloat(data.retencion_importe) || 0;
        if (!this.validarTotales(data.base_imponible, data.iva_importe, data.total, retencion)) {
            const error = new Error('Los totales de la factura no son coherentes (Total = Base + IVA - Retención)');
            error.status = 400;
            throw error;
        }

        // Establecer fecha_devengo igual a fecha_emision si no se proporciona
        if (!data.fecha_devengo) {
            data.fecha_devengo = data.fecha_emision;
        }

        return repo.createFactura(ctx, data);
    }

    /**
     * Actualiza factura
     */
    async updateFactura(ctx, id, data) {
        // Verificar que existe
        const existing = await repo.getFacturaById(ctx, id);
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

        return repo.updateFactura(ctx, id, data);
    }

    /**
     * Elimina factura (soft delete)
     */
    async deleteFactura(ctx, id) {
        const existing = await repo.getFacturaById(ctx, id);
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

        return repo.deleteFactura(ctx, id);
    }

    // ===================================================================
    // ARCHIVOS
    // ===================================================================

    async addArchivo(ctx, facturaId, fileData) {
        // Verificar factura existe
        const factura = await repo.getFacturaById(ctx, facturaId);
        if (!factura) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        return repo.createArchivo(ctx, facturaId, fileData);
    }

    async listArchivos(ctx, facturaId) {
        // Verificar factura existe
        const factura = await repo.getFacturaById(ctx, facturaId);
        if (!factura) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        return repo.listArchivosByFactura(ctx, facturaId);
    }

    // ===================================================================
    // PAGOS
    // ===================================================================

    async registrarPago(ctx, facturaId, data) {
        const factura = await repo.getFacturaById(ctx, facturaId);
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

        return repo.createPago(ctx, facturaId, data);
    }

    async listPagos(ctx, facturaId) {
        const factura = await repo.getFacturaById(ctx, facturaId);
        if (!factura) {
            const error = new Error('Factura no encontrada');
            error.status = 404;
            throw error;
        }

        return repo.listPagosByFactura(ctx, facturaId);
    }

    async eliminarPago(ctx, pagoId) {
        const result = await repo.deletePago(ctx, pagoId);
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

    async listContactos(ctx, filters) {
        return repo.listContactos(ctx, filters);
    }

    async getContacto(ctx, id) {
        const contacto = await repo.getContactoById(ctx, id);
        if (!contacto) {
            const error = new Error('Contacto no encontrada');
            error.status = 404;
            throw error;
        }
        return contacto;
    }

    /**
     * Find contact by NIF/CIF
     */
    async findContactoByNif(ctx, nifCif) {
        return repo.findContactoByNif(ctx, nifCif);
    }

    async createContacto(ctx, data) {
        return repo.createContacto(ctx, data);
    }

    async updateContacto(ctx, id, data) {
        const existing = await repo.getContactoById(ctx, id);
        if (!existing) {
            const error = new Error('Contacto no encontrado');
            error.status = 404;
            throw error;
        }
        return repo.updateContacto(ctx, id, data);
    }

    async deleteContacto(ctx, id) {
        return repo.deleteContacto(ctx, id);
    }

    // ===================================================================
    // TRIMESTRES
    // ===================================================================

    async listTrimestres(ctx, filters) {
        return repo.listTrimestres(ctx, filters);
    }

    async getTrimestre(ctx, empresaId, anio, trimestre) {
        // Obtener o crear trimestre
        let tri = await repo.getTrimestreByPeriod(ctx, anio, trimestre);

        // Calcular datos en vivo
        const resumen = await repo.getResumenIVA(ctx, empresaId, anio, trimestre);

        return {
            ...tri,
            resumen_actual: resumen
        };
    }

    async cerrarTrimestre(ctx, anio, trimestre) {
        // Calcular resumen
        const resumen = await repo.getResumenIVA(ctx, null, anio, trimestre);

        const data = {
            estado: 'CERRADO',
            base_ingresos: resumen.ingresos.base,
            iva_repercutido: resumen.iva_repercutido,
            base_gastos: resumen.gastos.base,
            iva_soportado: resumen.iva_soportado,
            resultado_iva: resumen.resultado
        };

        return repo.createOrUpdateTrimestre(ctx, anio, trimestre, data);
    }

    async reabrirTrimestre(ctx, anio, trimestre, reason) {
        const existing = await repo.getTrimestreByPeriod(ctx, anio, trimestre);
        if (!existing || existing.estado === 'ABIERTO') {
            const error = new Error('El trimestre no está cerrado');
            error.status = 400;
            throw error;
        }

        return repo.reabrirTrimestre(ctx, anio, trimestre, reason);
    }

    // ===================================================================
    // CATEGORÍAS
    // ===================================================================

    async listCategorias(ctx, filters) {
        return repo.listCategorias(ctx, filters);
    }

    async createCategoria(ctx, data) {
        return repo.createCategoria(ctx, data);
    }

    async updateCategoria(ctx, id, data) {
        return repo.updateCategoria(ctx, id, data);
    }

    async deleteCategoria(ctx, id) {
        return repo.deleteCategoria(ctx, id);
    }

    // ===================================================================
    // DASHBOARD / REPORTS
    // ===================================================================

    async getDashboard(ctx, empresaId, anio, trimestre) {
        return repo.getDashboardKPIs(ctx, empresaId, anio, trimestre);
    }

    async getReporteIVA(ctx, empresaId, anio, trimestre) {
        return repo.getResumenIVA(ctx, empresaId, anio, trimestre);
    }

    async getGastosPorCategoria(ctx, empresaId, fechaDesde, fechaHasta) {
        return repo.getGastosPorCategoria(ctx, empresaId, fechaDesde, fechaHasta);
    }

    async getEvolucionFinanciera(ctx, empresaId) {
        return repo.getEvolucionFinanciera(ctx, empresaId);
    }
}

module.exports = new ContabilidadService();
