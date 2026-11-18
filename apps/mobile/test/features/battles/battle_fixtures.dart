/// Payloads shaped like the backend's `LiveBattle.emit` envelopes, shared by the battle tests.
library;

const battleId = '0193b000-0000-7000-8000-000000000001';
const serverTime = '2026-11-12T10:00:00.000Z';

/// A battle event envelope as the backend's `LiveBattle.emit` builds it.
Map<String, Object?> battleEnvelope(
  String type,
  int seq,
  Map<String, Object?> data,
) => {
  'battleId': battleId,
  'seq': seq,
  'serverTime': serverTime,
  'type': type,
  'data': data,
};

const humanPlayerJson = {
  'participantId': 'p-human',
  'kind': 'HUMAN',
  'seat': 1,
  'user': {'id': 'u-1', 'displayName': 'Alice', 'username': null},
};
const botPlayerJson = {
  'participantId': 'p-bot',
  'kind': 'BOT',
  'seat': 2,
  'bot': {'displayName': 'Bot Karim'},
};
