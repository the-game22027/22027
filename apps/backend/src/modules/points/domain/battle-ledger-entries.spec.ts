import { type CompletedBattle, listLedgerEntriesOfBattle } from './battle-ledger-entries';

const battle = (
  participants: CompletedBattle['participants'],
  ruleSetId: string | null = 'rule-set',
): CompletedBattle => ({
  battleId: 'battle',
  mode: 'MATCHMAKING',
  gameType: 'BUZZER',
  hasBot: false,
  roomId: null,
  endedAt: new Date('2026-11-12T10:00:00Z'),
  ruleSetId,
  participants,
});

describe('listLedgerEntriesOfBattle', () => {
  it('gives one entry per human who earned points, at the battle end', () => {
    const entries = listLedgerEntriesOfBattle(
      battle([
        { participantId: 'p1', kind: 'HUMAN', userId: 'u1', points: 30 },
        { participantId: 'p2', kind: 'HUMAN', userId: 'u2', points: 0 },
      ]),
    );
    expect(entries).toEqual([
      expect.objectContaining({
        userId: 'u1',
        category: 'BATTLE',
        sourceType: 'BATTLE_PARTICIPANT',
        sourceId: 'p1',
        ruleSetId: 'rule-set',
        points: 30,
        occurredAt: new Date('2026-11-12T10:00:00Z'),
        context: { battleId: 'battle', battleMode: 'MATCHMAKING', gameType: 'BUZZER', hasBot: false, roomId: null },
      }),
    ]);
  });

  it('never gives bots an entry', () => {
    expect(listLedgerEntriesOfBattle(battle([{ participantId: 'b', kind: 'BOT', userId: null, points: 30 }]))).toEqual(
      [],
    );
  });

  it('needs no rule set when nobody earned points', () => {
    expect(
      listLedgerEntriesOfBattle(battle([{ participantId: 'p1', kind: 'HUMAN', userId: 'u1', points: 0 }], null)),
    ).toEqual([]);
  });

  it('refuses points without a rule set', () => {
    expect(() =>
      listLedgerEntriesOfBattle(battle([{ participantId: 'p1', kind: 'HUMAN', userId: 'u1', points: 5 }], null)),
    ).toThrow('without a rule set');
  });
});
