import { expect, test } from '@playwright/test';
import { messages, signedInContext, today } from './helpers';

const m = messages.ar;

/** WOR-10 / REF-8: Today works offline, writes wait on the device and sync on reconnect. */
test('logs a prayer offline and syncs it when back online', async ({ context, page, baseURL }) => {
  await signedInContext(context, baseURL!);

  // Online first: the service worker installs and caches the pages we open.
  await page.goto('/ar/app/today');
  await page.evaluate(() => navigator.serviceWorker.ready);
  for (const path of ['/ar/app/today', '/ar/app/reflection', '/ar/app/today']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  const day = await today(page);

  await context.setOffline(true);
  await page.reload();
  const fajr = () => page.getByRole('group', { name: m.prayers.fajr }).getByRole('button').first();
  await fajr().click();
  await expect(fajr()).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('status').filter({ hasText: m.shell.offline })).toBeVisible();

  // A reload while offline still shows the queued write.
  await page.reload();
  await expect(fajr()).toHaveAttribute('aria-pressed', 'true');

  await context.setOffline(false);
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/v1/worship/logs?from=${day}&to=${day}`);
        return ((await res.json()) as { logs: { prayerStatus: string | null }[] }).logs.map(
          (l) => l.prayerStatus,
        );
      },
      { timeout: 45_000 },
    )
    .toEqual(['on_time']);
});
