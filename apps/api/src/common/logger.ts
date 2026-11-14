import type { Params } from 'nestjs-pino';
import type { Env } from '../config/env.js';

/**
 * Structured JSON logs. Private text must never be logged (Architecture §7): request
 * bodies are never logged at all, and known sensitive fields are redacted as a
 * second safeguard.
 */
export function loggerParams(env: Env): Params {
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      transport:
        env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { singleLine: true } }
          : undefined,
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
          '*.text',
          '*.note',
          '*.intention',
          '*.email',
          '*.code',
          '*.token',
        ],
        censor: '[redacted]',
      },
      serializers: {
        req: (req: { id: unknown; method: string; url: string }) => ({
          id: req.id,
          method: req.method,
          url: req.url,
        }),
      },
      autoLogging: { ignore: (req) => req.url === '/healthz' || req.url === '/readyz' },
    },
  };
}
