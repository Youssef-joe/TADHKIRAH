import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { createApiApp } from './bootstrap.js';
import { loadEnv } from './config/env.js';
import { WorkerModule } from './worker/worker.module.js';

// Local development: load the repo-root .env. It never overrides real environment
// variables, and production gets its settings from Coolify, not a file.
const dotenv = new URL('../../../.env', import.meta.url);
if (process.env.NODE_ENV !== 'production' && existsSync(dotenv)) process.loadEnvFile(dotenv);

const env = loadEnv();

if (env.MODE === 'worker') {
  const app = await NestFactory.createApplicationContext(WorkerModule.forRoot(env), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
} else {
  const app = await createApiApp(env);
  await app.listen(env.PORT, '0.0.0.0');
}
