const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'js', 'devi.js'), 'utf8');
const code = source.slice(source.indexOf('function syncChatCase()'), source.indexOf('const md='));

test('AI request includes recent turns and labelled source examples', async () => {
  const row = { date: '2026-11-01', time: '10:00:00', a: '1111111111', b: '2222222222', dur: 30, cell: 'CELL-1' };
  let sent;
  let activeCase = 'case-test';
  const context = {
    H: [],
    CHAT_CASE: null,
    rows: [row],
    sessionStorage: { getItem: () => '1' },
    confirm: () => { throw new Error('Consent should already be stored'); },
    build: () => [{ t: 'Guide', h: 'How to inspect a CDR' }],
    strip: value => String(value),
    live: () => 'One active case',
    findings: () => ({ text: 'One computed flag' }),
    cur: () => ({ id: activeCase }),
    nums: () => ['1111111111'],
    deg: () => ({ '1111111111': 1 }),
    prof: () => ({ R: [row], score: 30, f: ['one computed flag'] }),
    E: value => String(value),
    lk: () => '',
    window: { sb: { functions: { invoke: async (name, args) => {
      assert.equal(name, 'ai-proxy');
      sent = args.body;
      return { data: { content: [{ text: 'Answer from source' }] } };
    } } } }
  };
  vm.createContext(context);
  vm.runInContext(code + '\nthis.chatbot = { remember, ai, evidence };', context);
  context.chatbot.remember('What is this?', 'A CDR record.');
  const answer = await context.chatbot.ai('Explain the score');

  assert.equal(answer, 'Answer from source');
  assert.equal(sent.messages.length, 3);
  assert.equal(sent.messages[0].content, 'What is this?');
  assert.equal(sent.messages[1].content, 'A CDR record.');
  assert.equal(sent.messages[2].content, 'Explain the score');
  assert.match(sent.system, /SOURCE RECORD EXAMPLES:/);
  assert.match(sent.system, /2026-11-01 \| 10:00:00/);
  assert.match(context.chatbot.evidence('1111111111'), /Source records \(examples\)/);
  activeCase = 'case-two';
  context.chatbot.remember('New case question', 'New case answer');
  assert.equal(context.H.length, 2);
  assert.equal(context.H[0].content, 'New case question');
});
