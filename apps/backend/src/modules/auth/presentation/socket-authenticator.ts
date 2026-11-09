import { Inject, Injectable } from '@nestjs/common';
import type { ExtendedError, Socket } from 'socket.io';
import { ACCESS_TOKENS, type AccessTokens } from '../application/ports/access-tokens';

export type SocketMiddleware = (socket: Socket, next: (error?: ExtendedError) => void) => void;

/** Namespace middleware, because Nest guards run per message and a socket must be refused at the handshake. */
@Injectable()
export class SocketAuthenticator {
  constructor(@Inject(ACCESS_TOKENS) private readonly tokens: AccessTokens) {}

  middleware(): SocketMiddleware {
    return (socket, next) => {
      const { token } = socket.handshake.auth as { token?: unknown };
      this.tokens
        .verify(typeof token === 'string' ? token : '')
        .then((auth) => {
          (socket.data as { auth?: unknown }).auth = auth;
          next();
        })
        .catch(() => {
          next(Object.assign(new Error('UNAUTHENTICATED'), { data: { code: 'UNAUTHENTICATED' } }));
        });
    };
  }
}
