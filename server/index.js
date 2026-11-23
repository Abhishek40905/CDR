// ====================================================================
// TRACECDR PRODUCTION BACKEND SERVICE
// Server-authoritative authentication, administrative user management,
// secure AI proxy, and reliable CDR data ingestion
// ====================================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const {
  supabasePublic,
  supabaseAdmin,
  authenticateToken,
  requireRole
} = require('./authMiddleware');
const importer = require('../src/importer');
const security = require('../src/security');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(__dirname, '..', 'public');

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || false }));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Restrictive Content Security Policy (CSP) headers
app.use((req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; " +
    "style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "connect-src 'self' https://*.supabase.co https://tile.openstreetmap.org; " +
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://cdnjs.cloudflare.com; " +
    "frame-ancestors 'none'; " +
    "base-uri 'self';"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ====================================================================
// 1. HEALTH & CONFIGURATION ENDPOINTS
// ====================================================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    version: '2.4.0',
    supabase_configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
    service_admin_enabled: !!supabaseAdmin,
    ai_proxy_enabled: !!process.env.ANTHROPIC_API_KEY,
    timestamp: new Date().toISOString()
  });
});

app.get('/api/config', (req, res) => {
  // Publicly safe config only
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    allowPublicSignup: process.env.ALLOW_PUBLIC_SIGNUP === 'true',
    features: {
      cloudSync: !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY),
      aiProxy: !!process.env.ANTHROPIC_API_KEY,
      serverAuth: true
    }
  });
});

// ====================================================================
// 2. AUTHENTICATION & IDENTITY (SERVER-AUTHORITATIVE)
// ====================================================================
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({
    user: req.user
  });
});

// The browser analysis workspace is saved as one user-owned document. Its
// cases, manual edits, imports, and rules therefore survive a new browser.
app.get('/api/state', authenticateToken, async (req, res) => {
  const { data, error } = await req.supabase.from('app_states').select('state, updated_at').eq('owner_id', req.user.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ state: data ? data.state : null, updatedAt: data ? data.updated_at : null });
});

app.put('/api/state', authenticateToken, requireRole('analyst', 'superadmin'), async (req, res) => {
  const state = req.body;
  if (!state || !Array.isArray(state.cases) || state.cases.length > 10000 ||
      state.cases.some(c => !c || !Array.isArray(c.rows))) {
    return res.status(400).json({ error: 'Invalid workspace state.' });
  }
  const { error } = await req.supabase.from('app_states').upsert({ owner_id: req.user.id, state, updated_at: new Date().toISOString() });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});

