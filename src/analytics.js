// ====================================================================
// TRACECDR ANALYTICAL FORENSICS ENGINE
// Correct interval-based conference detection, tower-uncertainty travel logic,
// multi-factor audio matching, and explainable investigative leads.
// ====================================================================

const security = require('./security');

/**
 * Calculates Haversine distance in kilometers between two GPS coordinates.
 */
function haversineDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371.0; // Earth radius in km
  const toRad = deg => (deg * Math.PI) / 180.0;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Robust Conference Detection:
 * Identifies actual temporal overlaps using [start_time, start_time + duration],
 * NOT superficial same-minute string matching.
 * Flags when the same A-Party calls two or more different B-Parties simultaneously.
 */
function detectConferenceCalls(records, minOverlapSeconds = 2) {
  const conferences = [];

  // Group calls by caller (A-Party)
  const byCaller = new Map();
  for (const r of records) {
    if (!r.a_party) continue;
    const dur = Math.max(0, parseInt(r.duration, 10) || 0);
    // Zero-duration dropped/missed calls cannot be in an active audio conference
    if (dur <= 0) continue;

    const startMs = new Date(r.start_time_utc).getTime();
    if (isNaN(startMs)) continue;
    const endMs = startMs + dur * 1000;

    if (!byCaller.has(r.a_party)) {
      byCaller.set(r.a_party, []);
    }
    byCaller.get(r.a_party).push({
      ...r,
      _startMs: startMs,
      _endMs: endMs,
      _dur: dur
    });
  }

  // Check temporal interval overlaps for each caller
  for (const [caller, calls] of byCaller.entries()) {
    if (calls.length < 2) continue;

    // Sort chronologically by start time
    calls.sort((a, b) => a._startMs - b._startMs);

    for (let i = 0; i < calls.length; i++) {
      const c1 = calls[i];
      for (let j = i + 1; j < calls.length; j++) {
        const c2 = calls[j];

        // If c2 starts after c1 ended, no further calls can overlap with c1 (because sorted)
        if (c2._startMs >= c1._endMs) {
          break;
        }

        // Overlapping call to a DIFFERENT B-Party indicates conferencing/3-way call
        if (c1.b_party !== c2.b_party) {
          const overlapStart = Math.max(c1._startMs, c2._startMs);
          const overlapEnd = Math.min(c1._endMs, c2._endMs);
          const overlapSec = (overlapEnd - overlapStart) / 1000;

          if (overlapSec >= minOverlapSeconds) {
            conferences.push({
              caller: caller,
              party_b1: c1.b_party,
              party_b2: c2.b_party,
              overlap_seconds: Math.round(overlapSec),
              call1: {
                id: c1.id,
                start: c1.start_time_utc,
                duration: c1._dur,
                b: c1.b_party,
                cell: c1.cell_id
              },
              call2: {
                id: c2.id,
                start: c2.start_time_utc,
                duration: c2._dur,
                b: c2.b_party,
                cell: c2.cell_id
              },
              confidence: overlapSec > 15 ? 'HIGH' : 'MEDIUM',
              reason: `Simultaneous active sessions: ${c1.b_party} and ${c2.b_party} overlapping by ${Math.round(overlapSec)}s`
            });
          }
        }
      }
    }
  }

  return conferences;
}

/**
 * IMSI Clone & Impossible Velocity Anomaly Detection:
 * Accounts for tower-site coverage uncertainty (e.g., 2 km overlap radius)
 * and distinguishes physical travel impossibility from normal adjacent tower handovers.
 */
