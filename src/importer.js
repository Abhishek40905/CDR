// ====================================================================
// TRACECDR COMPREHENSIVE IMPORT & VALIDATION ENGINE
// Detects schema profiles, validates CDR records, normalizes timestamps to UTC,
// preserves raw payloads, and rejects aggregate/non-event files safely.
// ====================================================================

const security = require('./security');

const SCHEMA_PROFILES = {
  VEGA: 'VEGA_STANDARD',
  GIST_UNIX: 'GIST_UNIX_TME',
  SIMULATOR_IMSI: 'SIMULATOR_IMSI_EVENT',
  BROADWORKS_RAW: 'BROADWORKS_VOIP_RAW',
  GENERIC_STANDARD: 'GENERIC_STANDARD'
};

/**
 * Detects the schema profile of a CSV/text file from its headers and sample rows.
 */
function detectSchemaProfile(firstLine, secondLine) {
  const line1 = (firstLine || '').trim();
  const line2 = (secondLine || '').trim();

  // 1. Check for known non-event aggregate files that must be rejected
  if (line1.includes('square_id') && line1.includes('time_interval') && line1.includes('sms_in_activity')) {
    return {
      supported: false,
      reason: 'REJECT_NON_EVENT_AGGREGATE: File contains cellular grid traffic aggregations, not transactional CDR call events.'
    };
  }
  if (line1.includes('DeviceEventTypeDirection') && line1.includes('UsageDeviceType')) {
    return {
      supported: false,
      reason: 'REJECT_NON_EVENT_DEVICE_LOG: File contains hardware device state telemetry, not subscriber CDR call logs.'
    };
  }
  if (line1.includes('mo_call_duration') && line1.includes('mo_call_count') && line1.includes('mt_call_duration')) {
    return {
      supported: false,
      reason: 'REJECT_NON_EVENT_SUMMARY_METRICS: File contains aggregated telecom metrics per subscriber, not individual CDR events.'
    };
  }

  // 2. Check for Vega forensic format
  if (line1.includes('A Number') && line1.includes('B Number') && line1.includes('Call_Network_Volume')) {
    return { supported: true, profile: SCHEMA_PROFILES.VEGA, hasHeader: true };
  }

  // 3. Check for Unix Epoch Gist format (TME,CLNG,CLED)
  if (line1.startsWith('TME,CLNG,CLED') || (line1.includes('CLNG') && line1.includes('CLED') && line1.includes('DUR'))) {
    return { supported: true, profile: SCHEMA_PROFILES.GIST_UNIX, hasHeader: true };
  }

  // 4. Check for Simulator IMSI format (imsi,to_imsi,to_msisdn,start_date,start_time...)
  if (line1.startsWith('imsi,to_imsi') || (line1.includes('to_msisdn') && line1.includes('start_time') && line1.includes('duration'))) {
    return { supported: true, profile: SCHEMA_PROFILES.SIMULATOR_IMSI, hasHeader: true };
  }

  // 5. Check for BroadWorks headerless raw VoIP dump
  if (line1.startsWith('BW-CDR-') || line1.includes('VoipXP Enterprise') || (line1.split(',').length > 50 && /^\d{8,15}/.test(line1.split(',')[3] || ''))) {
    return { supported: true, profile: SCHEMA_PROFILES.BROADWORKS_RAW, hasHeader: false };
  }

  // 6. Generic CDR format fallback check
  const cols = line1.toLowerCase().split(',');
  const hasA = cols.some(c => /^(a|caller|calling|src|source|party_?a)$/.test(c.trim()));
  const hasB = cols.some(c => /^(b|callee|called|dst|destination|party_?b)$/.test(c.trim()));
  if (hasA && hasB) {
    return { supported: true, profile: SCHEMA_PROFILES.GENERIC_STANDARD, hasHeader: true };
  }

  return {
    supported: false,
    reason: 'REJECT_UNKNOWN_FORMAT: File headers do not match any recognized telecommunication CDR schema.'
  };
}

/**
 * Parses timestamp string into UTC Date object with robust timezone support.
 */
