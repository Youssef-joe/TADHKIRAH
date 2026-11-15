import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export const CONTACT_EMAIL = 'app.tadhkirah@gmail.com';
/** Bump when the text changes materially (and tell users in the app). */
const UPDATED = new Date(Date.UTC(2026, 10, 15));
const SECTIONS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'] as const;

/** Privacy policy and terms (public, readable without signing in). */
export async function LegalPage({ doc, locale }: { doc: 'privacy' | 'terms'; locale: string }) {
  const t = await getTranslations('legal');
  const tApp = await getTranslations('app');
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' }).format(
    UPDATED,
  );
  return (
    <main className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Link href="/" className="font-display text-xl text-primary">
        {tApp('name')}
      </Link>
      <h1 className="mt-6 font-display text-3xl font-bold">{t(`${doc}.title`)}</h1>
      <p className="mt-2 text-sm text-muted">{t('updated', { date })}</p>
      <p className="mt-6 leading-relaxed">{t(`${doc}.intro`)}</p>
      {SECTIONS.map((s) => (
        <section key={s} className="mt-8">
          <h2 className="mb-2 text-lg font-semibold">{t(`${doc}.${s}_title`)}</h2>
          <p className="leading-relaxed whitespace-pre-line text-text/90">
            {t(`${doc}.${s}_body`)}
          </p>
        </section>
      ))}
      <p className="mt-10 border-t border-border pt-6 text-sm text-muted">
        {t('contact', { email: '' })}
        <a
          href={`mailto:${CONTACT_EMAIL}`}
          dir="ltr"
          className="text-primary underline-offset-4 hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
      </p>
      <nav className="mt-4 flex gap-4 text-sm">
        <Link
          href={doc === 'privacy' ? '/terms' : '/privacy'}
          className="text-primary underline-offset-4 hover:underline"
        >
          {t(doc === 'privacy' ? 'termsLink' : 'privacyLink')}
        </Link>
      </nav>
    </main>
  );
}

/** Small row of links to the legal pages, for footers and forms. */
export async function LegalLinks() {
  const t = await getTranslations('legal');
  return (
    <span className="flex justify-center gap-4">
      <Link href="/privacy" className="underline-offset-4 hover:underline">
        {t('privacyLink')}
      </Link>
      <Link href="/terms" className="underline-offset-4 hover:underline">
        {t('termsLink')}
      </Link>
    </span>
  );
}
