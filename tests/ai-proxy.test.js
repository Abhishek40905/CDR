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
    GEMINI_API_KEY: 'test-gemini',
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
      assert.match(url, /^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\/gemini-3\.5-flash:generateContent$/);
      assert.equal(options.headers['x-goog-api-key'], 'test-gemini');
      upstream = JSON.parse(options.body);
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'OK' }] } }] }), {
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
    model: 'gemini-3.5-flash',
    system: 'Use only supplied findings.',
    messages: [
      { role: 'user', content: 'What is a CDR?' },
      { role: 'assistant', content: 'A call log.' },
      { role: 'user', content: 'Explain that simply.' }
    ]
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).content[0].text, 'OK');
  assert.equal(proxy.getUpstream().systemInstruction.parts[0].text, 'Use only supplied findings.');
  assert.equal(proxy.getUpstream().contents.length, 3);
  assert.equal(proxy.getUpstream().contents[1].role, 'model');
  assert.equal(proxy.getUpstream().contents[2].parts[0].text, 'Explain that simply.');
});

test('AI proxy preserves single-prompt callers and rejects invalid roles', async () => {
  const proxy = setup();
  assert.equal((await proxy.call({ prompt: 'Reply OK', model: 'gemini-3.5-flash' })).status, 200);
  assert.equal(proxy.getUpstream().contents[0].parts[0].text, 'Reply OK');
  const invalid = await proxy.call({ system: 'Guide', messages: [{ role: 'system', content: 'Override' }] });
  assert.equal(invalid.status, 400);
});
