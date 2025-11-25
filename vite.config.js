import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
    root: 'frontend',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: path.resolve(__dirname, 'frontend/index.html'),
                login: path.resolve(__dirname, 'frontend/login.html'),
                managerTaller: path.resolve(__dirname, 'frontend/manager-taller.html'),
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
