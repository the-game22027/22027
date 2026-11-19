import {
  MessageBody,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
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
  auctionBidCommand,
  auctionCallCommand,
  auctionPickCommand,
  buzzCommand,
  forfeitCommand,
  gridClaimCommand,
  gridSkipCommand,
  joinMatchmakingCommand,
  leaveMatchmakingCommand,
  minesTextCommand,
  readyCommand,
  resyncCommand,
  rockPaperScissorsPickCommand,
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
export class BattlesGateway
  implements OnGatewayInit<Namespace>, OnGatewayConnection<Socket>, OnGatewayDisconnect<Socket>
{
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
    const userId = userIdOf(socket);
    await socket.join(userChannel(userId));
    this.matchmaking.userCameBack(userId);
    await this.engine.userConnected(userId);
  }

  /** Only the user's last socket counts as leaving: another device may still be playing. */
  async handleDisconnect(socket: Socket): Promise<void> {
    const userId = userIdOf(socket);
    if (await this.notifier.isUserConnected(userId)) return;
    this.matchmaking.userWentOffline(userId);
    await this.engine.userDisconnected(userId);
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

  @SubscribeMessage('battle:rps-pick')
  pickRockPaperScissors(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(rockPaperScissorsPickCommand, body, (command) =>
      this.engine.pickRockPaperScissors(
        command.battleId,
        userIdOf(socket),
        socket.id,
        command.attempt,
        command.choice,
        command.clientMsgId,
      ),
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

  @SubscribeMessage('grid:claim')
  claimGridCell(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(gridClaimCommand, body, (command) =>
      this.engine.claimGridCell(
        command.battleId,
        userIdOf(socket),
        socket.id,
        command.roundNo,
        { cell: command.cell.row * 3 + command.cell.col, text: command.answer.text },
        command.clientMsgId,
      ),
    );
  }

  @SubscribeMessage('grid:skip')
  skipGridTurn(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(gridSkipCommand, body, (command) =>
      this.engine.skipGridTurn(command.battleId, userIdOf(socket), socket.id, command.roundNo, command.clientMsgId),
    );
  }

  @SubscribeMessage('mines:bury')
  buryMine(socket: Socket, body: unknown): Promise<Ack> {
    return this.minesCommand(socket, body, 'MINE_BURY');
  }

  @SubscribeMessage('mines:answer')
  answerMines(socket: Socket, body: unknown): Promise<Ack> {
    return this.minesCommand(socket, body, 'MINE_ANSWER');
  }

  @SubscribeMessage('mines:scan')
  scanForMine(socket: Socket, body: unknown): Promise<Ack> {
    return this.minesCommand(socket, body, 'MINE_SCAN');
  }

  private minesCommand(socket: Socket, body: unknown, type: 'MINE_BURY' | 'MINE_ANSWER' | 'MINE_SCAN'): Promise<Ack> {
    return this.withPayload(minesTextCommand, body, (command) =>
      this.engine.sendMinesCommand(
        command.battleId,
        userIdOf(socket),
        socket.id,
        command.roundNo,
        { type, answer: { text: command.answer.text } },
        command.clientMsgId,
      ),
    );
  }

  @SubscribeMessage('auction:pick')
  pickAuctionList(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(auctionPickCommand, body, (command) =>
      this.sendAuction(socket, command, { type: 'AUCTION_PICK', list: command.list }),
    );
  }

  @SubscribeMessage('auction:bid')
  bidInAuction(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(auctionBidCommand, body, (command) =>
      this.sendAuction(socket, command, { type: 'AUCTION_BID', amount: command.amount }),
    );
  }

  @SubscribeMessage('auction:call')
  callInAuction(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(auctionCallCommand, body, (command) =>
      this.sendAuction(socket, command, { type: 'AUCTION_CALL' }),
    );
  }

  @SubscribeMessage('auction:answer')
  answerInAuction(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(minesTextCommand, body, (command) =>
      this.sendAuction(socket, command, { type: 'AUCTION_ANSWER', answer: { text: command.answer.text } }),
    );
  }

  private sendAuction(
    socket: Socket,
    command: { battleId: string; roundNo: number; clientMsgId: string },
    auctionCommand: Parameters<BattleEngine['sendAuctionCommand']>[4],
  ): Promise<Ack> {
    return this.engine.sendAuctionCommand(
      command.battleId,
      userIdOf(socket),
      socket.id,
      command.roundNo,
      auctionCommand,
      command.clientMsgId,
    );
  }

  @SubscribeMessage('battle:resync')
  resync(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(resyncCommand, body, (command) =>
      this.engine.resync(command.battleId, userIdOf(socket), socket.id, command.clientMsgId),
    );
  }

  @SubscribeMessage('battle:forfeit')
  forfeit(socket: Socket, body: unknown): Promise<Ack> {
    return this.withPayload(forfeitCommand, body, (command) =>
      this.engine.forfeit(command.battleId, userIdOf(socket), command.clientMsgId),
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
