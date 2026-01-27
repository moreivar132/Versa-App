import { describe, it, expect, vi } from 'vitest';
import { buildApiUrl } from '../auth.js';

// Mock import.meta.env
vi.stubGlobal('import', { meta: { env: { VITE_API_URL: 'https://test-api.com' } } });

describe('buildApiUrl', () => {
    it('builds absolute api url correctly', () => {
        const url = buildApiUrl('/api/test');
        expect(url).toBe('https://test-api.com/api/test');
        expect(url.startsWith('http')).toBe(true);
    });

    it('builds url without slash prefix', () => {
        const url = buildApiUrl('api/test');
        expect(url).toBe('https://test-api.com/api/test');
    });

    it('does not generate double slashes', () => {
        const url = buildApiUrl('//api/test');
        expect(url).not.toContain('https://test-api.com//api');
        expect(url).toBe('https://test-api.com/api/test');
    });
});
