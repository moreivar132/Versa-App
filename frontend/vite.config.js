import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: 'index.html',
                login: 'login.html',
                adminAccesos: 'admin-accesos.html',
                managerTallerInicio: 'manager-taller-inicio.html',
                managerTallerClientes: 'manager-taller-clientes.html',
                managerTallerInventario: 'manager-taller-inventario.html',
                managerTallerInventarioNuevo: 'manager-taller-inventario-nuevo.html',
                managerTallerOrdenes: 'manager-taller-ordenes.html',
                managerTallerOrdenesLista: 'manager-taller-ordenes-lista.html',
                managerTallerProveedores: 'manager-taller-proveedores.html',
                managerTallerTrabajadores: 'manager-taller-trabajadores.html',
                managerTallerVehiculos: 'manager-taller-vehiculos.html',
                managerTallerCitas: 'manager-taller-citas.html',
                managerTallerCompras: 'manager-taller-compras.html',
                managerTallerComprasHistorial: 'manager-taller-compras-historial.html',
                managerTallerChat: 'manager-taller-chat.html',
                managerTallerWhatsapp: 'manager-taller-whatsapp.html',
                citaPrevia: 'cita-previa.html',
                managerTallerCaja: 'manager-taller-caja.html',
                managerTallerFacturas: 'manager-taller-facturas.html',
                managerTallerFacturasPendientes: 'manager-taller-facturas-pendientes.html',
                managerTallerConfigFacturas: 'manager-taller-config-facturas.html',
                managerTallerConfigOrdenes: 'manager-taller-config-ordenes.html',
                managerTallerConfiguracion: 'manager-taller-configuracion.html',
                managerTallerCuentasCorrientes: 'manager-taller-cuentas-corrientes.html',
                managerTallerVentas: 'manager-taller-ventas.html',
                managerTallerVentasHistorial: 'manager-taller-ventas-historial.html',
                managerTallerHistorialUnificado: 'manager-taller-historial-unificado.html',
                marketplaceBusqueda: 'marketplace-busqueda.html',
                marketplaceTaller: 'marketplace-taller.html',
                managerTallerMarketplace: 'manager-taller-marketplace.html',

                // FinSaaS Vertical (New Shell)
                finsaasDashboard: 'src/verticals/finsaas/pages/dashboard.html',
                finsaasFacturas: 'src/verticals/finsaas/pages/facturas.html',
                finsaasCaja: 'src/verticals/finsaas/pages/caja.html',
                finsaasContactos: 'src/verticals/finsaas/pages/contactos.html',
                finsaasEmpresas: 'src/verticals/finsaas/pages/empresas.html',
                finsaasTrimestres: 'src/verticals/finsaas/pages/trimestres.html',
                finsaasGastosNuevo: 'src/verticals/finsaas/pages/gastos-nuevo.html',

                // Fidelización
                managerTallerFidelizacion: 'manager-taller-fidelizacion.html',
                card: 'card.html',
                // Marketing
                managerMarketingEmail: 'manager-marketing-email.html',
                // RBAC Access Management
                managerAdminAccesos: 'manager-admin-accesos.html',
                // Portal Cliente (PASO 5)
                clienteLogin: 'cliente-login.html',
                clienteRegister: 'cliente-register.html',
                clienteDashboard: 'cliente-dashboard.html',
                clienteReset: 'cliente-reset.html',
                // Stripe Checkout (FASE 6)
                success: 'success.html',
                cancel: 'cancel.html',
                stripeSuccess: 'stripe-success.html',
                stripeCancel: 'stripe-cancel.html',
                // Billing
                managerTallerBilling: 'manager-taller-billing.html',
            }
        }
    },
    publicDir: 'public',
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
            },
            '/uploads': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
            }
        }
    }
});
