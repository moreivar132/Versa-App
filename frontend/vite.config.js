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
                managerTaller: 'manager-taller.html',
                managerTallerClientes: 'manager-taller-clientes.html',
                managerTallerInventario: 'manager-taller-inventario.html',
                managerTallerOrdenes: 'manager-taller-ordenes.html',
                managerTallerProveedores: 'manager-taller-proveedores.html',
                managerTallerTrabajadores: 'manager-taller-trabajadores.html',
                managerTallerVehiculos: 'manager-taller-vehiculos.html',
                managerTallerCitas: 'manager-taller-citas.html',
                managerTallerCompras: 'manager-taller-compras.html',
                managerTallerComprasHistorial: 'manager-taller-compras-historial.html',
                managerTallerChat: 'manager-taller-chat.html',
                citaPrevia: 'cita-previa.html',
            }
        }
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
                secure: false,
            }
        }
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './frontend')
        }
    }
});
