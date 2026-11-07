import { Module } from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import type { Request, Response } from 'express';
import { resolveRequestId } from './request-id';

/**
 * Per-request context (AsyncLocalStorage via nestjs-cls). The CLS id is the request id, which the
 * problem+json filter returns as `traceId`. Transactions (@nestjs-cls/transactional) are added by
 * PersistenceModule as a plugin on this same CLS instance.
 */
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req: Request) => resolveRequestId(req, req.res as Response | undefined),
      },
    }),
  ],
})
export class RequestContextModule {}
