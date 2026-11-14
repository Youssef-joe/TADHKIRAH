import { defineRouting } from 'next-intl/routing';
import { defaultLocale, locales } from '@tadhkirah/i18n';

export const routing = defineRouting({ locales, defaultLocale, localePrefix: 'always' });
