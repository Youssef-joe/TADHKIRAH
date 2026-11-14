import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema/index.ts',
  out: './drizzle',
  casing: 'snake_case',
  schemaFilter: ['auth', 'app', 'content'],
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://tadhkirah:tadhkirah@localhost:5432/tadhkirah',
  },
});
