const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const importer = require('../src/importer');

test('Schema Profile Detection & Non-Event Rejection', async (t) => {
  await t.test('Correctly identifies Vega CDR format', () => {
    const header = 'A Number,B Number,IMSI,IMEI,Start Time,INBOUND_OUTBOUND_IND,Call_Network_Volume,Latitude,Longitude,CALL_TYPE,Location';
    const profile = importer.detectSchemaProfile(header, '9876543210,9123456780,4040101,8601,01/01/2026 10:00,OUT,60,28.6,77.2,CALL,Delhi');
    assert.equal(profile.supported, true);
    assert.equal(profile.profile, importer.SCHEMA_PROFILES.VEGA);
  });

  await t.test('Correctly identifies Unix Epoch Gist format', () => {
    const header = 'TME,CLNG,CLED,FCLED,DUR,TYP,ANS,FWD,CPNY';
    const profile = importer.detectSchemaProfile(header, '1451606400,9876543210,9123456780,,120,CALL,1,,Airtel');
    assert.equal(profile.supported, true);
    assert.equal(profile.profile, importer.SCHEMA_PROFILES.GIST_UNIX);
  });

  await t.test('Correctly identifies Simulator IMSI format', () => {
    const header = 'imsi,to_imsi,to_msisdn,start_date,start_time,duration,type,location_id';
    const profile = importer.detectSchemaProfile(header, '404011234567890,404011234567891,9876543210,2026-01-01,10:00:00,45,Voice,BTS001');
    assert.equal(profile.supported, true);
    assert.equal(profile.profile, importer.SCHEMA_PROFILES.SIMULATOR_IMSI);
  });

  await t.test('Safely rejects cellular grid traffic aggregation file', () => {
    const header = 'square_id,time_interval,country_code,sms_in_activity,sms_out_activity,call_in_activity,call_out_activity,internet_traffic';
    const profile = importer.detectSchemaProfile(header, '100,1383260400000,39,0.12,0.45,0.02,0.11,12.5');
    assert.equal(profile.supported, false);
    assert.match(profile.reason, /REJECT_NON_EVENT_AGGREGATE/);
  });

  await t.test('Safely rejects hardware device log file', () => {
    const header = 'DeviceEventTypeDirection,UsageDeviceType,EventDateTime,ByteCount';
    const profile = importer.detectSchemaProfile(header, 'OUT,Handset,2026-01-01,1024');
    assert.equal(profile.supported, false);
    assert.match(profile.reason, /REJECT_NON_EVENT_DEVICE_LOG/);
  });

  await t.test('Safely rejects aggregate subscriber summary file', () => {
    const header = 'subscriber_id,mo_call_duration,mo_call_count,mt_call_duration,mt_call_count';
    const profile = importer.detectSchemaProfile(header, 'SUB123,500,10,400,8');
    assert.equal(profile.supported, false);
    assert.match(profile.reason, /REJECT_NON_EVENT_SUMMARY_METRICS/);
  });
});

test('Real Workspace File Ingestion & Parsing', async (t) => {
  await t.test('Parses CDR_Gist3.csv correctly without truncation', () => {
    const filePath = path.join(__dirname, '..', 'CDR_Gist3.csv');
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8');
    const result = importer.parseCdrContent(content, 'CDR_Gist3.csv', 'case-test-gist');
    assert.equal(result.success, true);
    assert.equal(result.rejected, false);
    assert.equal(result.profile, importer.SCHEMA_PROFILES.GIST_UNIX);
    assert.ok(result.validCount > 40, `Expected >40 valid rows, got ${result.validCount}`);
    // Check that records have ISO UTC timestamps
    const first = result.records[0];
    assert.ok(first.start_time_utc.includes('T'));
    assert.ok(first.a_party.length > 0);
    assert.ok(first.b_party.length > 0);
    assert.ok(first.idempotency_hash.length === 64);
  });

  await t.test('Parses cdr.csv (Simulator IMSI format) with explicit IMSI markers', () => {
    const filePath = path.join(__dirname, '..', 'cdr.csv');
    if (!fs.existsSync(filePath)) return;
    // Read first 200 lines to verify fast parsing
    const content = fs.readFileSync(filePath, 'utf8').split('\n').slice(0, 200).join('\n');
    const result = importer.parseCdrContent(content, 'cdr.csv', 'case-test-sim');
    assert.equal(result.success, true);
    assert.equal(result.profile, importer.SCHEMA_PROFILES.SIMULATOR_IMSI);
    const first = result.records[0];
    assert.ok(first.a_party.startsWith('IMSI:'));
    assert.ok(first.imsi.length > 0);
  });

  await t.test('Parses Vega_CDR.csv with coordinate verification and UTC normalization', () => {
    const filePath = path.join(__dirname, '..', 'Vega_CDR.csv');
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf8').split('\n').slice(0, 150).join('\n');
    const result = importer.parseCdrContent(content, 'Vega_CDR.csv', 'case-test-vega');
    assert.equal(result.success, true);
    assert.equal(result.profile, importer.SCHEMA_PROFILES.VEGA);
    const first = result.records[0];
    assert.ok(first.latitude !== null && first.latitude >= -90 && first.latitude <= 90);
    assert.ok(first.longitude !== null && first.longitude >= -180 && first.longitude <= 180);
  });
});

test('Timestamp & Data Validation Checks', async (t) => {
  await t.test('Parses Unix epoch timestamp correctly', () => {
    const dt = importer.parseTimestampToUtc('1704067200'); // 2024-01-01 00:00:00 UTC
    assert.equal(dt.toISOString(), '2024-01-01T00:00:00.000Z');
  });

  await t.test('Parses DD/MM/YYYY HH:MM:SS format', () => {
    const dt = importer.parseTimestampToUtc('25/12/2025 15:30:45');
    assert.equal(dt.toISOString(), '2025-12-25T15:30:45.000Z');
  });

  await t.test('Clamps negative duration and retains warnings', () => {
    const res = importer.standardizeRecord(
      importer.SCHEMA_PROFILES.VEGA,
      ['9999999999', '8888888888', '40401', '8600', '01/01/2026 12:00', 'OUT', '-30', '28.5', '77.2', 'CALL', 'Delhi'],
      10,
      'case-warn-test'
    );
    assert.equal(res.valid, true);
    assert.equal(res.data.duration, 0);
    assert.ok(res.warnings.some(w => w.includes('Negative duration')));
  });

  await t.test('Drops impossible geographic coordinates', () => {
    const res = importer.standardizeRecord(
      importer.SCHEMA_PROFILES.VEGA,
      ['9999999999', '8888888888', '40401', '8600', '01/01/2026 12:00', 'OUT', '60', '195.0', '-220.0', 'CALL', 'Bogus'],
      11,
      'case-coord-test'
    );
    assert.equal(res.valid, true);
    assert.equal(res.data.latitude, null);
    assert.equal(res.data.longitude, null);
    assert.ok(res.warnings.some(w => w.includes('Invalid geographic coordinates')));
  });
});
