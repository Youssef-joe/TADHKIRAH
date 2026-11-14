import { z } from 'zod';

/**
 * Browsers run under a strict Content-Security-Policy without 'unsafe-eval'
 * (apps/web/src/proxy.ts). zod v4 would otherwise probe `new Function` while
 * building object schemas, which the CSP reports as a violation. zod reads this
 * setting when a schema is constructed, so index.ts imports this module first.
 * The API (Node) keeps zod's faster compiled parsers.
 */
if ('document' in globalThis) z.config({ jitless: true });
