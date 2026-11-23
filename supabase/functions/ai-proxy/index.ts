import { authorize, cors, json } from '../_shared/auth.ts';

const models = ['claude-haiku-5-5', 'claude-sonnet-4-6'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== 'POST') return json(req, { error: 'POST required.' }, 405);
  const access = await authorize(req, ['analyst', 'superadmin']);
  if ('error' in access) return json(req, { error: access.error }, access.status);
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json(req, { error: 'ANTHROPIC_API_KEY is not set in Supabase Edge Function secrets.' }, 503);

  try {
    const body = await req.json();
    const prompt = body.prompt;
    const model = body.model || models[0];
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 30000 || !models.includes(model)) {
      return json(req, { error: 'Valid prompt and supported model required.' }, 400);
    }
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await upstream.json();
    return json(req, data, upstream.status);
  } catch (error) {
    return json(req, { error: error instanceof Error ? error.message : 'AI request failed.' }, 500);
  }
});
