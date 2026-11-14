import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Problem } from '@tadhkirah/contracts';
import type { Request, Response } from 'express';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'validation.failed',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  409: 'conflict',
  429: 'rate_limited',
  503: 'unavailable',
};

/** Turns every error into RFC 9457 `application/problem+json` and never leaks internals. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const body = exception instanceof HttpException ? exception.getResponse() : undefined;

    if (status >= 500 && !(exception instanceof HttpException)) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }

    // Health endpoints return their structured body as-is.
    if (body && typeof body === 'object' && 'checks' in body) {
      res.status(status).json(body);
      return;
    }

    const custom = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const problem: Problem = {
      type: 'about:blank',
      title: HttpStatus[status]?.replaceAll('_', ' ').toLowerCase() ?? 'error',
      status,
      code: typeof custom.code === 'string' ? custom.code : (CODE_BY_STATUS[status] ?? 'internal'),
      detail: status < 500 && typeof custom.message === 'string' ? custom.message : undefined,
      instance: req.originalUrl,
      ...(custom.errors && typeof custom.errors === 'object'
        ? { errors: custom.errors as Problem['errors'] }
        : {}),
    };
    if (typeof custom.retryAfter === 'number')
      res.setHeader('Retry-After', String(custom.retryAfter));
    res.status(status).type('application/problem+json').json(problem);
  }
}
