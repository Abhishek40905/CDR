// ====================================================================
// TRACECDR SECURITY MODULE
// Handles CSV formula sanitization, evidence hashing, and input validation
// ====================================================================

const crypto = require('crypto');

/**
 * Neutralizes CSV formula injection (DDE attacks).
 * If a value starts with '=', '+', '-', '@', '\t', or '\r', prefix with single quote "'".
 * Also safely escapes double quotes for standard CSV RFC 4180 compliance.
 */
function sanitizeForCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/^[\=\+\-\@\t\r]/.test(str)) {
    // Prefix dangerous leading characters with a single apostrophe to force text interpretation
    return `'${str}`;
  }
  return str;
}

/**
 * Formats a row of values into a safe CSV line.
 */
function escapeCsvRow(row) {
  return row.map(cell => {
    const sanitized = sanitizeForCsv(cell);
    const escaped = String(sanitized).replace(/"/g, '""');
    return `"${escaped}"`;
  }).join(',');
}

/**
 * Computes an SHA-256 hash of a buffer or string for evidence integrity.
 */
function computeSha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Generates an idempotency hash for an individual CDR event to prevent duplicate records.
 */
function generateCdrIdempotencyHash(caseId, aParty, bParty, startUtc, duration, cellId) {
  const normTime = startUtc instanceof Date ? startUtc.toISOString() : String(startUtc);
  const rawKey = `${caseId}|${String(aParty).trim()}|${String(bParty).trim()}|${normTime}|${parseInt(duration, 10) || 0}|${String(cellId).trim()}`;
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/**
 * Validates whether coordinates fall within valid geographic bounds.
 */
function isValidCoordinate(lat, lon) {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return false;
  const numLat = parseFloat(lat);
  const numLon = parseFloat(lon);
  if (isNaN(numLat) || isNaN(numLon)) return false;
  // Exclude null island (0, 0) as unlocated
  if (numLat === 0 && numLon === 0) return false;
  return numLat >= -90.0 && numLat <= 90.0 && numLon >= -180.0 && numLon <= 180.0;
}

module.exports = {
  sanitizeForCsv,
  escapeCsvRow,
  computeSha256,
  generateCdrIdempotencyHash,
  isValidCoordinate
};