// ====================================================================
// 3. ADMIN USER MANAGEMENT (SUPERADMIN ONLY - NO SESSION DISRUPTION)
// ====================================================================
// Lists users with verified database roles
app.get('/api/admin/users', authenticateToken, requireRole('superadmin'), async (req, res) => {
  try {
    const client = req.supabase;
    const { data: profiles, error } = await client
      .from('profiles')
      .select('id, email, username, role, is_active, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ users: profiles || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Creates a new user using service_role admin client so the admin's session is PRESERVED
app.post('/api/admin/users/create', authenticateToken, requireRole('superadmin'), async (req, res) => {
  const { email, password, username, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const assignedRole = ['superadmin', 'analyst', 'viewer'].includes(role) ? role : 'analyst';

  try {
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'ADMIN_KEY_MISSING: SUPABASE_SERVICE_ROLE_KEY is not configured on the server. User creation must be done via Supabase Dashboard.'
      });
    }

    // Server-side admin createUser (bypasses email confirm requirement, does NOT replace admin session)
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { username: username || email.split('@')[0], role: assignedRole }
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    // Insert or update profile in public.profiles table
    const { error: profileWriteError } = await supabaseAdmin.from('profiles').upsert({
      id: newUser.user.id,
      email: email,
      username: username || email.split('@')[0],
      role: assignedRole,
      is_active: true
    });
    if (profileWriteError) return res.status(500).json({ error: 'User created but profile setup failed: ' + profileWriteError.message });

    // Audit event
    const { error: createAuditError } = await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.user.id,
      actor_email: req.user.email,
      actor_role: req.user.role,
      action: 'ADMIN_USER_CREATED',
      target_type: 'USER',
      target_id: newUser.user.id,
      details: { email, role: assignedRole }
    });
    if (createAuditError) return res.status(500).json({ error: 'User created but audit write failed: ' + createAuditError.message });

    res.json({
      success: true,
      message: 'User created successfully.',
      user: { id: newUser.user.id, email, role: assignedRole }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Updates user role in database (superadmin only)
app.post('/api/admin/users/role', authenticateToken, requireRole('superadmin'), async (req, res) => {
  const { userId, role } = req.body;
  if (!userId || !['superadmin', 'analyst', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Valid userId and role are required.' });
  }

  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY is required for role changes.' });
    }
    const { data: target, error: readError } = await supabaseAdmin
      .from('profiles').select('email, role').eq('id', userId).maybeSingle();
    if (readError) return res.status(500).json({ error: readError.message });
    if (!target) return res.status(404).json({ error: 'User profile not found.' });
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ role: role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) return res.status(500).json({ error: error.message });

    const { error: auditError } = await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.user.id,
      actor_email: req.user.email,
      actor_role: req.user.role,
      action: 'ADMIN_USER_ROLE_CHANGED',
      target_type: 'USER',
      target_id: userId,
      details: { email: target.email, role_from: target.role, role_to: role }
    });
    if (auditError) return res.status(500).json({ error: 'Role changed but audit write failed: ' + auditError.message });

    res.json({ success: true, message: `User role updated to '${role}'.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Deletes user (superadmin only)
app.delete('/api/admin/users/:userId', authenticateToken, requireRole('superadmin'), async (req, res) => {
  const { userId } = req.params;
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'SUPABASE_SERVICE_ROLE_KEY required for user deletion.' });
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) return res.status(500).json({ error: error.message });
    await supabaseAdmin.from('profiles').delete().eq('id', userId);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================================================================
// 4. SECURE AI PROXY (SERVER-HELD ANTHROPIC SECRET)
// ====================================================================
app.post('/api/ai/proxy', authenticateToken, requireRole('analyst', 'superadmin'), async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: 'AI_NOT_CONFIGURED: ANTHROPIC_API_KEY is not configured on the server. AI features are unavailable in offline mode.'
    });
  }

  const { prompt, model } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required.' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model || 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'Anthropic API error' });
    }

    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'AI proxy connection failure: ' + err.message });
  }
});

// ====================================================================
// 5. CDR FILE INGESTION (BATCHING, NO 1,000 LIMIT, AUDITED)
// ====================================================================
app.post('/api/cdr/import', authenticateToken, requireRole('analyst', 'superadmin'), async (req, res) => {
  const { caseId, filename, content } = req.body;
  if (!caseId || !content) {
    return res.status(400).json({ error: 'caseId and content are required.' });
  }

  try {
    const { data: owningCase, error: caseError } = await req.supabase
      .from('cases').select('id').eq('id', caseId).maybeSingle();
    if (caseError) return res.status(500).json({ error: caseError.message });
    if (!owningCase) return res.status(404).json({ error: 'Case not found or access denied.' });
    // 1. Parse and validate records with robust schema detection
    const parseResult = importer.parseCdrContent(content, filename || 'import.csv', caseId);

    if (!parseResult.success) {
      return res.status(400).json({
        error: parseResult.reason || parseResult.error,
        rejected: parseResult.rejected || false
      });
    }

    const { records, fileHash, profile, validCount, rejectedCount, warnings } = parseResult;
    if (!validCount) return res.status(400).json({ error: 'No valid CDR events were found.', rejectedRecords: rejectedCount });

    // 2. Insert batch into Supabase public.cdr_imports
    const client = req.supabase;
    const { data: importRow, error: importErr } = await client
      .from('cdr_imports')
      .insert({
        case_id: caseId,
        filename: filename || 'upload.csv',
        file_hash_sha256: fileHash,
        mapping_profile: profile,
        total_records: validCount + rejectedCount,
        valid_records: validCount,
        rejected_records: rejectedCount,
        validation_warnings: warnings,
        imported_by: req.user.id
      })
      .select('id')
      .single();

    if (importErr) return res.status(500).json({ error: 'Could not create import audit record: ' + importErr.message });

    const importId = importRow ? importRow.id : null;

    // 3. Batch insert records in chunks of 500 WITHOUT ANY 1,000 TRUNCATION
    const BATCH_SIZE = 500;
    let insertedTotal = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const chunk = records.slice(i, i + BATCH_SIZE).map(r => ({
        ...r,
        import_id: importId
      }));

      const { data, error: insertError } = await client
        .from('cdr_records')
        .upsert(chunk, { onConflict: 'case_id,idempotency_hash', ignoreDuplicates: true })
        .select('id');

      if (insertError) {
        console.warn(`Chunk ${i / BATCH_SIZE} insert error:`, insertError.message);
        return res.status(500).json({
          success: false,
          error: 'Import stopped after a partial write; retry is safe because records are idempotent.',
          importId,
          insertedRowsBeforeFailure: insertedTotal,
          failedBatch: Math.floor(i / BATCH_SIZE) + 1
        });
      } else {
        insertedTotal += Array.isArray(data) ? data.length : 0;
      }
    }

    // 4. Server-authoritative audit trail entry
    const { error: auditError } = await client.from('audit_logs').insert({
      actor_id: req.user.id,
      actor_email: req.user.email,
      actor_role: req.user.role,
      action: 'CDR_FILE_IMPORTED',
      target_type: 'CDR',
      case_id: caseId,
      details: {
        filename,
        profile,
        hash: fileHash,
        validCount,
        rejectedCount
      }
    });
    if (auditError) return res.status(500).json({ error: 'Records imported but audit write failed: ' + auditError.message, importId, insertedRows: insertedTotal });

    res.json({
      success: true,
      importId,
      profile,
      fileHash,
      validRecords: validCount,
      insertedRecords: insertedTotal,
      rejectedRecords: rejectedCount,
      insertedBatches: Math.ceil(records.length / BATCH_SIZE),
      warnings: warnings.slice(0, 20)
    });
  } catch (err) {
    res.status(500).json({ error: 'CDR Import failed: ' + err.message });
  }
});

// Serve only the frontend directory. This keeps .env, local CDR files,
// source modules, and test fixtures out of the public web root.
app.use(express.static(publicDir, { index: 'index.html', dotfiles: 'deny' }));

// Default route to TraceCDR application
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/') || path.basename(req.path).startsWith('.') || path.extname(req.path)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🛡️  TRACECDR PRODUCTION BACKEND ACTIVE`);
    console.log(`📡 URL: http://localhost:${PORT}`);
    console.log(`🔒 Supabase: ${supabasePublic ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
    console.log(`🔑 Service Admin Key: ${supabaseAdmin ? 'ACTIVE' : 'NOT_SET (Read-only Admin)'}`);
    console.log(`🤖 AI Proxy: ${process.env.ANTHROPIC_API_KEY ? 'ENABLED' : 'DISABLED'}`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