function detectImsiCloneAnomalies(records, maxPhysicalSpeedKmh = 850.0, towerUncertaintyKm = 2.0) {
  const anomalies = [];

  // Group located calls by IMSI
  const byImsi = new Map();
  for (const r of records) {
    if (!r.imsi || !security.isValidCoordinate(r.latitude, r.longitude)) continue;
    const startMs = new Date(r.start_time_utc).getTime();
    if (isNaN(startMs)) continue;

    if (!byImsi.has(r.imsi)) {
      byImsi.set(r.imsi, []);
    }
    byImsi.get(r.imsi).push({
      ...r,
      _startMs: startMs,
      _lat: parseFloat(r.latitude),
      _lon: parseFloat(r.longitude)
    });
  }

  for (const [imsi, pings] of byImsi.entries()) {
    if (pings.length < 2) continue;
    pings.sort((a, b) => a._startMs - b._startMs);

    for (let i = 1; i < pings.length; i++) {
      const p1 = pings[i - 1];
      const p2 = pings[i];

      // Ignore identical cell towers (stationary dwell)
      if (p1.cell_id && p2.cell_id && p1.cell_id === p2.cell_id) continue;

      const rawDistKm = haversineDistanceKm(p1._lat, p1._lon, p2._lat, p2._lon);
      const deltaMs = Math.abs(p2._startMs - p1._startMs);
      const deltaHours = deltaMs / 3600000.0;

      // Minimum effective distance accounting for overlapping antenna beam coverage
      const effectiveDistKm = Math.max(0.0, rawDistKm - (towerUncertaintyKm * 2));

      if (effectiveDistKm > 5.0) { // Meaningful spatial distance beyond local cell handoff
        // If time elapsed is near zero or speed exceeds commercial aircraft velocity
        const effectiveSpeedKmh = deltaHours > 0 ? (effectiveDistKm / deltaHours) : Infinity;

        if (effectiveSpeedKmh > maxPhysicalSpeedKmh || deltaHours < (1.0 / 120.0)) { // >850 km/h or <30s for >5km
          anomalies.push({
            imsi,
            first_event: {
              time: p1.start_time_utc,
              tower: p1.tower_address || p1.cell_id,
              lat: p1._lat,
              lon: p1._lon,
              caller: p1.a_party,
              callee: p1.b_party
            },
            second_event: {
              time: p2.start_time_utc,
              tower: p2.tower_address || p2.cell_id,
              lat: p2._lat,
              lon: p2._lon,
              caller: p2.a_party,
              callee: p2.b_party
            },
            raw_distance_km: Math.round(rawDistKm * 10) / 10,
            effective_distance_km: Math.round(effectiveDistKm * 10) / 10,
            elapsed_seconds: Math.round(deltaMs / 1000),
            calculated_speed_kmh: isFinite(effectiveSpeedKmh) ? Math.round(effectiveSpeedKmh) : 'IMPOSSIBLE (NEAR INSTANT)',
            confidence: effectiveDistKm > 50 ? 'HIGH (CLONE SUSPECT)' : 'MEDIUM (RAPID HANDOVER / PROXIMATE)',
            disclaimer: 'INVESTIGATIVE LEAD ONLY: Discrepancy may result from SIM cloning, proxy routing, or network timestamp skew. Further tower verification required.'
          });
        }
      }
    }
  }

  return anomalies;
}

/**
 * Multi-Factor Audio-to-CDR Matcher:
 * Evaluates target phone numbers, timestamp proximity, direction, and duration.
 * Replaces naive duration-only matching.
 */
function matchAudioRecordingToCdr(audioMeta, cdrRecords) {
  // audioMeta: { durationSeconds, recordedTimeUtc, targetNumber, direction }
  const matches = [];
  const targetDur = parseFloat(audioMeta.durationSeconds) || 0;
  const audioTime = audioMeta.recordedTimeUtc ? new Date(audioMeta.recordedTimeUtc).getTime() : null;
  const targetNum = (audioMeta.targetNumber || '').replace(/[^\d]/g, '');

  for (const r of cdrRecords) {
    const cdrDur = parseInt(r.duration, 10) || 0;
    const durDiff = Math.abs(cdrDur - targetDur);

    // Strict duration gate: audio duration should be within ±10s of carrier billed duration
    if (durDiff > 10) continue;

    let score = 0;
    const reasons = [];

    // Factor 1: Duration match precision (up to 40 pts)
    const durScore = Math.max(0, 40 - durDiff * 4);
    score += durScore;
    reasons.push(`Duration delta: ${durDiff.toFixed(1)}s (+${Math.round(durScore)} pts)`);

    // Factor 2: Phone number match (up to 35 pts)
    if (targetNum) {
      const cleanA = (r.a_party || '').replace(/[^\d]/g, '');
      const cleanB = (r.b_party || '').replace(/[^\d]/g, '');
      if (cleanA.includes(targetNum) || cleanB.includes(targetNum)) {
        score += 35;
        reasons.push(`Target phone number matched subscriber record (+35 pts)`);
      }
    }

    // Factor 3: Timestamp proximity (up to 25 pts)
    if (audioTime) {
      const cdrTime = new Date(r.start_time_utc).getTime();
      if (!isNaN(cdrTime)) {
        const timeDiffMinutes = Math.abs(cdrTime - audioTime) / 60000;
        if (timeDiffMinutes <= 5) {
          score += 25;
          reasons.push(`Call timestamp matches within ${timeDiffMinutes.toFixed(1)} min (+25 pts)`);
        } else if (timeDiffMinutes <= 60) {
          score += 15;
          reasons.push(`Call timestamp within same hour (+15 pts)`);
        }
      }
    }

    matches.push({
      cdr_id: r.id,
      a_party: r.a_party,
      b_party: r.b_party,
      start_time: r.start_time_utc,
      cdr_duration: cdrDur,
      audio_duration: targetDur,
      match_score: Math.min(100, Math.round(score)),
      reasons
    });
  }

  // Sort by highest match score
  return matches.sort((a, b) => b.match_score - a.match_score);
}

module.exports = {
  haversineDistanceKm,
  detectConferenceCalls,
  detectImsiCloneAnomalies,
  matchAudioRecordingToCdr
};
