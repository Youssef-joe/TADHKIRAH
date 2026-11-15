import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from '@tadhkirah/i18n';

/**
 * Arabic is the default for everyone: an unprefixed URL (/, /app/today, the
 * installed app's start_url) always goes to /ar, whatever the browser's language.
 * English stays one tap away via the language setting or an /en link.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: false,
});
