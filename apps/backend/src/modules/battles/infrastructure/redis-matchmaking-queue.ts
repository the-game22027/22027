import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import type { GameType } from '@modules/question-bank';
import { REDIS_CLIENT } from '@shared/infrastructure/redis';
import type { Locale } from '@shared/kernel';
import type { MatchmakingQueue, QueueTicket } from '../application/ports/matchmaking-queue';

const queueKey = (gameType: GameType): string => `mm:queue:${gameType}`;
const ticketKey = (ticketId: string): string => `mm:ticket:${ticketId}`;

// Check and remove in one script, so a leave racing the match, or two matcher ticks, can never share a ticket.
const TAKE_PAIR_IF_BOTH_QUEUED = `
if not redis.call('ZSCORE', KEYS[1], ARGV[2]) or not redis.call('ZSCORE', KEYS[1], ARGV[3]) then return {} end
redis.call('ZREM', KEYS[1], ARGV[2], ARGV[3])
local out = {}
for _, id in ipairs({ ARGV[2], ARGV[3] }) do
  local key = ARGV[1] .. id
  table.insert(out, redis.call('GET', key))
  redis.call('DEL', key)
end
return out`;
const TAKE_QUEUED_BEFORE = `
local ids = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[2], 'LIMIT', 0, 100)
local out = {}
for _, id in ipairs(ids) do
  redis.call('ZREM', KEYS[1], id)
  local key = ARGV[1] .. id
  table.insert(out, redis.call('GET', key))
  redis.call('DEL', key)
end
return out`;
const REMOVE_TICKET = `
if redis.call('ZREM', KEYS[1], ARGV[1]) == 1 then
  redis.call('DEL', KEYS[2])
  return 1
end
return 0`;

interface StoredTicket {
  ticketId: string;
  userId: string;
  gameType: GameType;
  locale: Locale;
  queuedAt: string;
}

const ticketOf = (json: string | null): QueueTicket | null => {
  if (!json) return null;
  const stored = JSON.parse(json) as StoredTicket;
  return { ...stored, queuedAt: new Date(stored.queuedAt) };
};

/** The matchmaking queues in Redis (02 §4.8: `mm:*`): a sorted set by queue time plus one key per ticket. */
@Injectable()
export class RedisMatchmakingQueue implements MatchmakingQueue {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async addTicket(ticket: QueueTicket): Promise<void> {
    const stored: StoredTicket = { ...ticket, queuedAt: ticket.queuedAt.toISOString() };
    await this.redis
      .multi()
      .set(ticketKey(ticket.ticketId), JSON.stringify(stored))
      .zadd(queueKey(ticket.gameType), ticket.queuedAt.getTime(), ticket.ticketId)
      .exec();
  }

  async removeTicket(gameType: GameType, ticketId: string): Promise<boolean> {
    return (await this.redis.eval(REMOVE_TICKET, 2, queueKey(gameType), ticketKey(ticketId), ticketId)) === 1;
  }

  async peekOldestTickets(gameType: GameType, max: number): Promise<QueueTicket[]> {
    const ticketIds = await this.redis.zrange(queueKey(gameType), '0', String(max - 1));
    if (ticketIds.length === 0) return [];
    const rows = await this.redis.mget(...ticketIds.map(ticketKey));
    return rows.flatMap((row) => ticketOf(row) ?? []);
  }

  async takeTicketPair(gameType: GameType, [first, second]: readonly [string, string]): Promise<QueueTicket[]> {
    const rows = (await this.redis.eval(
      TAKE_PAIR_IF_BOTH_QUEUED,
      1,
      queueKey(gameType),
      ticketKey(''),
      first,
      second,
    )) as (string | null)[];
    return rows.flatMap((row) => ticketOf(row) ?? []);
  }

  async takeTicketsQueuedBefore(gameType: GameType, cutoff: Date): Promise<QueueTicket[]> {
    const rows = (await this.redis.eval(
      TAKE_QUEUED_BEFORE,
      1,
      queueKey(gameType),
      ticketKey(''),
      cutoff.getTime(),
    )) as (string | null)[];
    return rows.flatMap((row) => ticketOf(row) ?? []);
  }

  async findTicket(ticketId: string): Promise<QueueTicket | null> {
    return ticketOf(await this.redis.get(ticketKey(ticketId)));
  }

  async removeEveryTicket(): Promise<number> {
    if (this.redis.status !== 'ready') await new Promise((resolve) => this.redis.once('ready', resolve));
    let removed = 0;
    for await (const keys of this.redis.scanStream({ match: 'mm:*', count: 500 })) {
      const list = keys as string[];
      if (list.length > 0) removed += await this.redis.del(...list);
    }
    return removed;
  }
}
