import { isISO8601, isUUID } from 'class-validator';
import type { Score } from '../../domain/matchday-timeline';

export function parseMatchId(value: string): string {
  if (!isUUID(value)) throw new Error(`"${value}" is not a match id.`);
  return value;
}

export function parseScore(value: string): Score {
  const match = /^(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) throw new Error(`"${value}" is not a score. Use home-away, like 2-1.`);
  return { home: Number(match[1]), away: Number(match[2]) };
}

export function parseInstant(value: string): Date {
  if (!isISO8601(value, { strict: true }) || !value.endsWith('Z')) {
    throw new Error(`"${value}" is not a UTC time. Use ISO-8601 with Z, like 2026-11-14T20:00:00Z.`);
  }
  return new Date(value);
}

export function parseSpeed(value: string): number {
  const speed = Number(value.replace(/x$/, ''));
  if (!Number.isFinite(speed) || speed <= 0) throw new Error(`"${value}" is not a speed. Use a multiplier, like 60x.`);
  return speed;
}
