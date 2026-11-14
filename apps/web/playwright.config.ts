import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests (M8) against a running stack, normally the production images:
 *   docker compose --env-file infra/local.env -f docker-compose.yml -f infra/compose.local.yml up -d
 *   pnpm --filter @tadhkirah/web test:e2e
 * Sign-in codes are read from Mailpit (MAILPIT_URL).
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      // Locally, use the installed Chrome; CI installs Playwright's Chromium.
      use: { ...devices['Desktop Chrome'], ...(process.env.CI ? {} : { channel: 'chrome' }) },
    },
    {
      name: 'phone',
      use: { ...devices['Pixel 7'], ...(process.env.CI ? {} : { channel: 'chrome' }) },
      testMatch: '**/journey.e2e.ts',
    },
  ],
});
