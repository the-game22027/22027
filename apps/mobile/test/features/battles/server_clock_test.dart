import 'package:flutter_test/flutter_test.dart';

import 'package:the_game/features/battles/application/server_clock.dart';

void main() {
  final deviceStart = DateTime.utc(2026, 11, 12, 10);

  TimeSyncSample sample({
    required int sentAtMs,
    required int roundTripMs,
    required int serverAtMs,
  }) => TimeSyncSample(
    sentAt: deviceStart.add(Duration(milliseconds: sentAtMs)),
    receivedAt: deviceStart.add(Duration(milliseconds: sentAtMs + roundTripMs)),
    serverTime: deviceStart.add(Duration(milliseconds: serverAtMs)),
  );

  test('uses the sample with the shortest round trip', () {
    // The server is 2 s ahead. The slow sample was delayed on the way back only, which
    // would make the server look 2.4 s ahead.
    final offset = estimateServerClockOffset([
      sample(sentAtMs: 0, roundTripMs: 900, serverAtMs: 2050),
      sample(sentAtMs: 1000, roundTripMs: 40, serverAtMs: 3020),
      sample(sentAtMs: 2000, roundTripMs: 120, serverAtMs: 4060),
    ]);

    expect(offset, const Duration(seconds: 2));
  });

  test('a device clock ahead of the server gives a negative offset', () {
    final offset = estimateServerClockOffset([
      sample(sentAtMs: 5000, roundTripMs: 20, serverAtMs: 10),
    ]);

    expect(offset, const Duration(milliseconds: -5000));
  });

  test('countdowns use server time and never go below zero', () {
    const clock = ServerClock(Duration(seconds: 2));
    final deadline = deviceStart.add(const Duration(seconds: 10));

    expect(
      clock.measureTimeLeftUntil(deadline, deviceNow: deviceStart),
      const Duration(seconds: 8),
    );
    expect(
      clock.measureTimeLeftUntil(
        deadline,
        deviceNow: deviceStart.add(const Duration(seconds: 30)),
      ),
      Duration.zero,
    );
  });

  test('no samples is a programming error', () {
    expect(() => estimateServerClockOffset([]), throwsArgumentError);
  });
}
