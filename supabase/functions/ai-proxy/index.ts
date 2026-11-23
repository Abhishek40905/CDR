// Self-contained so this function can also be deployed from the Supabase dashboard.
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

const admin = url && adminKey ? createClient(url, adminKey, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null;
const authClient = url && publicKey ? createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false }
}) : null;

function cors(req: Request): Headers {
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

function json(req: Request, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: cors(req) });
}

async function authorize(req: Request, roles: string[]) {
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

const models = ['gemini-3.5-flash', 'gemini-3.5-flash-lite'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST required.' }, 405);
  const access = await authorize(req, ['analyst', 'superadmin']);
  if ('error' in access) return json(req, { error: access.error }, access.status);
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return json(req, { error: 'GEMINI_API_KEY is not set in Supabase Edge Function secrets.' }, 503);

  try {
    const body = await req.json();
    const model = body.model || models[0];
    const system = body.system;
    const messages = body.messages;
    const prompt = body.prompt;
    const validMessages = Array.isArray(messages) && messages.length > 0 && messages.length <= 9
      && messages.every((message: unknown) => {
        if (!message || typeof message !== 'object') return false;
        const turn = message as { role?: unknown; content?: unknown };
        return (turn.role === 'user' || turn.role === 'assistant')
          && typeof turn.content === 'string' && turn.content.trim().length > 0
          && turn.content.length <= 4000;
      })
      && messages[messages.length - 1].role === 'user';
    const hasConversation = typeof system === 'string' && system.trim().length > 0
      && system.length <= 26000 && validMessages
      && messages.reduce((total: number, message: { content: string }) => total + message.content.length, 0) <= 12000;
    const hasPrompt = typeof prompt === 'string' && prompt.trim().length > 0 && prompt.length <= 30000;
    if (!models.includes(model) || (!hasConversation && !hasPrompt)) {
      return json(req, { error: 'Valid prompt or conversation and supported model required.' }, 400);
    }
    const contents = hasConversation
      ? messages.map((message: { role: string; content: string }) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }]
      }))
      : [{ role: 'user', parts: [{ text: prompt }] }];
    const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        ...(hasConversation ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: { maxOutputTokens: 1024 }
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) return json(req, { error: data.error?.message || 'Gemini request failed.' }, upstream.status);
    const answer = (data.candidates?.[0]?.content?.parts || [])
      .map((part: { text?: string }) => part.text || '').join('').trim();
    if (!answer) return json(req, { error: 'Gemini returned no text for this request.' }, 502);
    return json(req, { content: [{ type: 'text', text: answer }] });
  } catch (error) {
    return json(req, { error: error instanceof Error ? error.message : 'AI request failed.' }, 500);
  }
});
