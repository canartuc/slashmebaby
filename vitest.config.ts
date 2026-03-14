import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['src/__tests__/setup.ts'],
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
        'src/lib/': { statements: 100, branches: 95, functions: 100, lines: 100 },
        'src/entrypoints/background/': { statements: 90, branches: 80, functions: 90, lines: 90 },
      },
    },
  },
});
