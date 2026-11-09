import type { NestExpressApplication } from '@nestjs/platform-express';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { devSignIn } from '../support/sign-in';
import { createApiTestApp } from '../support/test-app';

describe('WebSocket handshake (e2e)', () => {
  let app: NestExpressApplication;
  let url: string;
  const sockets: Socket[] = [];

  const connect = (auth: Record<string, unknown>): Socket => {
    const socket = io(`${url}/_dev/socket`, { auth, transports: ['websocket'], reconnection: false });
    sockets.push(socket);
    return socket;
  };
  const refusal = (socket: Socket) =>
    new Promise<Error & { data?: unknown }>((resolve) => socket.once('connect_error', resolve));

  beforeAll(async () => {
    app = await createApiTestApp();
    await app.listen(0);
    url = `http://127.0.0.1:${String((app.getHttpServer().address() as AddressInfo).port)}`;
  });

  afterEach(() => sockets.splice(0).forEach((socket) => socket.close()));

  afterAll(() => app.close());

  it('accepts a valid access token and knows who connected', async () => {
    const session = await devSignIn(app);
    const socket = connect({ token: session.accessToken });
    await new Promise<void>((resolve) => socket.once('connect', resolve));

    const reply = (await socket.emitWithAck('whoami')) as { userId: string };

    expect(reply.userId).toBe(session.userId);
  });

  it.each([{}, { token: 'not-a-jwt' }, { token: 42 }])('refuses the handshake with auth %j', async (auth) => {
    const error = await refusal(connect(auth));
    expect(error.message).toBe('UNAUTHENTICATED');
    expect(error.data).toEqual({ code: 'UNAUTHENTICATED' });
  });
});
