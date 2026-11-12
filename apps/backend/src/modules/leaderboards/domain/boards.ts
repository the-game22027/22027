/** The two leaderboards (DEC-18). */
export type Board = 'BATTLES' | 'PREDICTIONS';
export const BOARDS: readonly Board[] = ['BATTLES', 'PREDICTIONS'];

const LEDGER_CATEGORY_OF_BOARD = { BATTLES: 'BATTLE', PREDICTIONS: 'PREDICTION' } as const;
export type LedgerCategory = (typeof LEDGER_CATEGORY_OF_BOARD)[Board];

export function findLedgerCategoryOfBoard(board: Board): LedgerCategory {
  return LEDGER_CATEGORY_OF_BOARD[board];
}

/** Which board a ledger category feeds; null for categories without one (MOTM, DEC-08). */
export function findBoardOfLedgerCategory(category: string): Board | null {
  return BOARDS.find((board) => LEDGER_CATEGORY_OF_BOARD[board] === category) ?? null;
}
