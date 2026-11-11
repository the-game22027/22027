export const BATTLE_NOTIFIER = Symbol('BATTLE_NOTIFIER');

/** Delivers server events to every socket of a user (WEBSOCKET.md §2). Implemented by the gateway. */
export interface BattleNotifier {
  sendToUser(userId: string, type: string, payload: Record<string, unknown>): void;
}
