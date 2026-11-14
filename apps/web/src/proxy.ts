import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip the API (/v1), Next internals, health checks and static files.
  matcher: '/((?!v1|healthz|_next|.*\\..*).*)',
};
