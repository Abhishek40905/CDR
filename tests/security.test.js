const test = require('node:test');
const assert = require('node:assert');
const security = require('../src/security');

test('CSV Formula Injection Prevention', async (t) => {
  await t.test('Escapes leading equals sign (=CMD|...)', () => {
    const malicious = '=cmd|\'/C calc\'!A0';
    const sanitized = security.sanitizeForCsv(malicious);
    assert.strictEqual(sanitized, "'=cmd|'/C calc'!A0");
  });

  await t.test('Escapes leading plus (+)', () => {
    const sanitized = security.sanitizeForCsv('+123456789');
    assert.strictEqual(sanitized, "'+123456789");
  });

  await t.test('Escapes leading minus (-)', () => {
    const sanitized = security.sanitizeForCsv('-2+3*10');
    assert.strictEqual(sanitized, "'-2+3*10");
  });

  await t.test('Escapes leading at symbol (@SUM)', () => {
    const sanitized = security.sanitizeForCsv('@SUM(1,2)');
    assert.strictEqual(sanitized, "'@SUM(1,2)");
  });

  await t.test('Preserves benign standard values without modification', () => {
    const benign = '9876543210';
    assert.strictEqual(security.sanitizeForCsv(benign), '9876543210');
    assert.strictEqual(security.sanitizeForCsv('Connaught Place Tower 4'), 'Connaught Place Tower 4');
  });

  await t.test('Properly escapes full CSV row with quotes', () => {
    const row = ['=DDE("calc")', 'Normal User', 'Tower "North"'];
    const csvLine = security.escapeCsvRow(row);
    assert.strictEqual(csvLine, '"\'=DDE(""calc"")","Normal User","Tower ""North"""');
  });
});

test('Evidence Integrity Hashing & Idempotency', async (t) => {
  await t.test('Computes deterministic SHA-256 hash', () => {
    const hash1 = security.computeSha256('Test evidence payload');
    const hash2 = security.computeSha256('Test evidence payload');
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
  });

  await t.test('Generates unique idempotency hash for distinct calls', () => {
    const h1 = security.generateCdrIdempotencyHash('case1', '98100', '98200', '2026-01-01T12:00:00Z', 30, 'T1');
    const h2 = security.generateCdrIdempotencyHash('case1', '98100', '98200', '2026-01-01T12:00:00Z', 30, 'T1');
    const h3 = security.generateCdrIdempotencyHash('case1', '98100', '98200', '2026-01-01T12:01:00Z', 30, 'T1');

    assert.strictEqual(h1, h2, 'Identical calls must share identical idempotency key');
    assert.notStrictEqual(h1, h3, 'Distinct timestamps must have distinct idempotency keys');
  });

  await t.test('Validates geographic coordinate boundaries', () => {
    assert.strictEqual(security.isValidCoordinate(28.6139, 77.2090), true);
    assert.strictEqual(security.isValidCoordinate(-33.8688, 151.2093), true);
    assert.strictEqual(security.isValidCoordinate(95.0, 77.2090), false); // Invalid latitude > 90
    assert.strictEqual(security.isValidCoordinate(28.6139, 195.0), false); // Invalid longitude > 180
    assert.strictEqual(security.isValidCoordinate(0.0, 0.0), false); // Null island rejected as unlocated
    assert.strictEqual(security.isValidCoordinate(null, 77.2), false);
  });
});
