import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * One lint config for the monorepo. Besides the usual checks, it enforces the
 * architecture's dependency rules (docs/02-architecture.md §3).
 */
export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.next/**',
      '**/node_modules/**',
      '**/drizzle/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
    },
  },
  {
    // The domain package is pure: no I/O, no frameworks, no other workspace packages.
    files: ['packages/domain/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tadhkirah/*'],
              message: 'domain must not depend on other workspace packages',
            },
            {
              group: ['@nestjs/*', 'next', 'next/*', 'react', 'pg', 'drizzle-orm', 'drizzle-orm/*'],
              message: 'domain must stay framework- and I/O-free',
            },
            {
              group: ['node:fs', 'node:net', 'node:http', 'node:child_process'],
              message: 'domain must stay I/O-free',
            },
          ],
        },
      ],
    },
  },
  {
    // The web app talks to data only through the API, never the database.
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@tadhkirah/db', 'pg', 'drizzle-orm', 'drizzle-orm/*'],
              message: 'web must go through the API',
            },
          ],
        },
      ],
    },
  },
  {
    // Nest's dependency injection reads constructor parameter types at runtime,
    // so those imports can't be type-only.
    files: ['apps/api/**/*.ts'],
    rules: { '@typescript-eslint/consistent-type-imports': 'off' },
  },
);
