const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'js', 'cdr-ingestion.js'), 'utf8');
const parser = source.slice(source.indexOf('const $='), source.indexOf('/* quick path'));
const context = { localStorage: { getItem: () => null } };
vm.createContext(context);
vm.runInContext(parser + '\nthis.parser = { rawParse, toTable, autoMap, build, parseDT };', context);
const { rawParse, toTable, autoMap, build, parseDT } = context.parser;
const options = { dayFirst: true, indian: false, dedupe: false, defA: '' };
function parse(text) {
  const table = toTable(rawParse(text).out);
  const map = autoMap(table.hdr, table.data);
  return build(table, map, options);
}

test('browser parser reads Gist Unix seconds and keeps valid parties', () => {
  const result = parse('TME,CLNG,CLED,FCLED,DUR,TYP\n1700000000,1111111111,2222222222,,42,CALL');
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].date, '2023-11-14');
  assert.equal(result.rows[0].time, '22:13:20');
  assert.equal(result.rows[0].dur, 42);
});

test('browser parser keeps the first BroadWorks data row', () => {
  const fields = Array(16).fill('');
  fields[0] = 'BW-CDR-1'; fields[3] = '1111111111'; fields[8] = '2222222222';
  fields[9] = '20231114221320.000'; fields[10] = '+0530'; fields[14] = '30';
  const result = parse(fields.join(','));
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].time, '16:43:20');
});

test('browser parser rejects missing party and retains repeated events unless dedupe selected', () => {
  const text = 'A Number,B Number,Start Time,Call_Network_Volume\n1111111111,2222222222,2023-11-14 10:00:00,10\n1111111111,2222222222,2023-11-14 10:00:00,10\n1111111111,,2023-11-14 10:00:00,10';
  const result = parse(text);
  assert.equal(result.rows.length, 2);
  assert.equal(result.st.noParty, 1);
  assert.equal(parseDT('1700000000000', true).time, '22:13:20');
});
