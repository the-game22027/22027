import { type OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import type { AuthContext } from '../application/ports/access-tokens';
import { SocketAuthenticator } from './socket-authenticator';

/** Proves the handshake check until the battles gateway exists (P6). Registered only outside production. */
@WebSocketGateway({ namespace: '/_dev/socket' })
export class DevSocketGateway implements OnGatewayInit<Namespace> {
  constructor(private readonly authenticator: SocketAuthenticator) {}

  afterInit(namespace: Namespace): void {
    namespace.use(this.authenticator.middleware());
  }

  @SubscribeMessage('whoami')
  whoami(socket: Socket): { userId: string } {
    return { userId: (socket.data as { auth: AuthContext }).auth.userId };
  }
}
