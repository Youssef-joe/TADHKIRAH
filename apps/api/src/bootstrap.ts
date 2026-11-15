import { RequestMethod, type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Logger } from 'nestjs-pino';
import { API_VERSION } from '@tadhkirah/contracts';
import { AppModule } from './app.module.js';
import { ProblemFilter } from './common/problem.filter.js';
import type { Env } from './config/env.js';

/** Builds the HTTP app. `main.ts` and the integration tests share this. */
export async function createApiApp(env: Env): Promise<INestApplication> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule.forRoot(env), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  // Correct client IPs behind Traefik and the Next.js proxy (used by rate limits).
  app.set('trust proxy', env.TRUST_PROXY === 'true' ? true : env.TRUST_PROXY);
  app.disable('x-powered-by');
  app.useBodyParser('json', { limit: '100kb' });
  // Sign in with Apple returns with an HTML form post.
  app.useBodyParser('urlencoded', { limit: '20kb', extended: false });
  app.setGlobalPrefix(API_VERSION, {
    exclude: [
      { path: 'healthz', method: RequestMethod.GET },
      { path: 'readyz', method: RequestMethod.GET },
    ],
  });
  app.useGlobalFilters(new ProblemFilter());
  app.enableCors({ origin: env.WEB_ORIGINS, credentials: true });
  app.enableShutdownHooks();
  return app;
}
