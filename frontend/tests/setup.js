// tests/setup.js
import { vi } from 'vitest';

// Mock import.meta.env para tests
vi.stubGlobal('import', { meta: { env: { VITE_API_URL: 'https://test-api.com' } } });
