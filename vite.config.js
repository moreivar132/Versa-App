import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: 'frontend',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: 'index.html',
                login: 'login.html',
                managerTaller: 'manager-taller.html',
                managerTallerClientes: 'manager-taller-clientes.html',
                managerTallerInventario: 'manager-taller-inventario.html',
                managerTallerOrdenes: 'manager-taller-ordenes.html',
                managerTallerProveedores: 'manager-taller-proveedores.html',
                managerTallerTrabajadores: 'manager-taller-trabajadores.html',
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
