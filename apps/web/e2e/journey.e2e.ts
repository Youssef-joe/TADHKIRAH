import { expect, test } from '@playwright/test';
import { codeFor, LOCALES, messages, uniqueEmail, uniqueIp } from './helpers';

/**
 * The whole first-day journey, in each language: sign in with an emailed code,
 * onboard, log a prayer, reflect, export, then delete the account (AC-DEL).
 */
for (const locale of LOCALES) {
  const m = messages[locale];

  test(`first day, ${locale}`, async ({ page, request }) => {
    const email = uniqueEmail(`journey-${locale}`);
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': uniqueIp() });

    // Sign in.
    await page.goto(`/${locale}/sign-in`);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    await page.locator('#email').fill(email);
    await page.getByRole('button', { name: m.auth.sendCode }).click();
    await page.locator('#code').fill(await codeFor(request, email));
    await page.getByRole('button', { name: m.auth.verify, exact: true }).click();

    // Onboarding: pick Riyadh, keep the suggested method.
    await expect(page).toHaveURL(new RegExp(`/${locale}/onboarding`));
    await page.locator('#city-search').fill('Riyadh');
    await page.locator('#city-results button').first().click();
    await page.getByRole('button', { name: m.onboarding.next }).click();
    await page.getByRole('button', { name: m.onboarding.finish }).click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/app/today`));

    // Log Fajr; it survives a reload.
    const fajr = page.getByRole('group', { name: m.prayers.fajr }).getByRole('button').first();
    const saved = page.waitForResponse(
      (r) => r.url().includes('/v1/worship/logs/') && r.request().method() === 'PUT',
    );
    await fajr.click();
    await expect(fajr).toHaveAttribute('aria-pressed', 'true');
    await saved;
    await page.reload();
    await expect(
      page.getByRole('group', { name: m.prayers.fajr }).getByRole('button').first(),
    ).toHaveAttribute('aria-pressed', 'true');

    // Reflect: the intention autosaves.
    const intention = locale === 'ar' ? 'أَنْ أُصَلِّيَ الْفَجْرَ فِي الْمَسْجِد' : 'Pray Fajr at the mosque';
    await page.goto(`/${locale}/app/reflection`);
    await page.getByPlaceholder(m.reflection.intentionPlaceholder).fill(intention);
    await expect(page.getByText(m.reflection.saved)).toBeVisible();

    // Export: the readable copy contains the decrypted intention.
    await page.goto(`/${locale}/app/settings`);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('link', { name: m.settings.exportMd }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/^tadhkirah-\d{4}-\d{2}-\d{2}\.md$/);
    const chunks: Buffer[] = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).toString('utf8')).toContain(intention);

    // Delete the account.
    await page.getByRole('button', { name: m.settings.deleteStart }).click();
    const submit = page.getByRole('button', { name: m.settings.deleteButton });
    await expect(submit).toBeDisabled();
    await page.locator('#confirmEmail').fill(email);
    await submit.click();
    await expect(page).toHaveURL(new RegExp(`/${locale}/goodbye`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(m.goodbye.title);

    // The session is gone.
    await page.goto(`/${locale}/app/today`);
    await expect(page).toHaveURL(new RegExp(`/${locale}/sign-in`));
  });
}