function parseTimestampToUtc(rawDate, rawTime, timezoneOffsetStr) {
  if (!rawDate && !rawTime) return null;

  // Case 1: Unix epoch timestamp in seconds or milliseconds
  if (!rawTime && (/^\d{10}$/.test(String(rawDate).trim()) || /^\d{13}$/.test(String(rawDate).trim()))) {
    const val = parseInt(rawDate, 10);
    const ms = String(rawDate).trim().length === 10 ? val * 1000 : val;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  // Case 2: BroadWorks format: YYYYMMDDHHMMSS.sss with optional offset
  const bwMatch = String(rawDate).match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/);
  if (bwMatch && !rawTime) {
    const [_, y, m, d, h, min, s] = bwMatch;
    let tz = 'Z';
    if (timezoneOffsetStr) {
      const tzMatch = String(timezoneOffsetStr).match(/([+-]\d{2})(\d{2})?/);
      if (tzMatch) {
        tz = `${tzMatch[1]}:${tzMatch[2] || '00'}`;
      }
    }
    const iso = `${y}-${m}-${d}T${h}:${min}:${s}${tz}`;
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // Case 3: DD/MM/YYYY HH:MM or DD/MM/YYYY HH:MM:SS
  const fullDateTime = rawTime ? `${rawDate} ${rawTime}` : rawDate;
  const dmyMatch = fullDateTime.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (dmyMatch) {
    const [_, day, month, year, hour, min, sec] = dmyMatch;
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min.padStart(2, '0')}:${(sec || '00').padStart(2, '0')}Z`;
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // Case 4: YYYY-MM-DD HH:MM:SS
  const ymdMatch = fullDateTime.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
  if (ymdMatch) {
    const [_, year, month, day, hour, min, sec] = ymdMatch;
    const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min.padStart(2, '0')}:${(sec || '00').padStart(2, '0')}Z`;
    const dt = new Date(iso);
    return isNaN(dt.getTime()) ? null : dt;
  }

  // Standard fallback
  const fallback = new Date(fullDateTime);
  return isNaN(fallback.getTime()) ? null : fallback;
}

/**
 * Standardizes a single parsed record according to schema profile.
 */
function standardizeRecord(profile, rawFields, lineNumber, caseId, headers = []) {
  let aParty = '', bParty = '', startUtc = null, duration = 0;
  let callType = 'CALL', imei = '', imsi = '', cellId = '', towerAddress = '';
  let latitude = null, longitude = null;
  const warnings = [];

  switch (profile) {
    case SCHEMA_PROFILES.VEGA: {
      // Columns: A Number(0), B Number(1), IMSI(2), IMEI(3), Start Time(4), INBOUND_OUTBOUND_IND(5), Call_Network_Volume(6), Latitude(7), Longitude(8), CALL_TYPE(9), Location(10)
      aParty = (rawFields[0] || '').trim();
      bParty = (rawFields[1] || '').trim();
      imsi = (rawFields[2] || '').trim();
      imei = (rawFields[3] || '').trim();
      startUtc = parseTimestampToUtc(rawFields[4]);
      duration = parseInt(rawFields[6], 10) || 0;
      latitude = rawFields[7] ? parseFloat(rawFields[7]) : null;
      longitude = rawFields[8] ? parseFloat(rawFields[8]) : null;
      callType = (rawFields[9] || 'CALL').toUpperCase().trim();
      towerAddress = (rawFields[10] || '').trim();
      cellId = towerAddress.split(',')[0].trim();
      break;
    }

    case SCHEMA_PROFILES.GIST_UNIX: {
      // TME(0), CLNG(1), CLED(2), FCLED(3), DUR(4), TYP(5), ANS(6), FWD(7), CPNY(8)
      aParty = (rawFields[1] || '').trim();
      bParty = (rawFields[2] || '').trim();
      startUtc = parseTimestampToUtc(rawFields[0]);
      duration = parseInt(rawFields[4], 10) || 0;
      callType = (rawFields[5] || 'CALL').trim();
      towerAddress = (rawFields[8] || '').trim();
      break;
    }

    case SCHEMA_PROFILES.SIMULATOR_IMSI: {
      // imsi(0), to_imsi(1), to_msisdn(2), start_date(3), start_time(4), duration(5), type(6), location_id(7)
      imsi = (rawFields[0] || '').trim();
      // Party A identifier explicitly marked as IMSI origin rather than pretending to be an MSISDN
      aParty = `IMSI:${imsi}`;
      bParty = (rawFields[2] || '').trim() || (rawFields[1] ? `IMSI:${rawFields[1]}` : '');
      startUtc = parseTimestampToUtc(rawFields[3], rawFields[4]);
      duration = parseInt(rawFields[5], 10) || 0;
      callType = (rawFields[6] || 'MO').trim();
      cellId = (rawFields[7] || '').trim();
      towerAddress = `BTS-${cellId}`;
      break;
    }

    case SCHEMA_PROFILES.BROADWORKS_RAW: {
      // Field 3: Calling Party, Field 8: Terminating Number, Field 9: Timestamp, Field 10: Offset, Field 14: Duration
      aParty = (rawFields[3] || rawFields[6] || '').trim().replace(/^\+/, '');
      bParty = (rawFields[8] || '').trim().replace(/^\+/, '');
      startUtc = parseTimestampToUtc(rawFields[9], null, rawFields[10]);
      duration = parseInt(rawFields[14], 10) || 0;
      callType = 'VOIP';
      break;
    }

    case SCHEMA_PROFILES.GENERIC_STANDARD: {
      const normalized = headers.map(h => String(h).toLowerCase().replace(/[^a-z0-9]/g, ''));
      const field = (...names) => {
        const index = normalized.findIndex(h => names.includes(h));
        return index >= 0 ? String(rawFields[index] || '').trim() : '';
      };
      aParty = field('a', 'caller', 'calling', 'src', 'source', 'partya');
      bParty = field('b', 'callee', 'called', 'dst', 'destination', 'partyb');
      startUtc = parseTimestampToUtc(field('datetime', 'timestamp', 'starttime', 'calldatetime', 'date'), field('time'));
      duration = parseInt(field('duration', 'dur', 'seconds'), 10) || 0;
      callType = field('type', 'calltype', 'service') || 'CALL';
      imei = field('imei'); imsi = field('imsi');
      cellId = field('cell', 'cellid', 'towerid');
      towerAddress = field('address', 'toweraddress', 'location');
      const lat = field('latitude', 'lat'), lon = field('longitude', 'lon', 'lng');
      latitude = lat ? parseFloat(lat) : null;
      longitude = lon ? parseFloat(lon) : null;
      break;
    }

    default:
      warnings.push('UNKNOWN_PROFILE');
  }

  // --- VALIDATION RULES ---
  if (!aParty || !bParty) {
    return { valid: false, error: `Missing A-Party or B-Party on line ${lineNumber}` };
  }
  if (!startUtc || isNaN(startUtc.getTime())) {
    return { valid: false, error: `Unparseable timestamp on line ${lineNumber}` };
  }
  if (duration < 0) {
    warnings.push(`Negative duration (${duration}) clamped to 0`);
    duration = 0;
  }
  if (duration > 86400) {
    warnings.push(`Excessive duration (${duration}s) exceeds 24 hours`);
  }

  // Coordinate check
  if (latitude !== null && longitude !== null) {
    if (!security.isValidCoordinate(latitude, longitude)) {
      warnings.push(`Invalid geographic coordinates [${latitude}, ${longitude}] dropped`);
      latitude = null;
      longitude = null;
    }
  } else {
    latitude = null;
    longitude = null;
  }

  // Format date and time in UTC
  const callDate = startUtc.toISOString().slice(0, 10);
  const callTime = startUtc.toISOString().slice(11, 19);

  // Generate unique idempotency hash for database deduplication
  const idempotencyHash = security.generateCdrIdempotencyHash(
    caseId || 'temp',
    aParty,
    bParty,
    startUtc,
    duration,
    cellId
  );

  return {
    valid: true,
    data: {
      case_id: caseId,
      idempotency_hash: idempotencyHash,
      a_party: aParty,
      b_party: bParty,
      start_time_utc: startUtc.toISOString(),
      call_date: callDate,
      call_time: callTime,
      duration: duration,
      call_type: callType,
      imei: imei,
      imsi: imsi,
      cell_id: cellId,
      tower_address: towerAddress,
      latitude: latitude,
      longitude: longitude,
      raw_payload: rawFields
    },
    warnings
  };
}

