import { RequestMethod, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { API_VERSION } from '@tadhkirah/contracts';
import { AppModule } from './app.module.js';
import { ProblemFilter } from './common/problem.filter.js';
import type { Env } from './config/env.js';

/** Builds the HTTP app. `main.ts` and the integration tests share this. */
export async function createApiApp(env: Env): Promise<INestApplication> {
  const app = await NestFactory.create(AppModule.forRoot(env), { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix(API_VERSION, {
    exclude: [
      { path: 'healthz', method: RequestMethod.GET },
      { path: 'readyz', method: RequestMethod.GET },
    ],
  });
  app.useGlobalFilters(new ProblemFilter());
  app.enableCors({ origin: env.WEB_ORIGINS, credentials: true });
  app.getHttpAdapter().getInstance().disable('x-powered-by');
  app.enableShutdownHooks();
  return app;
}
