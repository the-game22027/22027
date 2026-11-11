import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { ImportQuestionBundle } from '../../src/modules/question-bank/application/import-question-bundle';
import { QuestionBankFacade } from '../../src/modules/question-bank/application/question-bank.facade';
import { QuestionBankCliModule } from '../../src/modules/question-bank/question-bank-cli.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { writeBattleConfigFile } from '../support/battle-config';
import { bundle, buzzerLine, careerLine, entitySet, whoLine } from '../support/question-bundles';
import { devSignIn } from '../support/sign-in';
import { createApiTestApp, testConfig } from '../support/test-app';

interface ServerEvent {
  type: string;
  battleId?: string;
  seq?: number;
  data: Record<string, unknown>;
}

/** The dev config with fast timers and one bot profile, so a whole battle takes about a second. */
function writeBattleConfig(bot: { knows: number; guess: number }, botFallbackAfterMs = 50): string {
  return writeBattleConfigFile((json) => {
    const config = json as {
      engine: Record<string, number>;
      matchmaking: Record<string, number>;
      bots: { profiles: Record<string, Record<string, unknown>> };
      gameTypes: Record<string, Record<string, unknown>>;
    };
    config.engine = { readyTimeoutMs: 1_500, latencyGraceMs: 50, betweenRoundsMs: 50, reconnectGraceMs: 500 };
    config.matchmaking = { botFallbackAfterMs, tickMs: 20, queueDisconnectGraceMs: 100 };
    config.bots.profiles = {
      only: {
        ...config.bots.profiles['rookie'],
        knowsAnswerByDifficulty: [bot.knows, bot.knows, bot.knows, bot.knows, bot.knows],
        guessChance: bot.guess,
        buzzAtShareOfSteps: { min: 0, max: 0 },
        reactionDelayMs: { min: 10, max: 10 },
        typingDelayMs: { min: 20, max: 20 },
      },
    };
    for (const game of Object.values(config.gameTypes)) {
      Object.assign(game, {
        roundCount: 2,
        revealIntervalMs: 150,
        resumeDelayMs: 50,
        answerWindowMs: 1_000,
        finalWindowMs: 300,
        points: { correct: 10, perUnrevealedStep: 2, wrong: 0 },
      });
    }
  });
}

