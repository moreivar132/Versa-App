import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        globals: true,
    },
    define: {
        'import.meta.env.VITE_API_URL': JSON.stringify('https://test-api.com'),
    },
});
