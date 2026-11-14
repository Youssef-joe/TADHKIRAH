import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { createApiApp } from './bootstrap.js';
import { loadEnv } from './config/env.js';
import { WorkerModule } from './worker/worker.module.js';

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
