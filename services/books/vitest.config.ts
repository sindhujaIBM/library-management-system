import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'books',
    environment: 'node',
    globals: true,
    include: ['src/handlers/__tests__/**/*.test.ts'],
    setupFiles: ['src/handlers/__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@library/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
    },
  },
});
