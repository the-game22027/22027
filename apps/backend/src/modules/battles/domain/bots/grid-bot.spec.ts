import { SeededRandom } from '../random-source';
import { chooseGridCell } from './grid-bot';

const free = (board: (string | null)[]) => board.flatMap((owner, cell) => (owner === null ? [cell] : []));
const _ = null;

describe('the grid bot', () => {
  it('completes its own line first', () => {
    const board = ['b', 'b', _, 'h', 'h', _, _, _, _];
    expect(chooseGridCell(board, 'b', free(board), new SeededRandom(1))).toBe(2);
  });

  it("blocks the opponent's line when it cannot win", () => {
    const board = ['h', _, _, _, 'h', _, 'b', _, _];
    expect(chooseGridCell(board, 'b', free(board), new SeededRandom(1))).toBe(8);
  });

  it('takes the centre on an empty board, and only playable cells', () => {
    const board = [_, _, _, _, _, _, _, _, _];
    expect(chooseGridCell(board, 'b', free(board), new SeededRandom(1))).toBe(4);
    expect(chooseGridCell(board, 'b', [0, 8], new SeededRandom(1))).not.toBe(4);
    expect(chooseGridCell(board, 'b', [], new SeededRandom(1))).toBeNull();
  });
});
