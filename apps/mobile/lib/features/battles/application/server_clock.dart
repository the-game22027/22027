/// The server is the only clock in a battle (`WEBSOCKET.md` §5). Deadlines arrive as server
/// timestamps; the app turns them into countdowns with an estimated offset between the
/// device clock and the server clock, never by trusting the device clock alone.
library;

/// One `time:sync` round trip, measured on the device clock.
class TimeSyncSample {
  const TimeSyncSample({
    required this.sentAt,
    required this.receivedAt,
    required this.serverTime,
  });

  final DateTime sentAt;
  final DateTime receivedAt;
  final DateTime serverTime;

  Duration get roundTrip => receivedAt.difference(sentAt);
}

/// `offset = serverTime − (t0 + rtt/2)` from the sample with the shortest round trip: the
/// shorter the trip, the less the network could have delayed one direction more than the
/// other.
Duration estimateServerClockOffset(List<TimeSyncSample> samples) {
  if (samples.isEmpty) {
    throw ArgumentError('at least one time:sync sample is needed');
  }
  final fastest = samples.reduce(
    (best, sample) => sample.roundTrip < best.roundTrip ? sample : best,
  );
  final deviceTimeAtServer = fastest.sentAt.add(fastest.roundTrip ~/ 2);
  return fastest.serverTime.difference(deviceTimeAtServer);
}

class ServerClock {
  const ServerClock(this.offset);

  /// Before any `time:sync`: the device clock is used as is.
  static const unsynchronized = ServerClock(Duration.zero);

  /// How far the server clock is ahead of the device clock (negative when behind).
  final Duration offset;

  DateTime convertDeviceTimeToServerTime(DateTime deviceTime) =>
      deviceTime.toUtc().add(offset);

  /// The countdown to show for a server [deadline]; never negative.
  Duration measureTimeLeftUntil(
    DateTime deadline, {
    required DateTime deviceNow,
  }) {
    final timeLeft = deadline.difference(
      convertDeviceTimeToServerTime(deviceNow),
    );
    return timeLeft.isNegative ? Duration.zero : timeLeft;
  }
}
