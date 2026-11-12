import type { ParticipantId } from '../games/game-rules';
import { GRID_LINES } from '../games/grid-rules';
import type { RandomSource } from '../random-source';

const CENTRE = 4;

/**
 * Which cell a grid bot claims (08 §3.3): one that wins, else one that blocks the opponent, else the centre,
 * else a random free cell. Only cells in `playable` are considered (free, with a valid unused player).
 */
export function chooseGridCell(
  board: readonly (ParticipantId | null)[],
  bot: ParticipantId,
  playable: readonly number[],
  random: RandomSource,
): number | null {
  if (playable.length === 0) return null;
  const completing = (owner: ParticipantId | null, isMine: boolean) =>
    playable.find((cell) =>
      GRID_LINES.some(
        (line) =>
          line.includes(cell) &&
          line.every(
            (index) =>
              index === cell || (isMine ? board[index] === bot : board[index] !== null && board[index] === owner),
          ),
      ),
    );
  const win = completing(bot, true);
  if (win !== undefined) return win;
  const opponents = [...new Set(board.filter((owner): owner is ParticipantId => owner !== null && owner !== bot))];
  for (const opponent of opponents) {
    const block = completing(opponent, false);
    if (block !== undefined) return block;
  }
  if (playable.includes(CENTRE)) return CENTRE;
  return playable[Math.floor(random.next() * playable.length)] ?? null;
}