/**
 * Parses full file content into validated, standardized records without truncation.
 */
function parseCdrContent(content, filename, caseId) {
  const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
  if (!lines.length) {
    return { success: false, error: 'File is empty' };
  }

  const profileCheck = detectSchemaProfile(lines[0], lines[1]);
  if (!profileCheck.supported) {
    return {
      success: false,
      rejected: true,
      reason: profileCheck.reason,
      totalLines: lines.length
    };
  }

  const profile = profileCheck.profile;
  const headers = profileCheck.hasHeader ? parseCsvLine(lines[0]) : [];
  const startIndex = profileCheck.hasHeader ? 1 : 0;
  const validRecords = [];
  const rejectedRows = [];
  const allWarnings = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rawLine = lines[i];
    // CSV parsing with double quotes support
    const fields = parseCsvLine(rawLine);
    const result = standardizeRecord(profile, fields, i + 1, caseId, headers);
    if (result.valid) {
      validRecords.push(result.data);
      if (result.warnings && result.warnings.length) {
        allWarnings.push({ line: i + 1, warnings: result.warnings });
      }
    } else {
      rejectedRows.push({ line: i + 1, error: result.error, raw: rawLine.slice(0, 100) });
    }
  }

  const fileHash = security.computeSha256(content);

  return {
    success: true,
    rejected: false,
    profile,
    fileHash,
    filename,
    totalRecords: lines.length - startIndex,
    validCount: validRecords.length,
    rejectedCount: rejectedRows.length,
    records: validRecords,
    rejectedRows: rejectedRows.slice(0, 100), // preserve top 100 rejection reasons
    warnings: allWarnings.slice(0, 50)
  };
}

/**
 * Robust CSV line tokenizer respecting quoted strings containing commas.
 */
function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

module.exports = {
  SCHEMA_PROFILES,
  detectSchemaProfile,
  parseTimestampToUtc,
  standardizeRecord,
  parseCdrContent,
  parseCsvLine
};
