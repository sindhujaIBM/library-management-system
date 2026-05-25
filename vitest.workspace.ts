import { defineWorkspace } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineWorkspace([
  {
    test: {
      name: 'shared',
      environment: 'node',
      globals: true,
      include: [`${root}/packages/shared/src/__tests__/**/*.test.ts`],
      setupFiles: [`${root}/packages/shared/src/__tests__/setup.ts`],
    },
  },
  {
    test: {
      name: 'books',
      environment: 'node',
      globals: true,
      include: [`${root}/services/books/src/handlers/__tests__/**/*.test.ts`],
      setupFiles: [`${root}/services/books/src/handlers/__tests__/setup.ts`],
    },
    resolve: {
      alias: {
        '@library/shared': `${root}/packages/shared/src/index.ts`,
      },
    },
  },
  {
    test: {
      name: 'admin',
      environment: 'node',
      globals: true,
      include: [`${root}/services/admin/src/handlers/__tests__/**/*.test.ts`],
      setupFiles: [`${root}/services/admin/src/handlers/__tests__/setup.ts`],
    },
    resolve: {
      alias: {
        '@library/shared': `${root}/packages/shared/src/index.ts`,
      },
    },
  },
  {
    plugins: [
      (await import('@vitejs/plugin-react')).default(),
    ],
    test: {
      name: 'frontend',
      environment: 'jsdom',
      globals: true,
      include: [`${root}/frontend/src/__tests__/**/*.test.tsx`],
      setupFiles: [`${root}/frontend/src/__tests__/setup.ts`],
    },
  },
]);
