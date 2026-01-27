import { test, expect } from '@playwright/test';

const mustNotContain = ['netlify.app/api', '/api/']; // netlify host check se hace por hostname

function getHost(url) {
    try { return new URL(url).host; } catch { return ''; }
}

test('FinSaaS: no relative /api and no Netlify API calls', async ({ page }) => {
    const apiCalls = [];

    page.on('request', (req) => {
        const url = req.url();
        // Capture any request that looks like an API call (relative or absolute containing /api/)
        // We check for /api/ in the path mostly.
        if (url.includes('/api/')) apiCalls.push(url);
    });

    // Lista de páginas FinSaaS (ajusta si tus rutas son distintas)
    // AJUSTE: Probando con y sin /src por si acaso, pero el usuario pidió esto.
    // Intentaremos la ruta que funciona en Vite por defecto si esto falla, pero por ahora copio el bloque del usuario.
    // Pero el usuario dijo "ajusta si tus rutas son distintas".
    // Dado que vi los archivos en src/verticals/..., en Vite suele ser /src/verticals/...
    // Voy a usar un array dinámico o probar paths seguros.
    // Voy a usar /src/verticals/... porque estoy 99% seguro que es así en Vite default setup.
    // Pero el usuario puso /verticals/... puede que tenga un alias.
    // Voy a poner /src/verticals/... para asegurar que cargue.
    const pages = [
        '/src/verticals/finsaas/pages/dashboard.html',
        '/src/verticals/finsaas/pages/facturas.html',
        '/src/verticals/finsaas/pages/empresas.html',
        '/src/verticals/finsaas/pages/contactos.html'
    ];

    for (const p of pages) {
        const response = await page.goto(p);
        // Verificamos que no sea 404
        if (response.status() === 404) {
            console.log(`Warning: Page ${p} returned 404. Trying without /src prefix.`);
            await page.goto(p.replace('/src', ''));
        }
        await page.waitForTimeout(2500);
    }

    // Debe haber al menos 1 llamada API import { describe, it, expect, vi } from 'vitest';
    // (si no, la app no está pegando a backend)
    // NOTA: Si el frontend no hace llamadas al cargar, esto fallará. Asumimos que "dashboard" carga algo.
    // expect(apiCalls.length).toBeGreaterThan(0); 
    // Comento esto si estoy en duda, pero el usuario dijo "Debe haber al menos 1 llamada API". Lo dejo activo.
    expect(apiCalls.length).toBeGreaterThan(0);

    // 1) Bloquear netlify.app/api
    const netlifyCalls = apiCalls.filter(u => u.includes('netlify.app/api'));
    expect(netlifyCalls, `Se detectaron llamadas a Netlify API: ${netlifyCalls.join('\n')}`).toHaveLength(0);

    // 2) Validar que las llamadas /api son absolutas (host presente)
    const noHost = apiCalls.filter(u => getHost(u) === '');
    expect(noHost, `Se detectaron URLs sin host (relativas): ${noHost.join('\n')}`).toHaveLength(0);

    // 3) Validar que todas van al mismo host (VITE_API_URL)
    const expectedHost = process.env.E2E_API_HOST; // ejemplo: versa-app-dev.up.railway.app
    if (expectedHost) {
        const wrongHost = apiCalls.filter(u => getHost(u) !== expectedHost);
        expect(wrongHost, `Hosts incorrectos vs E2E_API_HOST=${expectedHost}:\n${wrongHost.join('\n')}`).toHaveLength(0);
    }
});
