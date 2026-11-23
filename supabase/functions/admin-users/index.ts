import { admin, authorize, cors, json } from '../_shared/auth.ts';

const roles = ['superadmin', 'analyst', 'viewer'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST required.' }, 405);
  const access = await authorize(req, ['superadmin']);
  if ('error' in access) return json(req, { error: access.error }, access.status);
  if (!admin) return json(req, { error: 'Admin key unavailable.' }, 503);

  try {
    const body = await req.json();
    const action = body.action;
    if (action === 'list') {
      const { data, error } = await admin.from('profiles')
        .select('id, email, username, role, is_active, created_at')
        .order('created_at', { ascending: false });
      return error ? json(req, { error: error.message }, 500) : json(req, { users: data || [] });
    }

    if (action === 'create') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const username = String(body.username || email.split('@')[0]).trim();
      const role = roles.includes(body.role) ? body.role : 'analyst';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 8 || !username) {
        return json(req, { error: 'Valid email, username, and password of at least 8 characters required.' }, 400);
      }
      const created = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { username }
      });
      if (created.error || !created.data.user) return json(req, { error: created.error?.message || 'User creation failed.' }, 400);
      const userId = created.data.user.id;
      const profile = await admin.from('profiles').upsert({ id: userId, email, username, role, is_active: true });
      if (profile.error) return json(req, { error: 'User created, but profile setup failed: ' + profile.error.message }, 500);
      const audit = await admin.from('audit_logs').insert({
        actor_id: access.user.id, actor_email: access.user.email, actor_role: 'superadmin',
        action: 'ADMIN_USER_CREATED', target_type: 'USER', target_id: userId,
        details: { email, role }
      });
      if (audit.error) return json(req, { error: 'User created, but audit write failed: ' + audit.error.message }, 500);
      return json(req, { success: true, user: { id: userId, email, role } });
    }

    if (action === 'role' || action === 'delete') {
      const userId = String(body.userId || '');
      if (!/^[0-9a-f-]{36}$/i.test(userId)) return json(req, { error: 'Valid user ID required.' }, 400);
      if (userId === access.user.id) return json(req, { error: 'You cannot change or delete your own account.' }, 400);
      const target = await admin.from('profiles').select('email, role').eq('id', userId).maybeSingle();
      if (target.error) return json(req, { error: target.error.message }, 500);
      if (!target.data) return json(req, { error: 'User profile not found.' }, 404);
      if (target.data.role === 'superadmin') {
        const count = await admin.from('profiles').select('id', { count: 'exact', head: true })
          .eq('role', 'superadmin').eq('is_active', true);
        if (count.error) return json(req, { error: count.error.message }, 500);
        if ((count.count || 0) <= 1) return json(req, { error: 'At least one active superadmin is required.' }, 400);
      }
      if (action === 'role') {
        if (!roles.includes(body.role)) return json(req, { error: 'Invalid role.' }, 400);
        const updated = await admin.from('profiles').update({ role: body.role, updated_at: new Date().toISOString() }).eq('id', userId);
        if (updated.error) return json(req, { error: updated.error.message }, 500);
        const audit = await admin.from('audit_logs').insert({
          actor_id: access.user.id, actor_email: access.user.email, actor_role: 'superadmin',
          action: 'ADMIN_USER_ROLE_CHANGED', target_type: 'USER', target_id: userId,
          details: { email: target.data.email, role_from: target.data.role, role_to: body.role }
        });
        if (audit.error) return json(req, { error: 'Role changed, but audit write failed: ' + audit.error.message }, 500);
        return json(req, { success: true });
      }
      const deleted = await admin.auth.admin.deleteUser(userId);
      if (deleted.error) return json(req, { error: deleted.error.message }, 500);
      const audit = await admin.from('audit_logs').insert({
        actor_id: access.user.id, actor_email: access.user.email, actor_role: 'superadmin',
        action: 'ADMIN_USER_DELETED', target_type: 'USER', target_id: userId,
        details: { email: target.data.email, role: target.data.role }
      });
      if (audit.error) return json(req, { error: 'User deleted, but audit write failed: ' + audit.error.message }, 500);
      return json(req, { success: true });
    }
    return json(req, { error: 'Unknown admin action.' }, 400);
  } catch (error) {
    return json(req, { error: error instanceof Error ? error.message : 'Admin request failed.' }, 500);
  }
});
