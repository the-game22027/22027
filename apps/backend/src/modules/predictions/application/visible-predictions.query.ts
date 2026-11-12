import { Inject, Injectable } from '@nestjs/common';
import { FootballQuery } from '@modules/football';
import { SocialQuery } from '@modules/social';
import { type PublicUser, UsersFacade } from '@modules/users';
import {
  clampLimit,
  decodeCursor,
  encodeCursor,
  InvalidCursorError,
  type Page,
  type PageRequest,
} from '@shared/kernel';
import { PredictionOwnerNotFoundError } from '../domain/prediction-errors';
import { canViewPrediction } from '../domain/prediction-visibility';
import { type OwnedPrediction, PREDICTION_REPOSITORY, type PredictionRepository } from './ports/prediction-repository';

export interface FriendPredictionView {
  user: PublicUser;
  prediction: OwnedPrediction;
}

const isUserPosition = (value: Record<string, unknown>): value is { userId: string } =>
  typeof value['userId'] === 'string';
const isNewestFirstPosition = (value: Record<string, unknown>): value is { createdAt: string; id: string } =>
  typeof value['createdAt'] === 'string' &&
  !Number.isNaN(Date.parse(value['createdAt'])) &&
  typeof value['id'] === 'string';

/**
 * Other players' predictions (03 §7.1). Every row passes `canViewPrediction`, the only place the rule lives
 * (DEC-21). Kickoff is checked with the database clock through `football`.
 */
@Injectable()
export class VisiblePredictionsQuery {
  constructor(
    @Inject(PREDICTION_REPOSITORY) private readonly predictions: PredictionRepository,
    private readonly football: FootballQuery,
    private readonly social: SocialQuery,
    private readonly users: UsersFacade,
  ) {}

  /** Friends' predictions for one match: none before kickoff. */
  async listFriendPredictionsForMatch(
    viewerId: string,
    matchId: string,
    page: Partial<PageRequest>,
  ): Promise<Page<FriendPredictionView>> {
    await this.football.getLockInfo(matchId);
    const limit = clampLimit(page.limit);
    const afterUserId = page.cursor === undefined ? null : this.userPositionFrom(page.cursor);
    const kickoffPassed = (await this.football.findMatchIdsPastKickoff([matchId])).length === 1;
    const friendIds = kickoffPassed ? await this.social.listFriendIds(viewerId) : [];
    const rows = await this.predictions.listPredictionsOfUsersForMatch(matchId, friendIds, afterUserId, limit + 1);
    const items = rows.slice(0, limit).filter((prediction) =>
      canViewPrediction({
        viewerId,
        ownerId: prediction.userId,
        areFriends: true,
        blockedEitherWay: false,
        kickoffPassed,
      }),
    );
    const users = new Map(
      (await this.users.findPublicUsers(items.map((row) => row.userId))).map((user) => [user.id, user]),
    );
    const last = rows.slice(0, limit).at(-1);
    return {
      items: items.flatMap((prediction) => {
        const user = users.get(prediction.userId);
        return user ? [{ user, prediction }] : [];
      }),
      nextCursor: rows.length > limit && last ? encodeCursor({ userId: last.userId }) : null,
    };
  }

  /**
   * One player's predictions: all of them for yourself; for a friend, only matches past kickoff (a page can hold
   * fewer than `limit`); anyone else is `USER_NOT_FOUND`.
   */
  async listVisiblePredictionsOfUser(
    viewerId: string,
    ownerId: string,
    page: Partial<PageRequest>,
  ): Promise<Page<OwnedPrediction>> {
    const blockedEitherWay = viewerId !== ownerId && (await this.social.isBlocked(viewerId, ownerId));
    const areFriends = viewerId !== ownerId && !blockedEitherWay && (await this.social.areFriends(viewerId, ownerId));
    if (viewerId !== ownerId && !areFriends) throw new PredictionOwnerNotFoundError();
    const limit = clampLimit(page.limit);
    const after = page.cursor === undefined ? null : this.newestFirstPositionFrom(page.cursor);
    const rows = await this.predictions.listPredictionsOfUser(ownerId, after, limit + 1);
    const scanned = rows.slice(0, limit);
    const pastKickoff = new Set(
      viewerId === ownerId ? [] : await this.football.findMatchIdsPastKickoff(scanned.map((row) => row.matchId)),
    );
    const last = scanned.at(-1);
    return {
      items: scanned.filter((prediction) =>
        canViewPrediction({
          viewerId,
          ownerId,
          areFriends,
          blockedEitherWay,
          kickoffPassed: pastKickoff.has(prediction.matchId),
        }),
      ),
      nextCursor:
        rows.length > limit && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null,
    };
  }

  private userPositionFrom(cursor: string): string {
    const decoded = decodeCursor(cursor);
    if (!decoded || !isUserPosition(decoded)) throw new InvalidCursorError();
    return decoded.userId;
  }

  private newestFirstPositionFrom(cursor: string): { createdAt: Date; id: string } {
    const decoded = decodeCursor(cursor);
    if (!decoded || !isNewestFirstPosition(decoded)) throw new InvalidCursorError();
    return { createdAt: new Date(decoded.createdAt), id: decoded.id };
  }
}
