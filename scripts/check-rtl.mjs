#!/usr/bin/env node
/**
 * Fails if the web app uses physical-direction Tailwind classes. Arabic is RTL, so
 * layouts must use logical utilities (ms-/me-/ps-/pe-/start-/end-/text-start/…)
 * that flip automatically. See docs/02-architecture.md §4.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('../apps/web/src', import.meta.url).pathname;
const FORBIDDEN =
  /(?<![\w-])(?:-?(?:ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|scroll-ml|scroll-mr|scroll-pl|scroll-pr)-[\w./[\]-]+|text-left|text-right|float-left|float-right|clear-left|clear-right)(?![\w-])/g;

const SUGGEST = { ml: 'ms', mr: 'me', pl: 'ps', pr: 'pe', left: 'start', right: 'end' };

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(tsx?|css)$/.test(name)) yield p;
  }
}

let problems = 0;
for (const file of walk(ROOT)) {
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const m of line.matchAll(FORBIDDEN)) {
        const key = m[0].replace(/^-/, '').split('-')[0];
        const hint = SUGGEST[key] ? ` (use ${SUGGEST[key]}-…)` : ' (use the logical equivalent)';
        console.error(`${file.replace(ROOT, 'apps/web/src')}:${i + 1}  "${m[0]}"${hint}`);
        problems++;
      }
    });
}

if (problems) {
  console.error(`\n${problems} physical-direction class(es) found. Arabic layouts would break.`);
  process.exit(1);
}
console.log('RTL check passed: logical utilities only.');
