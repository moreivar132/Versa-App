import { describe, it, expect, vi } from 'vitest';

// Importa desde tu ruta real:
import { buildApiUrl, getApiBaseUrl } from '../auth.js';

// Helper: mock import.meta.env (si tu setup lo requiere, ajusta)
vi.stubGlobal('import', { meta: { env: { VITE_API_URL: 'https://example.up.railway.app/' } } });

describe('FinSaaS URL Builder', () => {
    it('getApiBaseUrl removes trailing slash', () => {
        const base = getApiBaseUrl();
        expect(base.endsWith('/')).toBe(false);
    });

    it('buildApiUrl returns absolute url', () => {
        const url = buildApiUrl('/api/test');
        expect(url.startsWith('http')).toBe(true);
        expect(url).toContain('/api/test');
    });

    it('buildApiUrl avoids double slashes', () => {
        const url = buildApiUrl('//api/test');
        expect(url).not.toContain('///');
        expect(url).not.toContain('//api'); // excepto el https://
    });
});
