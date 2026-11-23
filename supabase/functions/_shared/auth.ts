import { createClient } from 'npm:@supabase/supabase-js@2';

function firstKey(jsonName: string, legacyName: string): string {
  const legacy = Deno.env.get(legacyName);
  if (legacy) return legacy;
  const keys = JSON.parse(Deno.env.get(jsonName) || '{}');
  return String(keys.default || Object.values(keys)[0] || '');
}

const url = Deno.env.get('SUPABASE_URL') || '';
const adminKey = firstKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const publicKey = firstKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY');

export const admin = url && adminKey ? createClient(url, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null;
const authClient = url && publicKey ? createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null;

export function cors(req: Request): Headers {
  const origin = req.headers.get('origin') || '';
  const allowed = (Deno.env.get('APP_ORIGINS') || '')
    .split(',').map(value => value.trim()).filter(Boolean);
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  });
  if (allowed.includes(origin)) headers.set('Access-Control-Allow-Origin', origin);
  return headers;
}

export function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

export async function authorize(req: Request, roles: string[]) {
  if (!admin || !authClient) return { error: 'Supabase function keys are unavailable.', status: 503 };
  const token = (req.headers.get('authorization') || '').match(/^Bearer (.+)$/i)?.[1];
  if (!token) return { error: 'Sign in required.', status: 401 };
  const { data: identity, error: authError } = await authClient.auth.getUser(token);
  if (authError || !identity.user) return { error: 'Invalid or expired session.', status: 401 };
  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('username, role, is_active').eq('id', identity.user.id).maybeSingle();
  if (profileError) return { error: 'Account profile could not be checked.', status: 503 };
  if (!profile || !profile.is_active) return { error: 'Account is unavailable.', status: 403 };
  if (!roles.includes(profile.role)) return { error: 'Insufficient permissions.', status: 403 };
  return { user: identity.user, profile, admin };
}