describe('battles over WebSocket (e2e)', () => {
  const e = entitySet();
  let spainId: string;
  let naniId: string;
  let ronaldoId: string;

  /** Two published Buzzer rounds in both languages, both answered by Spain. */
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), QuestionBankCliModule],
    }).compile();
    await moduleRef.init();
    const version = `battle-e2e-${randomUUID()}`;
    const reviewed = { en: true, ar: true };
    await moduleRef
      .get(ImportQuestionBundle)
      .importBundle(
        bundle(
          version,
          [
            buzzerLine(`test:${randomUUID()}`, e, undefined, reviewed),
            buzzerLine(`test:${randomUUID()}`, e, undefined, reviewed),
            careerLine(`test:${randomUUID()}`, e),
            careerLine(`test:${randomUUID()}`, e),
            whoLine(`test:${randomUUID()}`, e),
            whoLine(`test:${randomUUID()}`, e),
          ],
          Object.values(e),
        ),
      );
    await moduleRef.get(QuestionBankFacade).publishQuestionsOfBundle(version);
    const prisma = moduleRef.get(PrismaService);
    spainId = (await prisma.answerEntity.findUniqueOrThrow({ where: { externalRef: e.spain.externalRef } })).id;
    naniId = (await prisma.answerEntity.findUniqueOrThrow({ where: { externalRef: e.nani.externalRef } })).id;
    ronaldoId = (await prisma.answerEntity.findUniqueOrThrow({ where: { externalRef: e.ronaldo.externalRef } })).id;
    await moduleRef.close();
  });

  function startApp(bot: { knows: number; guess: number }, botFallbackAfterMs = 50) {
    let app: NestExpressApplication;
    let url = '';
    const sockets: Socket[] = [];

    beforeAll(async () => {
      app = await createApiTestApp(testConfig({ BATTLE_CONFIG_PATH: writeBattleConfig(bot, botFallbackAfterMs) }));
      await app.listen(0);
      url = `http://127.0.0.1:${String((app.getHttpServer().address() as AddressInfo).port)}`;
    });
    afterEach(() => sockets.splice(0).forEach((socket) => socket.close()));
    afterAll(() => app.close());

    /** A signed-in player with a socket that records every server event. */
    const connectPlayer = async () => {
      const session = await devSignIn(app);
      const socket = io(`${url}/battles`, {
        auth: { token: session.accessToken },
        transports: ['websocket'],
        reconnection: false,
      });
      sockets.push(socket);
      const events: ServerEvent[] = [];
      socket.onAny((_name: string, payload: ServerEvent) => events.push(payload));
      await new Promise<void>((resolve) => socket.once('connect', resolve));
      const send = (event: string, payload: Record<string, unknown>) =>
        socket.emitWithAck(event, { clientMsgId: randomUUID(), ...payload }) as Promise<{
          accepted: boolean;
          code?: string;
        }>;
      const waitFor = async (type: string, match: (event: ServerEvent) => boolean = () => true) => {
        const deadline = Date.now() + 5_000;
        for (;;) {
          const found = events.find((event) => event.type === type && match(event));
          if (found) return found;
          if (Date.now() > deadline) throw new Error(`no ${type}; got ${events.map((ev) => ev.type).join(', ')}`);
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      };
      const playState = async () =>
        (
          await request(app.getHttpServer())
            .get('/v1/me/play-state')
            .set('Authorization', `Bearer ${session.accessToken}`)
            .expect(200)
        ).body as { queue: { ticketId: string } | null; battle: { battleId: string } | null };
      /** A second socket for the same user, as after a reconnect. */
      const reconnect = async () => {
        const again = io(`${url}/battles`, {
          auth: { token: session.accessToken },
          transports: ['websocket'],
          reconnection: false,
        });
        sockets.push(again);
        again.onAny((_name: string, payload: ServerEvent) => events.push(payload));
        await new Promise<void>((resolve) => again.once('connect', resolve));
        return again;
      };
      return { session, socket, events, send, waitFor, playState, reconnect, prisma: () => app.get(PrismaService) };
    };
    return { connectPlayer };
  }

  describe('against a bot that never buzzes', () => {
    const { connectPlayer } = startApp({ knows: 0, guess: 0 });

    it('plays a whole battle: queue, bot fallback, ready, buzz, answer, result, completion', async () => {
      const player = await connectPlayer();

      expect(await player.send('matchmaking:join', { gameType: 'BUZZER' })).toEqual(
        expect.objectContaining({ accepted: true }),
      );
      await player.waitFor('matchmaking:queued');
      const found = await player.waitFor('battle:found');
      const battleId = found.battleId as string;
      const players = found.data['players'] as { kind: string; bot?: { displayName: string } }[];
      expect(players.map((p) => p.kind)).toEqual(['HUMAN', 'BOT']);
      expect(players[1]?.bot?.displayName).toBeTruthy();

      expect(await player.send('battle:ready', { battleId })).toMatchObject({ accepted: true });
      await player.waitFor('battle:started');

      for (const roundNo of [1, 2]) {
        const start = await player.waitFor('round:start', (event) => event.data['roundNo'] === roundNo);
        expect(start.data).toMatchObject({ gameType: 'BUZZER', answerKind: 'NATIONAL_TEAM', stepCount: 4 });
        const firstClue = await player.waitFor('round:clue', (event) => event.data['roundNo'] === roundNo);
        expect(firstClue.data).toMatchObject({ index: 1, clue: 'أي منتخب' });

        expect(await player.send('round:buzz', { battleId, roundNo })).toMatchObject({ accepted: true });
        await player.waitFor('round:buzzed', (event) => event.data['roundNo'] === roundNo);
        expect(await player.send('round:answer', { battleId, roundNo, answer: { entityId: spainId } })).toMatchObject({
          accepted: true,
        });
        const result = await player.waitFor('round:result', (event) => event.data['roundNo'] === roundNo);
        expect(result.data['winnerParticipantIds']).toEqual([found.data['youParticipantId']]);
        expect(result.data['reveal']).toMatchObject({ answer: { entityId: spainId, name: e.spain.names.ar } });
      }

      const completed = await player.waitFor('battle:completed');
      expect(completed.data).toMatchObject({ endReason: 'COMPLETED', you: { placement: 1, outcome: 'WIN' } });

      const seqs = player.events.filter((event) => event.battleId === battleId).map((event) => event.seq as number);
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
      expect(new Set(seqs).size).toBe(seqs.length);

      const prisma = player.prisma();
      const battle = await prisma.battle.findUniqueOrThrow({
        where: { id: battleId },
        include: { participants: true, rounds: { include: { actions: true } } },
      });
      expect(battle).toMatchObject({ status: 'COMPLETED', endReason: 'COMPLETED', hasBot: true, gameType: 'BUZZER' });
      expect(battle.rounds.map((round) => round.endReason)).toEqual(['CORRECT', 'CORRECT']);
      expect(battle.rounds[0]?.actions.map((action) => action.kind)).toEqual(['BUZZ', 'ANSWER']);
      const event = await prisma.outboxEvent.findFirstOrThrow({
        where: { aggregateId: battleId, type: 'BattleCompleted' },
      });
      expect(event.payload).toMatchObject({ battleId, hasBot: true });
    });

    it.each([
      ['CAREER', 2, [`${e.sporting.names.ar} (2002–2003)`, `${e.united.names.ar} (2003–2009)`]],
      ['WHO_IS_PLAYER', 3, ['من مواليد 1985', 'عدد أنديته: 6', 'بدأ مسيرته مع سبورتنج']],
    ] as const)(
      "plays %s: steps in the player's language, and the answer is the player",
      async (gameType, stepCount, steps) => {
        const player = await connectPlayer();
        await player.send('matchmaking:join', { gameType });
        const found = await player.waitFor('battle:found');
        const battleId = found.battleId as string;
        await player.send('battle:ready', { battleId });

        const start = await player.waitFor('round:start');
        expect(start.data).toMatchObject({ gameType, answerKind: 'PLAYER', stepCount });
        expect((await player.waitFor('round:clue')).data).toMatchObject({ index: 1, clue: steps[0] });
        await player.send('round:buzz', { battleId, roundNo: 1 });
        await player.waitFor('round:buzzed');
        expect(
          await player.send('round:answer', { battleId, roundNo: 1, answer: { entityId: ronaldoId } }),
        ).toMatchObject({
          accepted: true,
        });
        const result = await player.waitFor('round:result');
        expect(result.data['reveal']).toMatchObject({
          steps,
          answer: { entityId: ronaldoId, name: e.ronaldo.names.ar },
        });
        expect(result.data['winnerParticipantIds']).toEqual([found.data['youParticipantId']]);
      },
    );

    it('refuses a second queue for a busy player, and frees them when they leave', async () => {
      const player = await connectPlayer();

      expect(await player.send('matchmaking:join', { gameType: 'BUZZER' })).toMatchObject({ accepted: true });
      expect(await player.send('matchmaking:join', { gameType: 'BUZZER' })).toMatchObject({
        accepted: false,
        code: 'PLAYER_BUSY',
      });
      // Leaving right away beats the bot fallback in most runs; either way the player must be free afterwards.
      await player.send('matchmaking:leave', {});
      if (!player.events.some((ev) => ev.type === 'battle:found')) {
        expect(await player.send('matchmaking:join', { gameType: 'BUZZER' })).toMatchObject({ accepted: true });
        await player.send('matchmaking:leave', {});
      }
    });

    it('rejects a wrong-kind answer, a non-holder, and replays the ack of a duplicate message', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'BUZZER' });
      const battleId = (await player.waitFor('battle:found')).battleId as string;
      await player.send('battle:ready', { battleId });
      await player.waitFor('round:clue');

      expect(await player.send('round:answer', { battleId, roundNo: 1, answer: { entityId: spainId } })).toMatchObject({
        accepted: false,
        code: 'NOT_BUZZ_HOLDER',
      });
      const buzzId = randomUUID();
      const buzz = () => player.socket.emitWithAck('round:buzz', { clientMsgId: buzzId, battleId, roundNo: 1 });
      expect(await buzz()).toEqual({ clientMsgId: buzzId, accepted: true });
      expect(await buzz()).toEqual({ clientMsgId: buzzId, accepted: true });
      expect(await player.send('round:answer', { battleId, roundNo: 1, answer: { entityId: naniId } })).toMatchObject({
        accepted: false,
        code: 'UNKNOWN_ENTITY',
      });
      expect(await player.send('round:buzz', { battleId, roundNo: 2 })).toMatchObject({
        accepted: false,
        code: 'ROUND_NOT_CURRENT',
      });
      expect(await player.send('round:buzz', { battleId: 'nope', roundNo: 1 })).toMatchObject({
        accepted: false,
        code: 'INVALID_PAYLOAD',
      });
    });

    it('cancels the battle when the player never gets ready', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'BUZZER' });
      const battleId = (await player.waitFor('battle:found')).battleId as string;

      expect((await player.waitFor('battle:cancelled')).data).toEqual({ reason: 'READY_TIMEOUT' });
      await expect(player.prisma().battle.findUniqueOrThrow({ where: { id: battleId } })).resolves.toMatchObject({
        status: 'CANCELLED',
      });
      expect(await player.send('matchmaking:join', { gameType: 'BUZZER' })).toMatchObject({ accepted: true });
    });
  });

  describe('against a bot that always knows', () => {
    const { connectPlayer } = startApp({ knows: 1, guess: 0 });

    it('loses to the bot when the player stays quiet', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'BUZZER' });
      const found = await player.waitFor('battle:found');
      await player.send('battle:ready', { battleId: found.battleId });

      const buzzed = await player.waitFor('round:buzzed');
      expect(buzzed.data['participantId']).not.toBe(found.data['youParticipantId']);
      const completed = await player.waitFor('battle:completed');
      expect(completed.data).toMatchObject({ you: { placement: 2, outcome: 'LOSS', score: 0 } });
    });
  });

  describe('two humans', () => {
    // The bot waits a minute here, so the matcher pairs the two players.
    const { connectPlayer } = startApp({ knows: 0, guess: 0 }, 60_000);

    const startHumanBattle = async () => {
      const [first, second] = [await connectPlayer(), await connectPlayer()];
      await first.send('matchmaking:join', { gameType: 'BUZZER' });
      expect((await first.playState()).queue).not.toBeNull();
      await second.send('matchmaking:join', { gameType: 'BUZZER' });
      const found = await first.waitFor('battle:found');
      const battleId = found.battleId as string;
      expect((await second.waitFor('battle:found')).battleId).toBe(battleId);
      expect((found.data['players'] as { kind: string }[]).map((p) => p.kind)).toEqual(['HUMAN', 'HUMAN']);
      expect((await first.playState()).battle).toMatchObject({ battleId });
      await first.send('battle:ready', { battleId });
      await second.send('battle:ready', { battleId });
      await first.waitFor('round:clue');
      return { first, second, battleId, ids: { first: found.data['youParticipantId'] as string } };
    };

    it('pairs two queued players, and a forfeit gives the other one the win', async () => {
      const { first, second, battleId, ids } = await startHumanBattle();

      expect(await second.send('battle:forfeit', { battleId })).toMatchObject({ accepted: true });
      expect((await first.waitFor('player:forfeited')).data).toMatchObject({ reason: 'FORFEIT' });
      expect((await first.waitFor('battle:completed')).data).toMatchObject({
        endReason: 'FORFEIT',
        you: { placement: 1, outcome: 'WIN' },
      });
      expect((await second.waitFor('battle:completed')).data).toMatchObject({ you: { placement: 2, outcome: 'LOSS' } });
      await expect(first.prisma().battle.findUniqueOrThrow({ where: { id: battleId } })).resolves.toMatchObject({
        status: 'COMPLETED',
        endReason: 'FORFEIT',
        hasBot: false,
      });
      expect(ids.first).toBeTruthy();
      expect(await first.send('matchmaking:join', { gameType: 'BUZZER' })).toMatchObject({ accepted: true });
      await first.send('matchmaking:leave', {});
    });

    it('keeps the battle going through a disconnect, and the returning device takes over after resync', async () => {
      const { first, second, battleId } = await startHumanBattle();

      second.socket.disconnect();
      const disconnected = await first.waitFor('player:disconnected');
      expect(disconnected.data['graceUntil']).toBeTruthy();

      const again = await second.reconnect();
      await first.waitFor('player:reconnected');
      const resync = (await again.emitWithAck('battle:resync', {
        clientMsgId: randomUUID(),
        battleId,
        lastSeq: 0,
      })) as {
        accepted: boolean;
        snapshot: { status: string; currentRound: { roundNo: number; revealedClues: string[] }; seq: number };
      };
      expect(resync.accepted).toBe(true);
      expect(resync.snapshot).toMatchObject({ status: 'IN_PROGRESS', currentRound: { roundNo: 1 } });
      expect(resync.snapshot.currentRound.revealedClues[0]).toBe('أي منتخب');

      const buzz = (await again.emitWithAck('round:buzz', { clientMsgId: randomUUID(), battleId, roundNo: 1 })) as {
        accepted: boolean;
      };
      expect(buzz.accepted).toBe(true);
      await first.send('battle:forfeit', { battleId });
      await second.waitFor('battle:completed');
    });

    it('forfeits a player who does not come back within the grace', async () => {
      const { first, second } = await startHumanBattle();

      second.socket.disconnect();
      expect((await first.waitFor('player:forfeited')).data).toMatchObject({ reason: 'GRACE_EXPIRED' });
      expect((await first.waitFor('battle:completed')).data).toMatchObject({
        endReason: 'FORFEIT',
        you: { outcome: 'WIN' },
      });
    });

    it('drops the ticket of a queued player who disconnects (ghost ticket)', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'BUZZER' });
      player.socket.disconnect();

      const deadline = Date.now() + 3_000;
      while ((await player.playState()).queue && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect((await player.playState()).queue).toBeNull();
    });
  });
});
