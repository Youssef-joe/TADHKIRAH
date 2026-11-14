import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { IBM_Plex_Sans_Arabic, Inter } from 'next/font/google';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { dir } from '@tadhkirah/i18n';
import { routing } from '@/i18n/routing';
import '../globals.css';

// next/font downloads fonts at build time and serves them from our own origin,
// so the browser never contacts Google.
const arabic = IBM_Plex_Sans_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
  variable: '--font-ar',
  display: 'swap',
});
const latin = Inter({ subsets: ['latin'], variable: '--font-en', display: 'swap' });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });
  return { title: t('name'), description: t('tagline') };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf6ee' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1a17' },
  ],
};

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const uiFont = locale === 'ar' ? 'var(--font-ar)' : 'var(--font-en)';
  return (
    <html
      lang={locale}
      dir={dir(locale)}
      className={`${arabic.variable} ${latin.variable}`}
      style={{ ['--font-ui' as string]: uiFont }}
    >
      <body className="min-h-dvh bg-bg font-sans text-text antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
