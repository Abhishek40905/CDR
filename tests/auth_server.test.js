const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server/index');
const { requireRole } = require('../server/authMiddleware');

let server;
let baseUrl;

test.before(() => {
  return new Promise((resolve) => {
    // Listen on ephemeral port
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(() => {
  return new Promise((resolve) => {
    server.close(resolve);
  });
});

test('Backend Security & Health Endpoints', async (t) => {
  await t.test('GET /api/health returns operational status and security flags', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'ONLINE');
    assert.equal(typeof data.supabase_configured, 'boolean');
  });

  await t.test('GET /api/config returns safe public config and never leaks secrets', async () => {
    const res = await fetch(`${baseUrl}/api/config`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.supabaseUrl);
    assert.ok(data.supabaseAnonKey);
    // Explicitly verify secrets are NOT leaked
    assert.equal(data.supabaseServiceKey, undefined);
    assert.equal(data.anthropicApiKey, undefined);
    assert.equal(data.service_role_key, undefined);
  });

  await t.test('Enforces Content Security Policy and Security Headers', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.ok(res.headers.get('content-security-policy'));
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(res.headers.get('x-frame-options'), 'DENY');
  });

  await t.test('Protected endpoints reject unauthenticated requests with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, 'AUTH_REQUIRED');
  });
});

test('Role-Based Access Control (RBAC) Enforcement', async (t) => {
  await t.test('requireRole blocks unauthorized roles with 403 Forbidden', () => {
    const middleware = requireRole('superadmin');

    // Viewer trying to execute superadmin action
    const reqViewer = { user: { id: 'u1', role: 'viewer' } };
    let statusSet = null;
    let jsonSent = null;
    const res = {
      status: (code) => {
        statusSet = code;
        return {
          json: (data) => { jsonSent = data; }
        };
      }
    };
    let nextCalled = false;

    middleware(reqViewer, res, () => { nextCalled = true; });

    assert.equal(nextCalled, false);
    assert.equal(statusSet, 403);
    assert.equal(jsonSent.code, 'INSUFFICIENT_PERMISSIONS');
  });

  await t.test('requireRole permits authorized roles', () => {
    const middleware = requireRole('analyst', 'superadmin');
    const reqAnalyst = { user: { id: 'u2', role: 'analyst' } };
    let nextCalled = false;

    middleware(reqAnalyst, {}, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
  });

  await t.test('User metadata role tampering cannot escalate to superadmin', async () => {
    // If a request forged user_metadata with role='superadmin', the server authentication
    // middleware must discard it and assign 'viewer' if not in database
    const { authenticateToken } = require('../server/authMiddleware');

    // Fake token that is not verified by Supabase Auth returns 401
    const req = {
      headers: { authorization: 'Bearer forged.jwt.token' }
    };
    let statusSet = null;
    const res = {
      status: (code) => {
        statusSet = code;
        return { json: () => {} };
      }
    };
    await authenticateToken(req, res, () => {});
    assert.equal(statusSet, 401, 'Forged JWT must be rejected with 401');
  });
});
