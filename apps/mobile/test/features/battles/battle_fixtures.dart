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

/// `round:result` of a BUZZER round as the local backend sent it (live check, 2026-11-19).
const recordedRoundResultJson = {
  'battleId': '01a1f46b-a805-70b9-bb6c-e49f2e9f2ae5',
  'seq': 11,
  'serverTime': '2026-11-19T15:27:51.065Z',
  'type': 'round:result',
  'data': {
    'roundNo': 1,
    'questionId': '01a1cf94-8e06-778b-860a-9db35ec13d0a',
    'winnerParticipantIds': <Object>[],
    'reveal': {
      'steps': [
        "Which country's",
        'citizenship',
        'does Diego Maradona',
        'hold?',
      ],
      'answer': {
        'entityId': '01a1cf94-8b89-7201-9ce1-4c453a18eb26',
        'name': 'Argentina',
      },
    },
    'points': [
      {'participantId': '01a1f46b-a80d-7089-b724-dd3badff3873', 'points': 0},
      {'participantId': '01a1f46b-a80d-708a-ab3d-eb39f2268a1a', 'points': 0},
    ],
    'scores': [
      {'participantId': '01a1f46b-a80d-7089-b724-dd3badff3873', 'score': 0},
      {'participantId': '01a1f46b-a80d-708a-ab3d-eb39f2268a1a', 'score': 0},
    ],
  },
};

/// `battle:completed` as the local backend sent it (live check, 2026-11-19).
const recordedBattleCompletedJson = {
  'battleId': '01a1f46b-a805-70b9-bb6c-e49f2e9f2ae5',
  'seq': 50,
  'serverTime': '2026-11-19T15:28:50.495Z',
  'type': 'battle:completed',
  'data': {
    'endReason': 'COMPLETED',
    'you': {'placement': 2, 'outcome': 'LOSS', 'score': 0, 'points': 0},
    'placements': [
      {
        'participantId': '01a1f46b-a80d-708a-ab3d-eb39f2268a1a',
        'placement': 1,
        'score': 20,
      },
      {
        'participantId': '01a1f46b-a80d-7089-b724-dd3badff3873',
        'placement': 2,
        'score': 0,
      },
    ],
    'pointsPending': false,
  },
};
