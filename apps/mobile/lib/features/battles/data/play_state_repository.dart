import 'package:api_client/api_client.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:the_game/core/errors/app_error.dart';
import 'package:the_game/core/network/api_client_provider.dart';
import 'package:the_game/core/time/parse_server_timestamp.dart';
import 'package:the_game/features/battles/data/battle_events.dart';

/// A matchmaking ticket as REST returns it (`MatchmakingTicket`, API §5).
class MatchmakingTicket {
  const MatchmakingTicket({
    required this.ticketId,
    required this.gameType,
    required this.queuedAt,
    this.botFallbackAt,
  });

  final String ticketId;
  final GameType gameType;
  final DateTime queuedAt;
  final DateTime? botFallbackAt;
}

/// What the player is doing right now, read when the app starts or comes back.
class PlayState {
  const PlayState({
    required this.serverTime,
    this.queuedTicket,
    this.battleId,
    this.battleStatus,
  });

  final DateTime serverTime;
  final MatchmakingTicket? queuedTicket;
  final String? battleId;

  /// For example `WAITING_READY` or `IN_PROGRESS`.
  final String? battleStatus;

  bool get isIdle => queuedTicket == null && battleId == null;
}

/// The REST side of battles (API §6.7). Live play stays on the socket; these calls work
/// without one, for example to resume after a restart.
class PlayStateRepository {
  PlayStateRepository({required BattlesApi battlesApi, required MeApi meApi})
    : _battlesApi = battlesApi,
      _meApi = meApi;

  final BattlesApi _battlesApi;
  final MeApi _meApi;

  /// `GET /v1/me/play-state`.
  Future<PlayState> fetchPlayState() async {
    final playState = await sendRequestAndReadData(
      _battlesApi.battlesControllerPlayStateV1,
    );
    final queue = playState.queue;
    return PlayState(
      serverTime: parseServerTimestamp(playState.serverTime),
      queuedTicket: queue == null ? null : _convertTicket(queue),
      battleId: playState.battle?.battleId,
      battleStatus: playState.battle?.status,
    );
  }

  /// `POST /v1/battles/matchmaking`: same as the socket's `matchmaking:join`; the match still
  /// arrives on the socket as `battle:found`.
  Future<MatchmakingTicket> joinMatchmaking(GameType gameType) async =>
      _convertTicket(
        await sendRequestAndReadData(
          () => _battlesApi.battlesControllerJoinV1(
            joinMatchmakingDto: JoinMatchmakingDto(
              gameType: JoinMatchmakingDtoGameTypeEnum.values.firstWhere(
                (value) => value.value == convertGameTypeToCode(gameType),
              ),
            ),
          ),
        ),
      );

  /// `DELETE /v1/battles/matchmaking`: a no-op when the player is not queued.
  Future<void> leaveMatchmaking() =>
      sendRequestWithoutData(_battlesApi.battlesControllerLeaveV1);

  /// The signed-in player's user id, to find their seat in a battle they rejoin.
  Future<String> fetchSignedInUserId() async =>
      (await sendRequestAndReadData(_meApi.meControllerGetMeV1)).id;
}

MatchmakingTicket _convertTicket(MatchmakingTicketDto ticket) =>
    MatchmakingTicket(
      ticketId: ticket.ticketId,
      gameType: findGameTypeByCode(ticket.gameType.value),
      queuedAt: parseServerTimestamp(ticket.queuedAt),
      botFallbackAt: parseOptionalServerTimestamp(ticket.botFallbackAt),
    );

final playStateRepositoryProvider = Provider<PlayStateRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return PlayStateRepository(
    battlesApi: apiClient.getBattlesApi(),
    meApi: apiClient.getMeApi(),
  );
});
