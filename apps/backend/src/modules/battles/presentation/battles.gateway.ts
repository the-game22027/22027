import {
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import { Inject } from '@nestjs/common';
import type { Namespace, Socket } from 'socket.io';
import { type AuthContext, SocketAuthenticator } from '@modules/auth';
import { CLOCK, type Clock } from '@shared/kernel';
import { BattleEngine } from '../application/battle-engine';
import type { Ack } from '../application/live-battle';
import { MatchmakingService } from '../application/matchmaking.service';
import {
  answerCommand,
  buzzCommand,
  joinMatchmakingCommand,
  leaveMatchmakingCommand,
  readyCommand,
  timeSyncCommand,
} from './battle-commands';
import { SocketBattleNotifier, userChannel } from './socket-battle-notifier';
import type { z } from 'zod';

const userIdOf = (socket: Socket): string => (socket.data as { auth: AuthContext }).auth.userId;

/** Reads `clientMsgId` even from a malformed payload, so the ack can still name the command. */
const clientMsgIdOf = (body: unknown): string =>
  typeof (body as { clientMsgId?: unknown } | null)?.clientMsgId === 'string'
    ? (body as { clientMsgId: string }).clientMsgId
    : '';

/** The `/battles` namespace (WEBSOCKET.md). Thin: checks payloads, then hands commands to the application. */
@WebSocketGateway({ namespace: '/battles' })
export class BattlesGateway implements OnGatewayInit<Namespace>, OnGatewayConnection<Socket> {
  constructor(
    private readonly authenticator: SocketAuthenticator,
    private readonly notifier: SocketBattleNotifier,
    private readonly engine: BattleEngine,
    private readonly matchmaking: MatchmakingService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  afterInit(namespace: Namespace): void {
    namespace.use(this.authenticator.middleware());
    this.notifier.attach(namespace);
  }

  async handleConnection(socket: Socket): Promise<void> {
    await socket.join(userChannel(userIdOf(socket)));
  }

  @SubscribeMessage('time:sync')
  timeSync(@MessageBody() body: unknown): { t0: number | null; serverTime: string } {
    const parsed = timeSyncCommand.safeParse(body);
    return { t0: parsed.success ? parsed.data.t0 : null, serverTime: this.clock.now().toISOString() };
  }

  @SubscribeMessage('matchmaking:join')
  async joinMatchmaking(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(joinMatchmakingCommand, body, async (command) => {
      const code = await this.matchmaking.join(userIdOf(socket), command.gameType);
      return code
        ? { clientMsgId: command.clientMsgId, accepted: false, code }
        : { clientMsgId: command.clientMsgId, accepted: true };
    });
  }

  @SubscribeMessage('matchmaking:leave')
  async leaveMatchmaking(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(leaveMatchmakingCommand, body, async (command) => {
      await this.matchmaking.leave(userIdOf(socket));
      return { clientMsgId: command.clientMsgId, accepted: true };
    });
  }

  @SubscribeMessage('battle:ready')
  ready(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(readyCommand, body, (command) =>
      this.engine.ready(command.battleId, userIdOf(socket), socket.id, command.clientMsgId),
    );
  }

  @SubscribeMessage('round:buzz')
  buzz(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(buzzCommand, body, (command) =>
      this.engine.buzz(command.battleId, userIdOf(socket), socket.id, command.roundNo, command.clientMsgId),
    );
  }

  @SubscribeMessage('round:answer')
  answer(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(answerCommand, body, (command) =>
      this.engine.answer(
        command.battleId,
        userIdOf(socket),
        socket.id,
        command.roundNo,
        command.answer,
        command.clientMsgId,
      ),
    );
  }

  private async withPayload<Schema extends z.ZodType>(
    schema: Schema,
    body: unknown,
    handle: (command: z.infer<Schema>) => Promise<Ack>,
  ): Promise<Ack> {
    const parsed = schema.safeParse(body);
    if (!parsed.success) return { clientMsgId: clientMsgIdOf(body), accepted: false, code: 'INVALID_PAYLOAD' };
    return handle(parsed.data);
  }
}
