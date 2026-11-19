import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { readFileSync } from 'node:fs';
import { ActivateBattleRuleSet, BattlesCliModule } from '../../src/modules/battles';
import { ImportQuestionBundle } from '../../src/modules/question-bank/application/import-question-bundle';
import { QuestionBankFacade } from '../../src/modules/question-bank/application/question-bank.facade';
import { QuestionBankCliModule } from '../../src/modules/question-bank/question-bank-cli.module';
import { CoreModule } from '../../src/shared/infrastructure/core.module';
import { PrismaService } from '../../src/shared/infrastructure/persistence';
import { writeBattleConfigFile } from '../support/battle-config';
import {
  bundle,
  buzzerLine,
  careerLine,
  entitySet,
  gridFixture,
  minesFixture,
  auctionFixture,
  hexFixture,
  vaultLine,
  whoLine,
} from '../support/question-bundles';
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
    const { GRID: grid, MINES: mines, AUCTION: auction, VAULT: vault, HEX: hex, ...revealGames } = config.gameTypes;
    if (grid) {
      Object.assign(grid, {
        roundCount: 1,
        turnMs: 1_000,
        maxTurns: 20,
        minAnswersPerCell: 1,
        // The bot picks late enough for a second pick of ours to reach the open attempt.
        rps: { pickMs: 600, maxReplays: 2, revealMs: 50, botPickDelayMs: { min: 200, max: 200 } },
      });
    }
    if (mines) {
      Object.assign(mines, {
        roundCount: 1,
        burying: { minesPerPlayer: 2, ms: 3_000, maxWrongTries: 2 },
        turnMs: 700,
        hearts: 2,
        detector: { usesPerBattle: 1, costMs: 100 },
        rps: { pickMs: 600, maxReplays: 2, revealMs: 50, botPickDelayMs: { min: 200, max: 200 } },
      });
    }
    if (auction) {
      Object.assign(auction, {
        roundCount: 3,
        targetScore: 2,
        pickMs: 1_500,
        bidding: { turnMs: 1_500, minOpeningBid: 1 },
        proof: { ms: 3_000, maxWrong: 3 },
        rps: { pickMs: 600, maxReplays: 2, revealMs: 50, botPickDelayMs: { min: 200, max: 200 } },
      });
    }
    if (vault) {
      Object.assign(vault, {
        roundCount: 3,
        targetScore: 2,
        roundMs: 5_000,
        lockoutMs: [200, 400],
        leaks: { firstAtMs: 300, everyMs: 300, max: 3 },
      });
    }
    if (hex) {
      Object.assign(hex, {
        pickMs: 1_500,
        answerMs: 3_000,
        lockoutMs: [200],
        maxPicks: 30,
        rps: { pickMs: 600, maxReplays: 2, revealMs: 50, botPickDelayMs: { min: 200, max: 200 } },
      });
    }
    for (const game of Object.values(revealGames)) {
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
  const grid = gridFixture();
  const mines = minesFixture();
  const auction = auctionFixture();
  const hex = hexFixture();
  const gridPlayerIds: string[] = [];
  let spainId: string;
  let naniId: string;
  let ronaldoId: string;

  /** Two published Buzzer rounds in both languages, both answered by Spain. */
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [CoreModule.register(testConfig()), QuestionBankCliModule, BattlesCliModule],
    }).compile();
    await moduleRef.init();
    const ruleSetFile = JSON.parse(readFileSync('config/scoring/battle.dev.json', 'utf8')) as { config: unknown };
    await moduleRef.get(ActivateBattleRuleSet).activateBattleRuleSet('e2e', ruleSetFile.config, 'test');
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
            grid.line(`test:${randomUUID()}`),
            mines.line(`test:${randomUUID()}`),
            auction.line(`test:${randomUUID()}`),
            auction.line(`test:${randomUUID()}`),
            auction.line(`test:${randomUUID()}`),
            vaultLine(`test:${randomUUID()}`),
            vaultLine(`test:${randomUUID()}`),
            hex.line(`test:${randomUUID()}`),
          ],
          [...Object.values(e), ...grid.entities, ...mines.entities, ...auction.entities, ...hex.entities],
        ),
      );
    await moduleRef.get(QuestionBankFacade).publishQuestionsOfBundle(version);
    const prisma = moduleRef.get(PrismaService);
    spainId = (await prisma.answerEntity.findUniqueOrThrow({ where: { externalRef: e.spain.externalRef } })).id;
    naniId = (await prisma.answerEntity.findUniqueOrThrow({ where: { externalRef: e.nani.externalRef } })).id;
    ronaldoId = (await prisma.answerEntity.findUniqueOrThrow({ where: { externalRef: e.ronaldo.externalRef } })).id;
    for (const player of grid.players) {
      gridPlayerIds.push(
        (await prisma.answerEntity.findUniqueOrThrow({ where: { externalRef: player.externalRef } })).id,
      );
    }
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
      const reportQuestion = (questionId: string, body: object) =>
        request(app.getHttpServer())
          .post(`/v1/questions/${questionId}/reports`)
          .set('Authorization', `Bearer ${session.accessToken}`)
          .send(body);
      const block = (userId: string) =>
        request(app.getHttpServer())
          .put(`/v1/me/blocks/${userId}`)
          .set('Authorization', `Bearer ${session.accessToken}`)
          .expect(204);
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
      return {
        session,
        socket,
        events,
        send,
        waitFor,
        playState,
        reportQuestion,
        block,
        reconnect,
        prisma: () => app.get(PrismaService),
      };
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
        // Typed in another case than the catalog's name: normalizing makes it an exact match (ADR-0021).
        const typed = roundNo === 1 ? e.spain.names.en.toUpperCase() : e.spain.names.en;
        expect(await player.send('round:answer', { battleId, roundNo, answer: { text: typed } })).toMatchObject({
          accepted: true,
        });
        const result = await player.waitFor('round:result', (event) => event.data['roundNo'] === roundNo);
        expect(result.data['winnerParticipantIds']).toEqual([found.data['youParticipantId']]);
        expect(result.data['reveal']).toMatchObject({ answer: { entityId: spainId, name: e.spain.names.ar } });
      }

      const completed = await player.waitFor('battle:completed');
      // A win against a bot earns no leaderboard points (DEC-41).
      expect(completed.data).toMatchObject({
        endReason: 'COMPLETED',
        you: { placement: 1, outcome: 'WIN', points: 0 },
        pointsPending: false,
      });

      const seqs = player.events.filter((event) => event.battleId === battleId).map((event) => event.seq as number);
      expect(seqs).toEqual([...seqs].sort((a, b) => a - b));
      expect(new Set(seqs).size).toBe(seqs.length);

      const prisma = player.prisma();
      const battle = await prisma.battle.findUniqueOrThrow({
        where: { id: battleId },
        include: { participants: true, rounds: { include: { actions: true } } },
      });
      expect(battle).toMatchObject({ status: 'COMPLETED', endReason: 'COMPLETED', hasBot: true, gameType: 'BUZZER' });
      expect(battle.ruleSetId).toEqual(expect.any(String));
      expect(battle.rounds.map((round) => round.endReason)).toEqual(['CORRECT', 'CORRECT']);
      expect(battle.rounds[0]?.actions.map((action) => action.kind)).toEqual(['BUZZ', 'ANSWER']);
      expect(battle.rounds[0]?.actions[1]).toMatchObject({
        entityId: spainId,
        answerText: e.spain.names.en.toUpperCase(),
        answerMatch: 'EXACT',
        isCorrect: true,
      });
      const event = await prisma.outboxEvent.findFirstOrThrow({
        where: { aggregateId: battleId, type: 'BattleCompleted' },
      });
      expect(event.payload).toMatchObject({
        battleId,
        hasBot: true,
        ruleSetId: battle.ruleSetId,
        endReason: 'COMPLETED',
      });
      expect((event.payload as { participants: { points: number }[] }).participants.map((p) => p.points)).toEqual([
        0, 0,
      ]);
      // The player answered both rounds: each question was served and solved by a human (08 §5.7).
      expect((event.payload as { questionResults: unknown[] }).questionResults).toEqual([
        expect.objectContaining({ roundNo: 1, endReason: 'CORRECT', served: true, solved: true, wrongAnswers: 0 }),
        expect.objectContaining({ roundNo: 2, endReason: 'CORRECT', served: true, solved: true, wrongAnswers: 0 }),
      ]);

      // A served question can be reported once; a repeat is a no-op, anything else is QUESTION_NOT_FOUND (08 §5.7).
      const servedId = battle.rounds[0]?.questionId ?? '';
      const firstResult = player.events.find((ev) => ev.type === 'round:result' && ev.battleId === battleId);
      expect(firstResult?.data['questionId']).toBe(servedId);
      await player.reportQuestion(servedId, { reason: '  the answer is wrong  ' }).expect(204);
      await player.reportQuestion(servedId, { reason: 'second try' }).expect(204);
      await expect(
        prisma.questionReport.findMany({ where: { questionId: servedId, userId: player.session.userId } }),
      ).resolves.toEqual([expect.objectContaining({ reason: 'the answer is wrong' })]);
      const notServed = await player.reportQuestion(randomUUID(), { reason: 'wrong' }).expect(404);
      expect((notServed.body as { code: string }).code).toBe('QUESTION_NOT_FOUND');
      const blank = await player.reportQuestion(servedId, { reason: '   ' }).expect(400);
      expect((blank.body as { code: string }).code).toBe('VALIDATION_FAILED');
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
        // One letter too many: within the typo tolerance of the name (08 §5.3).
        const typo = e.ronaldo.names.en.replace('Ronaldo', 'Ronalldo');
        expect(await player.send('round:answer', { battleId, roundNo: 1, answer: { text: typo } })).toMatchObject({
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

    it('plays GRID: rock-paper-scissors, the board with names, turns, refused moves, and three in a row wins', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'GRID' });
      const found = await player.waitFor('battle:found');
      const battleId = found.battleId as string;
      const me = found.data['youParticipantId'] as string;
      await player.send('battle:ready', { battleId });

      // Rock-paper-scissors decides who starts (08 §9.1): throw until one attempt has a winner.
      let winnerId: unknown = null;
      for (let attempt = 1; winnerId === null; attempt += 1) {
        await player.waitFor('battle:rps-start', (event) => event.data['attempt'] === attempt);
        const pick = { battleId, attempt, choice: 'ROCK' };
        expect(await player.send('battle:rps-pick', pick)).toMatchObject({ accepted: true });
        expect(await player.send('battle:rps-pick', pick)).toMatchObject({ accepted: false, code: 'ALREADY_PICKED' });
        const result = await player.waitFor('battle:rps-result', (event) => event.data['attempt'] === attempt);
        expect(result.data['picks']).toContainEqual({ participantId: me, choice: 'ROCK', auto: false });
        winnerId = result.data['winnerId'];
      }
      expect(await player.send('battle:rps-pick', { battleId, attempt: 1, choice: 'PAPER' })).toMatchObject({
        accepted: false,
        code: 'INVALID_STATE',
      });

      const start = await player.waitFor('round:start');
      expect(start.data['firstTurnParticipantId']).toBe(winnerId);
      const stored = await player.prisma().battle.findUniqueOrThrow({ where: { id: battleId } });
      expect(stored.firstMover).toEqual([expect.objectContaining({ beforeRound: 1, winnerId })]);
      const rows = start.data['rows'] as { kind: string; entity: { name: string } }[];
      expect(rows.map((row) => [row.kind, row.entity.name])).toEqual(
        grid.entities.slice(0, 3).map((club) => ['CLUB', club.names.ar]),
      );
      const myTurn = () =>
        player.waitFor('grid:turn', (event) => event.data['participantId'] === me && !handled.has(event.seq ?? 0));
      const handled = new Set<number>();
      const nameOf = (index: number) => grid.players[index]?.names.en ?? '';
      const claim = async (row: number, col: number, text: string) => {
        const turn = await myTurn();
        handled.add(turn.seq ?? 0);
        return player.send('grid:claim', { battleId, roundNo: 1, cell: { row, col }, answer: { text } });
      };

      // The silent bot always answers wrong, so the top row stays free for us.
      expect(await claim(0, 0, nameOf(0))).toMatchObject({ accepted: true });
      const claimed = await player.waitFor('grid:claimed', (event) => event.data['participantId'] === me);
      expect(claimed.data).toMatchObject({ cell: { row: 0, col: 0 }, player: { entityId: gridPlayerIds[0] } });

      const turn = await myTurn();
      handled.add(turn.seq ?? 0);
      expect(
        await player.send('grid:claim', {
          battleId,
          roundNo: 1,
          cell: { row: 0, col: 0 },
          answer: { text: nameOf(1) },
        }),
      ).toMatchObject({ accepted: false, code: 'CELL_TAKEN' });
      expect(
        await player.send('grid:claim', {
          battleId,
          roundNo: 1,
          cell: { row: 0, col: 1 },
          answer: { text: nameOf(0) },
        }),
      ).toMatchObject({ accepted: false, code: 'PLAYER_ALREADY_USED' });
      expect(
        await player.send('grid:claim', {
          battleId,
          roundNo: 1,
          cell: { row: 0, col: 1 },
          answer: { text: nameOf(1) },
        }),
      ).toMatchObject({ accepted: true });

      expect(await claim(0, 2, nameOf(2))).toMatchObject({ accepted: true });
      const result = await player.waitFor('round:result');
      expect(result.data['winnerParticipantIds']).toEqual([me]);
      expect((result.data['reveal'] as { line: unknown[] }).line).toEqual([
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ]);
      expect((await player.waitFor('battle:completed')).data).toMatchObject({ you: { outcome: 'WIN' } });
    });

    it('plays MINES: burying in secret, own mine refused, the detector, an explosion, and the bot runs out of hearts', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'MINES' });
      const found = await player.waitFor('battle:found');
      const battleId = found.battleId as string;
      const me = found.data['youParticipantId'] as string;
      await player.send('battle:ready', { battleId });
      for (let attempt = 1; ; attempt += 1) {
        await player.waitFor('battle:rps-start', (event) => event.data['attempt'] === attempt);
        await player.send('battle:rps-pick', { battleId, attempt, choice: 'ROCK' });
        const result = await player.waitFor('battle:rps-result', (event) => event.data['attempt'] === attempt);
        if (result.data['winnerId'] !== null) break;
      }

      const start = await player.waitFor('round:start');
      expect(start.data).toMatchObject({ gameType: 'MINES', answerCount: 8, minesPerPlayer: 2, hearts: 2 });
      expect((start.data['criteria'] as { entity: { name: string } }[]).map((c) => c.entity.name)).toEqual([
        mines.entities[0]?.names.ar,
        mines.entities[1]?.names.ar,
      ]);
      const nameOf = (index: number) => mines.players[index]?.names.en ?? '';
      const send = (event: string, text: string) => player.send(event, { battleId, roundNo: 1, answer: { text } });

      // The bot buries first (after its typing delay); we read its mines from the database and bury others,
      // so the two sets never overlap and an explosion is always possible.
      const entityIds = await Promise.all(
        mines.players.map(
          async (p) =>
            (await player.prisma().answerEntity.findUniqueOrThrow({ where: { externalRef: p.externalRef } })).id,
        ),
      );
      let botMineIndexes: number[] = [];
      for (const deadline = Date.now() + 2_000; botMineIndexes.length < 2 && Date.now() < deadline;) {
        const botBuries = await player.prisma().battleRoundAction.findMany({
          where: { battleId, kind: 'MINE_BURY', NOT: { participantId: me } },
        });
        botMineIndexes = botBuries.map((action) => entityIds.indexOf(action.entityId ?? ''));
        if (botMineIndexes.length < 2) await new Promise((resolve) => setTimeout(resolve, 20));
      }
      expect(botMineIndexes).toHaveLength(2);
      const botMineIds = botMineIndexes.map((index) => entityIds[index]);
      const [myFirst, mySecond, safeIndex] = [0, 1, 2, 3, 4, 5, 6, 7].filter(
        (index) => !botMineIndexes.includes(index),
      );

      expect(await send('mines:bury', 'nobody at all')).toMatchObject({ accepted: false, code: 'NOT_IN_CATEGORY' });
      const buried = await send('mines:bury', nameOf(myFirst ?? 0));
      expect(buried).toMatchObject({ accepted: true, data: { mines: [{ auto: false }], wrongTriesLeft: 1 } });
      expect(await send('mines:bury', nameOf(myFirst ?? 0))).toMatchObject({ accepted: false, code: 'ALREADY_BURIED' });
      expect(await send('mines:bury', nameOf(mySecond ?? 0))).toMatchObject({ accepted: true });

      const firstTurn = await player.waitFor('mines:turn', (event) => event.data['turnNo'] === 1);
      expect((firstTurn.data['yourMines'] as { player: { name: string } }[]).map((mine) => mine.player.name)).toEqual([
        mines.players[myFirst ?? 0]?.names.ar,
        mines.players[mySecond ?? 0]?.names.ar,
      ]);
      const beforeExplosion = JSON.stringify(player.events);
      for (const id of botMineIds) expect(beforeExplosion).not.toContain(id);

      const handled = new Set<number>();
      const myTurn = async () => {
        const turn = await player.waitFor(
          'mines:turn',
          (event) => event.data['participantId'] === me && !handled.has(event.seq ?? 0),
        );
        handled.add(turn.seq ?? 0);
      };
      await myTurn();
      expect(await send('mines:answer', nameOf(myFirst ?? 0))).toMatchObject({ accepted: false, code: 'OWN_MINE' });
      expect(await send('mines:scan', nameOf(botMineIndexes[0] ?? 0))).toMatchObject({ accepted: true });
      expect((await player.waitFor('mines:scanned')).data).toMatchObject({ participantId: me, result: 'MINE' });
      expect(await send('mines:scan', nameOf(safeIndex ?? 0))).toMatchObject({
        accepted: false,
        code: 'NO_DETECTOR_LEFT',
      });
      expect(await send('mines:answer', nameOf(botMineIndexes[0] ?? 0))).toMatchObject({ accepted: true });
      const boom = await player.waitFor('mines:answered', (event) => event.data['participantId'] === me);
      expect(boom.data).toMatchObject({ outcome: 'MINE', player: { entityId: botMineIds[0] } });
      expect(boom.data['buriedBy']).not.toBe(me);

      // When the bot moved first, its second timeout already ended the round.
      if (firstTurn.data['participantId'] === me) {
        await myTurn();
        expect(await send('mines:answer', nameOf(safeIndex ?? 0))).toMatchObject({ accepted: true });
      }
      const result = await player.waitFor('round:result');
      expect(result.data['winnerParticipantIds']).toEqual([me]);
      const reveal = result.data['reveal'] as { reason: string; mines: { participantId: string; mines: unknown[] }[] };
      expect(reveal.reason).toBe('LAST_HEART');
      expect(reveal.mines.find((entry) => entry.participantId !== me)?.mines).toContainEqual(
        expect.objectContaining({ player: expect.objectContaining({ entityId: botMineIds[0] }), exploded: true }),
      );
      expect((await player.waitFor('battle:completed')).data).toMatchObject({ you: { outcome: 'WIN' } });
    });

    it('plays AUCTION: pick a list, bid, the bot calls, prove it live, first to the target score wins', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'AUCTION' });
      const found = await player.waitFor('battle:found');
      const battleId = found.battleId as string;
      const me = found.data['youParticipantId'] as string;
      await player.send('battle:ready', { battleId });
      for (let attempt = 1; ; attempt += 1) {
        await player.waitFor('battle:rps-start', (event) => event.data['attempt'] === attempt);
        await player.send('battle:rps-pick', { battleId, attempt, choice: 'ROCK' });
        const result = await player.waitFor('battle:rps-result', (event) => event.data['attempt'] === attempt);
        if (result.data['winnerId'] !== null) break;
      }

      for (const roundNo of [1, 2]) {
        const inRound = (event: { data: Record<string, unknown> }) => event.data['roundNo'] === roundNo;
        const start = await player.waitFor('round:start', inRound);
        const lists = start.data['lists'] as { title: string; answerCount: number }[];
        expect(lists.map((list) => list.answerCount)).toEqual([4, 5, 3]);
        if (start.data['pickerParticipantId'] === me) {
          expect(await player.send('auction:pick', { battleId, roundNo, list: 0 })).toMatchObject({ accepted: true });
        }
        const picked = await player.waitFor('auction:picked', inRound);
        const list = picked.data['list'] as number;
        const size = lists[list]?.answerCount ?? 0;

        const myTurn = await player.waitFor(
          'auction:turn',
          (event) => inRound(event) && event.data['participantId'] === me,
        );
        expect(await player.send('auction:bid', { battleId, roundNo, amount: size + 1 })).toMatchObject({
          accepted: false,
          code: 'BID_TOO_HIGH',
        });
        const opening = myTurn.data['currentBid'] === null ? 2 : (myTurn.data['currentBid'] as number) + 1;
        expect(await player.send('auction:bid', { battleId, roundNo, amount: opening })).toMatchObject({
          accepted: true,
        });
        const proof = await player.waitFor('auction:proof', inRound);
        expect(proof.data).toMatchObject({ proverParticipantId: me, amount: opening, reason: 'CALL' });

        const nameOf = (index: number) => auction.players[list]?.[index]?.names.en ?? '';
        const answer = (text: string) => player.send('auction:answer', { battleId, roundNo, answer: { text } });
        expect(await answer(nameOf(0))).toMatchObject({ accepted: true });
        expect(await answer(nameOf(0))).toMatchObject({ accepted: true });
        const repeated = await player.waitFor(
          'auction:answered',
          (event) => inRound(event) && event.data['outcome'] === 'REPEATED',
        );
        expect(repeated.data).toMatchObject({ phase: 'PROOF', found: 1, strikes: 1 });
        for (let index = 1; index < opening; index += 1) {
          expect(await answer(nameOf(index))).toMatchObject({ accepted: true });
        }
        const result = await player.waitFor('round:result', inRound);
        expect(result.data['winnerParticipantIds']).toEqual([me]);
        const reveal = result.data['reveal'] as { outcome: string; answers: { saidBy?: string }[] };
        expect(reveal.outcome).toBe('PROVED');
        expect(reveal.answers).toHaveLength(size);
        expect(reveal.answers.filter((said) => said.saidBy === me)).toHaveLength(opening);
      }
      // targetScore 2 is reached after two rounds, although the battle could have three.
      expect((await player.waitFor('battle:completed')).data).toMatchObject({ you: { outcome: 'WIN', score: 2 } });
      expect(player.events.some((event) => event.type === 'round:start' && event.data['roundNo'] === 3)).toBe(false);
    });

    it('plays VAULT: a leak, a wrong try that locks only me out, the right code opens it; first to 2 vaults', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'VAULT' });
      const found = await player.waitFor('battle:found');
      const battleId = found.battleId as string;
      const me = found.data['youParticipantId'] as string;
      await player.send('battle:ready', { battleId });

      for (const roundNo of [1, 2]) {
        const inRound = (event: { data: Record<string, unknown> }) => event.data['roundNo'] === roundNo;
        const start = await player.waitFor('round:start', inRound);
        expect(start.data).toMatchObject({ digits: 4, questions: expect.arrayContaining(['سؤال الخزنة 1؟']) });
        expect(JSON.stringify(start.data)).not.toContain('7653');
        const attempt = (code: string) => player.send('vault:try', { battleId, roundNo, code });
        if (roundNo === 1) {
          const leak = await player.waitFor('vault:leak', inRound);
          expect(leak.data['digit']).toBe(Number('7653'[leak.data['position'] as number]));
          expect(await attempt('765')).toMatchObject({ accepted: false, code: 'INVALID_CODE' });
          const wrong = await attempt('7652');
          expect(wrong).toMatchObject({ accepted: true, data: { opened: false, tries: 1 } });
          expect(await attempt('7653')).toMatchObject({ accepted: false, code: 'LOCKED_OUT' });
          const tried = await player.waitFor('vault:tried', inRound);
          expect(tried.data).toEqual({ roundNo, participantId: me, tries: 1 });
          const lockedUntil = new Date(
            (wrong as unknown as { data: { lockedUntil: string } }).data.lockedUntil,
          ).getTime();
          await new Promise((resolve) => setTimeout(resolve, Math.max(0, lockedUntil - Date.now()) + 20));
        }
        expect(await attempt('7653')).toMatchObject({ accepted: true });
        const result = await player.waitFor('round:result', inRound);
        expect(result.data['winnerParticipantIds']).toEqual([me]);
        expect(result.data['reveal']).toMatchObject({ code: '7653', outcome: 'OPENED', openedBy: me });
      }
      expect((await player.waitFor('battle:completed')).data).toMatchObject({ you: { outcome: 'WIN', score: 2 } });
    });

    it('plays HEX: pick along my side, a wrong letter is refused, a wrong name locks me out, connect to win', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'HEX' });
      const found = await player.waitFor('battle:found');
      const battleId = found.battleId as string;
      const me = found.data['youParticipantId'] as string;
      await player.send('battle:ready', { battleId });
      for (let attempt = 1; ; attempt += 1) {
        await player.waitFor('battle:rps-start', (event) => event.data['attempt'] === attempt);
        await player.send('battle:rps-pick', { battleId, attempt, choice: 'ROCK' });
        const result = await player.waitFor('battle:rps-result', (event) => event.data['attempt'] === attempt);
        if (result.data['winnerId'] !== null) break;
      }

      const start = await player.waitFor('round:start');
      expect(start.data['board']).toEqual(Array.from({ length: 9 }, () => 'م'));
      const sides = start.data['sides'] as Record<string, string>;
      // Row 0 joins west to east; cells 0, 3, 6 join north to south on the offset rows.
      const path = sides[me] === 'WEST_EAST' ? [0, 1, 2] : [0, 3, 6];
      const taken = new Set<number>();
      let picker = start.data['firstPickerParticipantId'] as string;
      const nameIn = (cell: number, index: number) => hex.lists[cell]?.[index]?.names.ar ?? '';
      const answer = (text: string) => player.send('hex:answer', { battleId, roundNo: 1, answer: { text } });

      // Events are handled in order: the bot may clear one of my cells ("شيلها"), which races it again.
      let lastSeen = player.events.indexOf(start);
      const after = (event: { type: string }) => player.events.indexOf(event as never) > lastSeen;
      for (let race = 1; ; race += 1) {
        if (picker === me) {
          const cell = path.find((c) => !taken.has(c)) ?? [...Array(9).keys()].find((c) => !taken.has(c));
          expect(await player.send('hex:pick', { battleId, roundNo: 1, cell })).toMatchObject({ accepted: true });
        }
        const raced = await player.waitFor('hex:race', after);
        lastSeen = player.events.indexOf(raced);
        const cell = raced.data['cell'] as number;
        if (raced.data['cleared'] === true) taken.delete(cell);
        expect(raced.data).toMatchObject({ letter: 'م', question: expect.stringContaining('قائمة') });
        if (race === 1) {
          expect(await answer(nameIn(cell, 2))).toMatchObject({ accepted: false, code: 'WRONG_LETTER' });
          expect(await answer('لاعب مش موجود')).toMatchObject({ accepted: true });
          const wrong = await player.waitFor('hex:answered');
          expect(wrong.data['participantId']).toBe(me);
          expect(await answer(nameIn(cell, 0))).toMatchObject({ accepted: false, code: 'LOCKED_OUT' });
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        expect(await answer(nameIn(cell, race % 2))).toMatchObject({ accepted: true });
        const claimed = await player.waitFor('hex:claimed', (event) => after(event) && event.data['cell'] === cell);
        lastSeen = player.events.indexOf(claimed);
        expect(claimed.data['participantId']).toBe(me);
        taken.add(cell);
        if (path.every((c) => taken.has(c))) break;
        const turn = await player.waitFor('hex:turn', after);
        lastSeen = player.events.indexOf(turn);
        picker = turn.data['participantId'] as string;
      }
      const result = await player.waitFor('round:result');
      expect(result.data['winnerParticipantIds']).toEqual([me]);
      const reveal = result.data['reveal'] as { outcome: string; path: number[] };
      expect(reveal.outcome).toBe('CONNECTED');
      expect(reveal.path.length).toBeGreaterThanOrEqual(3);
      expect(reveal.path.every((cell) => taken.has(cell))).toBe(true);
      expect((await player.waitFor('battle:completed')).data).toMatchObject({ you: { outcome: 'WIN', score: 1 } });
    });

    it('picks for a player who does not throw in time, and still starts the round', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'GRID' });
      const found = await player.waitFor('battle:found');
      const me = found.data['youParticipantId'] as string;
      await player.send('battle:ready', { battleId: found.battleId });

      const result = await player.waitFor('battle:rps-result', (event) => event.data['attempt'] === 1);
      expect(result.data['picks']).toContainEqual(expect.objectContaining({ participantId: me, auto: true }));
      const start = await player.waitFor('round:start');
      expect(start.data['firstTurnParticipantId']).toBeTruthy();
    });

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

    it('rejects a non-holder, a number for a name and a blank answer, replays a duplicate ack, and shows a wrong name', async () => {
      const player = await connectPlayer();
      // A career round: its answer is a player, so another player's exact name is shown as the wrong answer.
      await player.send('matchmaking:join', { gameType: 'CAREER' });
      const battleId = (await player.waitFor('battle:found')).battleId as string;
      await player.send('battle:ready', { battleId });
      await player.waitFor('round:clue');

      expect(await player.send('round:answer', { battleId, roundNo: 1, answer: { text: 'ronaldo' } })).toMatchObject({
        accepted: false,
        code: 'NOT_BUZZ_HOLDER',
      });
      const buzzId = randomUUID();
      const buzz = () => player.socket.emitWithAck('round:buzz', { clientMsgId: buzzId, battleId, roundNo: 1 });
      expect(await buzz()).toEqual({ clientMsgId: buzzId, accepted: true });
      expect(await buzz()).toEqual({ clientMsgId: buzzId, accepted: true });
      expect(await player.send('round:answer', { battleId, roundNo: 1, answer: { number: 2010 } })).toMatchObject({
        accepted: false,
        code: 'INVALID_PAYLOAD',
      });
      expect(await player.send('round:answer', { battleId, roundNo: 1, answer: { text: ' ـ ' } })).toMatchObject({
        accepted: false,
        code: 'EMPTY_ANSWER',
      });
      // Exactly another player's name: wrong, and shown as that player, never as the typed text (DEC-60).
      expect(
        await player.send('round:answer', { battleId, roundNo: 1, answer: { text: e.nani.names.en } }),
      ).toMatchObject({ accepted: true });
      const wrong = await player.waitFor('round:wrong');
      expect(wrong.data['answer']).toEqual({ entityId: naniId, name: e.nani.names.ar });
      expect(JSON.stringify(wrong.data)).not.toContain(e.nani.names.en);
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

    it('a bot that knows every name takes every raced cell and connects its sides', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'HEX' });
      const found = await player.waitFor('battle:found');
      const battleId = found.battleId as string;
      const me = found.data['youParticipantId'];
      await player.send('battle:ready', { battleId });
      await player.waitFor('round:start');

      const picked = new Set<number>();
      for (let step = 0; step < 60 && !player.events.some((event) => event.type === 'round:result'); step += 1) {
        const turns = player.events.filter(
          (event) =>
            (event.type === 'round:start' && event.data['firstPickerParticipantId'] !== undefined) ||
            event.type === 'hex:turn',
        );
        const lastTurn = turns.at(-1);
        const turnOwner = lastTurn?.data['firstPickerParticipantId'] ?? lastTurn?.data['participantId'];
        const racedAfter = player.events.some(
          (event) =>
            event.type === 'hex:race' && player.events.indexOf(event) > player.events.indexOf(lastTurn ?? event),
        );
        if (turnOwner === me && !racedAfter) {
          const taken = new Set(
            player.events.filter((event) => event.type === 'hex:claimed').map((event) => event.data['cell'] as number),
          );
          const cell = [...Array(9).keys()].find((c) => !taken.has(c) && !picked.has(c));
          if (cell !== undefined) {
            picked.add(cell);
            await player.send('hex:pick', { battleId, roundNo: 1, cell });
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      const result = await player.waitFor('round:result');
      expect(result.data['reveal']).toMatchObject({ outcome: 'CONNECTED' });
      expect(result.data['winnerParticipantIds']).not.toContain(me);
      expect((await player.waitFor('battle:completed')).data).toMatchObject({ you: { outcome: 'LOSS', score: 0 } });
    });

    it('a bot that knows every digit opens each vault first', async () => {
      const player = await connectPlayer();
      await player.send('matchmaking:join', { gameType: 'VAULT' });
      const found = await player.waitFor('battle:found');
      const me = found.data['youParticipantId'];
      await player.send('battle:ready', { battleId: found.battleId });

      const result = await player.waitFor('round:result', (event) => event.data['roundNo'] === 1);
      expect(result.data['reveal']).toMatchObject({ code: '7653', outcome: 'OPENED' });
      expect(result.data['winnerParticipantIds']).not.toContain(me);
      expect((await player.waitFor('battle:completed')).data).toMatchObject({ you: { outcome: 'LOSS', score: 0 } });
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
      // The dev rule set gives a win against a human 30 points, also by forfeit.
      expect((await first.waitFor('battle:completed')).data).toMatchObject({
        endReason: 'FORFEIT',
        you: { placement: 1, outcome: 'WIN', points: 30 },
        pointsPending: true,
      });
      expect((await second.waitFor('battle:completed')).data).toMatchObject({
        you: { placement: 2, outcome: 'LOSS', points: 0 },
        pointsPending: false,
      });
      await expect(first.prisma().battle.findUniqueOrThrow({ where: { id: battleId } })).resolves.toMatchObject({
        status: 'COMPLETED',
        endReason: 'FORFEIT',
        hasBot: false,
      });
      const event = await first.prisma().outboxEvent.findFirstOrThrow({
        where: { aggregateId: battleId, type: 'BattleCompleted' },
      });
      expect((event.payload as { participants: { participantId: string; points: number }[] }).participants).toEqual(
        expect.arrayContaining([expect.objectContaining({ participantId: ids.first, points: 30 })]),
      );
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

  describe('two humans who blocked each other', () => {
    // A short bot wait: blocked players must each end up with a bot, never with each other (03 §7.1).
    const { connectPlayer } = startApp({ knows: 0, guess: 0 }, 1500);

    it('never pairs them, and each gets a bot', async () => {
      const [first, second] = [await connectPlayer(), await connectPlayer()];
      await second.block(first.session.userId);

      await first.send('matchmaking:join', { gameType: 'BUZZER' });
      await second.send('matchmaking:join', { gameType: 'BUZZER' });
      const [firstFound, secondFound] = [await first.waitFor('battle:found'), await second.waitFor('battle:found')];

      expect(firstFound.battleId).not.toBe(secondFound.battleId);
      for (const found of [firstFound, secondFound]) {
        expect((found.data['players'] as { kind: string }[]).map((player) => player.kind).sort()).toEqual([
          'BOT',
          'HUMAN',
        ]);
      }
    });
  });
});
