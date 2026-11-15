import { expect, test } from '@playwright/test';

/** Arabic is the default for everyone, whatever language the browser asks for. */
for (const acceptLanguage of ['en-US,en;q=0.9', 'fr-FR', 'ar-SA']) {
  test(`unprefixed URLs open in Arabic (Accept-Language: ${acceptLanguage})`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      extraHTTPHeaders: { 'Accept-Language': acceptLanguage },
    });
    const page = await context.newPage();
    for (const path of ['/', '/sign-in']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/ar${path === '/' ? '/?$' : path}$`));
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    }
    await context.close();
  });
}

test('English stays reachable by URL', async ({ page }) => {
  await page.goto('/en');
  await expect(page).toHaveURL(/\/en\/?$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});
