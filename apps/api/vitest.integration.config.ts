import { defineConfig } from 'vitest/config';

/** Needs Docker: starts a real PostgreSQL with Testcontainers. */
export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.int-spec.ts'],
    testTimeout: 120_000,
    hookTimeout: 180_000,
    fileParallelism: false,
  },
});
