import { defineConfig } from 'vitest/config';

/** Needs Docker: one real PostgreSQL 18 (Testcontainers) shared by every file. */
export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.int-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
