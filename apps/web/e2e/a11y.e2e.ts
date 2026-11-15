import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { LOCALES, signedInContext } from './helpers';

/** Accessibility (M8): no serious or critical axe violations, in both languages (WCAG 2.1 AA rules). */
const PUBLIC = ['', '/sign-in', '/privacy', '/terms'];
const APP = [
  '/app/today',
  '/app/worship',
  '/app/reflection',
  '/app/sunnah',
  '/app/times',
  '/app/reports',
  '/app/inbox',
  '/app/settings',
];

async function audit(page: Page) {
  // Scroll-reveal animations would otherwise be measured mid-fade; reduced motion shows final colours.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 4)
        .map((n) => `${n.target.join(' ')} [${n.any[0]?.message ?? n.failureSummary ?? ''}]`);
      return `${v.id} (${v.impact}): ${v.help} → ${nodes.join(' | ')}`;
    });
}

for (const locale of LOCALES) {
  test(`public pages are accessible, ${locale}`, async ({ page }) => {
    const found: string[] = [];
    for (const path of PUBLIC) {
      await page.goto(`/${locale}${path}`);
      await page.waitForLoadState('networkidle');
      for (const v of await audit(page)) found.push(`${locale}${path}: ${v}`);
    }
    expect(found).toEqual([]);
  });

  test(`app pages are accessible, ${locale}`, async ({ context, page, baseURL }) => {
    await signedInContext(context, baseURL!, locale);
    const found: string[] = [];
    for (const path of APP) {
      await page.goto(`/${locale}${path}`);
      await page.waitForLoadState('networkidle');
      for (const v of await audit(page)) found.push(`${locale}${path}: ${v}`);
    }
    expect(found).toEqual([]);
  });
}
