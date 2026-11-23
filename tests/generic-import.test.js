const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCdrContent } = require('../src/importer');

test('generic CDR headers produce validated events', () => {
  const csv = 'caller,callee,date,time,duration,type,cell_id\n1111111111,2222222222,2023-11-14,22:13:20,45,CALL,C1';
  const result = parseCdrContent(csv, 'generic.csv', '00000000-0000-4000-8000-000000000001');
  assert.equal(result.success, true);
  assert.equal(result.validCount, 1);
  assert.equal(result.records[0].start_time_utc, '2023-11-14T22:13:20.000Z');
  assert.equal(result.records[0].duration, 45);
});
