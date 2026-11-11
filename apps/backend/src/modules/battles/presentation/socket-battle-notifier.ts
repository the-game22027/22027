import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import type { BattleNotifier } from '../application/ports/battle-notifier';

export const userChannel = (userId: string): string => `user:${userId}`;

/**
 * Sends to every socket of a user through their channel. A class of its own, so the engine does not
 * depend on the gateway (which depends on the engine).
 */
@Injectable()
export class SocketBattleNotifier implements BattleNotifier {
  private namespace: Namespace | null = null;

  attach(namespace: Namespace): void {
    this.namespace = namespace;
  }

  sendToUser(userId: string, type: string, payload: Record<string, unknown>): void {
    this.namespace?.to(userChannel(userId)).emit(type, payload);
  }
}
