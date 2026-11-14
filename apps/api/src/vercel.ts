import 'reflect-metadata';
import type { Express } from 'express';
import { createApiApp } from './bootstrap.js';
import { loadEnv } from './config/env.js';

/**
 * Vercel entry: the same Nest app as `main.ts` (identical modules, guards and
 * filters), but initialised without listening, and handed to Vercel as a plain
 * Express request handler. Fluid Compute reuses the instance across requests.
 */
export async function createVercelHandler(): Promise<Express> {
  const app = await createApiApp(loadEnv());
  await app.init();
  return app.getHttpAdapter().getInstance() as Express;
}
