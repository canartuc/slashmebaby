// Stub WXT auto-imported globals so they don't throw in the test environment
import { vi } from 'vitest';

// defineBackground is auto-imported by WXT but not available in Node test env
vi.stubGlobal('defineBackground', (fn: () => void) => fn);
