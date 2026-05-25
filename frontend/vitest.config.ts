import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(viteConfig, defineConfig({
  test: {
    name: 'frontend',
    environment: 'jsdom',
    globals: true,
    include: ['src/__tests__/**/*.test.tsx'],
    setupFiles: ['src/__tests__/setup.ts'],
  },
}));
