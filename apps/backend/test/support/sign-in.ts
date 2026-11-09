import type { NestExpressApplication } from '@nestjs/platform-express';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

export interface SignedIn {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly userId: string;
  readonly subject: string;
}

export async function devSignIn(
  app: NestExpressApplication,
  subject = randomUUID(),
  device: { platform?: string; name?: string } = {},
): Promise<SignedIn> {
  const res = await request(app.getHttpServer()).post('/v1/_dev/auth/sign-in').send({ subject, device });
  const body = res.body as { accessToken: string; refreshToken: string; user: { id: string } };
  return { accessToken: body.accessToken, refreshToken: body.refreshToken, userId: body.user.id, subject };
}

export const bearer = (session: SignedIn): [string, string] => ['Authorization', `Bearer ${session.accessToken}`];
