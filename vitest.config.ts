import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/__tests__/**',
        'src/entrypoints/*/index.html',
        'src/entrypoints/*/main.tsx',
      ],
      thresholds: {
        // NOTE: non-reserved keys here are picomatch GLOBS matched against
        // file paths relative to the config root (vitest's threshold-glob
        // semantics). A bare directory prefix like 'src/lib/' matches no
        // files and silently enforces nothing — the '/**' suffix is required.
        'src/lib/**': { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/entrypoints/background/**': { statements: 100, branches: 80, functions: 90, lines: 90 },
      },
    },
  },
});
