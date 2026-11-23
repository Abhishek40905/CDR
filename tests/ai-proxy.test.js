const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');

const source = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'functions', 'ai-proxy', 'index.ts'), 'utf8');

function setup() {
  let handler;
  let upstream;
  const env = {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: 'test-secret',
    SUPABASE_ANON_KEY: 'test-public',
    ANTHROPIC_API_KEY: 'test-anthropic',
    APP_ORIGINS: 'https://example.test'
  };
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } }, error: null }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: { role: 'analyst', is_active: true }, error: null })
        })
      })
    })
  };
  const context = {
    Deno: { env: { get: key => env[key] }, serve: fn => { handler = fn; } },
    createClient: () => client,
    Request, Response, Headers,
    fetch: async (url, options) => {
      assert.equal(url, 'https://api.anthropic.com/v1/messages');
      upstream = JSON.parse(options.body);
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'OK' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  };
  const executable = stripTypeScriptTypes(source.replace("import { createClient } from 'npm:@supabase/supabase-js@2';", ''));
  vm.runInNewContext(executable, context);
  async function call(body) {
    return handler(new Request('https://example.supabase.co/functions/v1/ai-proxy', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-session', Origin: 'https://example.test' },
      body: JSON.stringify(body)
    }));
  }
  return { call, getUpstream: () => upstream };
}

test('AI proxy forwards system instructions and recent chat turns', async () => {
  const proxy = setup();
  const response = await proxy.call({
    model: 'claude-haiku-5-5',
    system: 'Use only supplied findings.',
    messages: [
      { role: 'user', content: 'What is a CDR?' },
      { role: 'assistant', content: 'A call log.' },
      { role: 'user', content: 'Explain that simply.' }
    ]
  });
  assert.equal(response.status, 200);
  assert.equal(proxy.getUpstream().system, 'Use only supplied findings.');
  assert.equal(proxy.getUpstream().messages.length, 3);
  assert.equal(proxy.getUpstream().messages[2].content, 'Explain that simply.');
});

test('AI proxy preserves single-prompt callers and rejects invalid roles', async () => {
  const proxy = setup();
  assert.equal((await proxy.call({ prompt: 'Reply OK', model: 'claude-haiku-5-5' })).status, 200);
  assert.equal(proxy.getUpstream().messages[0].content, 'Reply OK');
  const invalid = await proxy.call({ system: 'Guide', messages: [{ role: 'system', content: 'Override' }] });
  assert.equal(invalid.status, 400);
});
