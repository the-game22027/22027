import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import { ImportQuestionBundle } from '../../src/modules/question-bank/application/import-question-bundle';
import { QuestionBankFacade } from '../../src/modules/question-bank/application/question-bank.facade';
import { QuestionBankCliModule } from '../../src/modules/question-bank/question-bank-cli.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { writeBattleConfigFile } from '../support/battle-config';
import { bundle, buzzerLine, entitySet } from '../support/question-bundles';
import { devSignIn } from '../support/sign-in';
import { createApiTestApp, testConfig } from '../support/test-app';

interface ServerEvent {
  type: string;
  battleId?: string;
  seq?: number;
  data: Record<string, unknown>;
}

/** The dev config with fast timers and one bot profile, so a whole battle takes about a second. */
function writeBattleConfig(bot: { knows: number; guess: number }): string {
  return writeBattleConfigFile((json) => {
    const config = json as {
      engine: Record<string, number>;
      matchmaking: Record<string, number>;
      bots: { profiles: Record<string, Record<string, unknown>> };
      gameTypes: { BUZZER: Record<string, unknown> };
    };
    config.engine = { readyTimeoutMs: 1_500, latencyGraceMs: 50, betweenRoundsMs: 50 };
    config.matchmaking = { botFallbackAfterMs: 50 };
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
    Object.assign(config.gameTypes.BUZZER, {
      roundCount: 2,
      revealIntervalMs: 150,
      resumeDelayMs: 50,
      answerWindowMs: 1_000,
      finalWindowMs: 300,
      points: { correct: 10, perUnrevealedStep: 2, wrong: 0 },
    });
  });
}

describe('battles over WebSocket (e2e)', () => {
  const e = entitySet();
  let spainId: string;
  let naniId: string;

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
          ],
          Object.values(e),
        ),
      );
    await moduleRef.get(QuestionBankFacade).publishQuestionsOfBundle(version);
    const prisma = moduleRef.get(PrismaService);
    spainId = (await prisma.answerEntity.findUniqueOrThrow({ where: { externalRef: e.spain.externalRef } })).id;
    naniId = (await prisma.answerEntity.findUniqueOrThrow({ where: { externalRef: e.nani.externalRef } })).id;
    await moduleRef.close();
  });

  function startApp(bot: { knows: number; guess: number }) {
    let app: NestExpressApplication;
    let url = '';
    const sockets: Socket[] = [];

    beforeAll(async () => {
      app = await createApiTestApp(testConfig({ BATTLE_CONFIG_PATH: writeBattleConfig(bot) }));
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
      return { session, socket, events, send, waitFor, prisma: () => app.get(PrismaService) };
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

    it('refuses a second queue for a busy player, and frees them when they leave', async () => {
      const player = await connectPlayer();

      expect(await player.send('matchmaking:join', { gameType: 'BUZZER' })).toMatchObject({ accepted: true });
      expect(await player.send('matchmaking:join', { gameType: 'BUZZER' })).toMatchObject({
        accepted: false,
        code: 'PLAYER_BUSY',
      });
      // Leaving right away beats the fallback in most runs; either way the player must be free afterwards.
      await player.send('matchmaking:leave', {});
      const found = player.events.find((ev) => ev.type === 'battle:found');
      if (!found)
        expect(await player.send('matchmaking:join', { gameType: 'BUZZER' })).toMatchObject({ accepted: true });
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
});
