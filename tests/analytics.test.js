const test = require('node:test');
const assert = require('node:assert/strict');
const analytics = require('../src/analytics');

test('Analytical Correctness: Conference Call Detection', async (t) => {
  await t.test('Correctly identifies real interval overlap across minute boundary', () => {
    // Call 1: 10:00:45 UTC, duration 30s -> ends 10:01:15 UTC
    // Call 2: 10:01:00 UTC, duration 25s -> starts before Call 1 ends, ends 10:01:25 UTC
    // Baseline minute-matching (10:00 vs 10:01) would miss this!
    const records = [
      {
        id: 'c1',
        a_party: '9876543210',
        b_party: '9111111111',
        start_time_utc: '2026-01-01T10:00:45.000Z',
        duration: 30
      },
      {
        id: 'c2',
        a_party: '9876543210',
        b_party: '9222222222',
        start_time_utc: '2026-01-01T10:01:00.000Z',
        duration: 25
      }
    ];

    const confs = analytics.detectConferenceCalls(records, 2);
    assert.equal(confs.length, 1);
    assert.equal(confs[0].caller, '9876543210');
    assert.equal(confs[0].party_b1, '9111111111');
    assert.equal(confs[0].party_b2, '9222222222');
    // Overlap: from 10:01:00 to 10:01:15 = 15 seconds
    assert.equal(confs[0].overlap_seconds, 15);
  });

  await t.test('Does NOT falsely flag non-overlapping calls within the same minute', () => {
    // Call 1: 10:00:00 UTC, duration 10s -> ends 10:00:10 UTC
    // Call 2: 10:00:30 UTC, duration 15s -> starts after Call 1 ended
    // Baseline minute-matching (both "10:00") produced false positives!
    const records = [
      {
        id: 'c1',
        a_party: '9876543210',
        b_party: '9111111111',
        start_time_utc: '2026-01-01T10:00:00.000Z',
        duration: 10
      },
      {
        id: 'c2',
        a_party: '9876543210',
        b_party: '9222222222',
        start_time_utc: '2026-01-01T10:00:30.000Z',
        duration: 15
      }
    ];

    const confs = analytics.detectConferenceCalls(records, 2);
    assert.equal(confs.length, 0, 'Must not flag sequential calls in same minute as conference');
  });

  await t.test('Ignores redials to same B-party', () => {
    const records = [
      {
        id: 'c1',
        a_party: '9876543210',
        b_party: '9111111111',
        start_time_utc: '2026-01-01T10:00:00.000Z',
        duration: 30
      },
      {
        id: 'c2',
        a_party: '9876543210',
        b_party: '9111111111',
        start_time_utc: '2026-01-01T10:00:10.000Z',
        duration: 30
      }
    ];
    const confs = analytics.detectConferenceCalls(records, 2);
    assert.equal(confs.length, 0, 'Same B-party redial cannot be a 3-way conference');
  });
});

test('Analytical Correctness: IMSI Clone & Tower Velocity Detection', async (t) => {
  await t.test('Detects physically impossible travel velocity across long distances', () => {
    // Ping 1: Delhi (28.6139, 77.2090) at 10:00 UTC
    // Ping 2: Mumbai (19.0760, 72.8777) at 10:05 UTC (~1150 km in 5 minutes = >13,000 km/h)
    const records = [
      {
        imsi: '404019999999999',
        a_party: '9876543210',
        b_party: '9111111111',
        latitude: 28.6139,
        longitude: 77.2090,
        start_time_utc: '2026-01-01T10:00:00.000Z',
        cell_id: 'DEL-01',
        tower_address: 'Connaught Place, New Delhi'
      },
      {
        imsi: '404019999999999',
        a_party: '9876543210',
        b_party: '9222222222',
        latitude: 19.0760,
        longitude: 72.8777,
        start_time_utc: '2026-01-01T10:05:00.000Z',
        cell_id: 'MUM-01',
        tower_address: 'Bandra, Mumbai'
      }
    ];

    const anomalies = analytics.detectImsiCloneAnomalies(records);
    assert.equal(anomalies.length, 1);
    assert.equal(anomalies[0].imsi, '404019999999999');
    assert.ok(anomalies[0].effective_distance_km > 1000);
    assert.equal(anomalies[0].confidence.includes('CLONE SUSPECT'), true);
    assert.ok(anomalies[0].disclaimer.includes('INVESTIGATIVE LEAD ONLY'));
  });

  await t.test('Tolerates normal proximate cell tower handovers without false alarms', () => {
    // Two towers 1.5 km apart, 2 minutes apart (speed ~45 km/h, well within car speed)
    const records = [
      {
        imsi: '404019999999999',
        latitude: 28.6139,
        longitude: 77.2090,
        start_time_utc: '2026-01-01T10:00:00.000Z',
        cell_id: 'DEL-01'
      },
      {
        imsi: '404019999999999',
        latitude: 28.6250,
        longitude: 77.2150,
        start_time_utc: '2026-01-01T10:02:00.000Z',
        cell_id: 'DEL-02'
      }
    ];

    const anomalies = analytics.detectImsiCloneAnomalies(records);
    assert.equal(anomalies.length, 0, 'Normal driving or tower handover must not trigger clone anomaly');
  });
});

test('Analytical Correctness: Multi-Factor Audio-to-CDR Matcher', async (t) => {
  await t.test('Matches audio based on target phone number, timestamp proximity and duration', () => {
    const cdrRecords = [
      {
        id: 'rec-match-1',
        a_party: '9876543210',
        b_party: '9988776655',
        start_time_utc: '2026-01-01T14:30:00.000Z',
        duration: 120
      },
      {
        id: 'rec-different-num',
        a_party: '9123456780',
        b_party: '9000000000',
        start_time_utc: '2026-01-01T14:30:00.000Z',
        duration: 120
      },
      {
        id: 'rec-bad-dur',
        a_party: '9876543210',
        b_party: '9988776655',
        start_time_utc: '2026-01-01T14:30:00.000Z',
        duration: 350 // Difference of 230 seconds
      }
    ];

    const audioMeta = {
      targetNumber: '9876543210',
      recordedTimeUtc: '2026-01-01T14:31:00.000Z',
      durationSeconds: 121
    };

    const matches = analytics.matchAudioRecordingToCdr(audioMeta, cdrRecords);
    assert.ok(matches.length >= 1);
    assert.equal(matches[0].cdr_id, 'rec-match-1');
    assert.ok(matches[0].match_score >= 80, `Expected score >= 80, got ${matches[0].match_score}`);
    assert.ok(matches.every(m => m.cdr_id !== 'rec-bad-dur'), 'Discrepant durations (>10s) must be excluded');
  });
});
