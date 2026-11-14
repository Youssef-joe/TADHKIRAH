import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Tree = { [k: string]: string | Tree };
const load = (l: string): Tree =>
  JSON.parse(readFileSync(new URL(`../messages/${l}.json`, import.meta.url), 'utf8')) as Tree;

function keys(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keys(v, `${prefix}${k}.`),
  );
}

describe('messages', () => {
  it('Arabic and English have exactly the same keys (no missing translations)', () => {
    expect(keys(load('ar')).sort()).toEqual(keys(load('en')).sort());
  });

  it('every message is non-empty', () => {
    for (const l of ['ar', 'en']) {
      for (const k of keys(load(l))) {
        const value = k.split('.').reduce<string | Tree>((t, part) => (t as Tree)[part]!, load(l));
        expect(String(value).trim(), `${l}:${k}`).not.toBe('');
      }
    }
  });
});
