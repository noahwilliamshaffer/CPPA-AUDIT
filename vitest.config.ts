import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit tests for the pure libs (no DB / no server runtime). `server-only` is
// aliased to a no-op so server-tagged modules import cleanly under Node.
export default defineConfig({
  resolve: {
    alias: {
      'server-only': path.resolve(process.cwd(), 'test/stubs/server-only.ts'),
      '@': path.resolve(process.cwd(), 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['test/setup.ts'],
  },
});
