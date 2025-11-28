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
            }
        }
    },
    server: {
        port: 3000
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './frontend')
        }
    }
});
