# TraceCDR

TraceCDR is a browser-based Call Detail Record review tool. Its production frontend is static and hosted on Vercel. Supabase hosts login, each user's cloud workspace, database policies, and Edge Functions for user administration and optional AI. See [DEPLOYMENT.md](DEPLOYMENT.md) for the complete setup.

> Use only CDR data you are legally authorized to access. Pattern flags and scores are investigative leads, not proof. Confirm findings against the underlying records and other evidence.

## Architecture

| Component | Hosted location | Purpose |
| --- | --- | --- |
| `public/` | Vercel static deployment | Browser UI and analysis |
| Supabase Auth | Supabase | Email/password sessions |
| `profiles`, `app_states`, `audit_logs` | Supabase Postgres | Roles, user-owned workspaces, audit events |
| `supabase/functions/admin-users` | Supabase Edge Functions | Optional superadmin user management |
| `supabase/functions/ai-proxy` | Supabase Edge Functions | Optional AI proxy with server-held key |
| `server/` | Not deployed | Legacy Express API for local/older integrations |

The browser import wizard saves each user's cases and CDR records inside that user's `app_states` document. The normalized `cases`, `cdr_imports`, and `cdr_records` tables are used by the legacy Express import API and are not the browser workspace's data source. Browser data is also cached locally for recovery.

## Public registration

The Vercel frontend always shows **Create an account**. In Supabase Authentication settings, enable **Allow new users to sign up** and the Email provider. The registration form uses an email and password. If email confirmation is enabled, users confirm through their inbox before signing in. Each new Auth user automatically receives an active `analyst` profile from the second migration, with access to their own workspace. No superadmin account or permission is required for signup.

Set the Supabase Auth Site URL and allowed Redirect URL to the Vercel origin so email confirmations return to the app. The Supabase setting controls whether signup requests succeed.

## Optional first superadmin

If you want the user-management console, first register and confirm an account after running all three SQL migrations listed in [DEPLOYMENT.md](DEPLOYMENT.md). Replace its email below and run this SQL in Supabase SQL Editor:

```sql
insert into public.profiles (id, email, username, role, is_active)
select id,
       email,
       coalesce(nullif(raw_user_meta_data->>'username', ''), split_part(email, '@', 1)),
       'superadmin',
       true
from auth.users
where email = 'admin@example.com'
on conflict (id) do update
  set role = 'superadmin', is_active = true, updated_at = now();
```

Promotion to superadmin affects only that account. Other people can continue to register and use their own analyst workspaces without its approval.

## Build locally

Node.js 22 or newer is required for the static build. Copy `.env.example` to `.env`, set the Supabase URL and publishable/anon key, then run:

```sh
npm ci
npm run build
python -m http.server 3000 --directory public
```

Open `http://localhost:3000`. `npm start` still runs the legacy Express service for local/API compatibility; Vercel does not run it. Run `npm test` for the existing Node tests.

The build writes `public/config.js`, containing only the public Supabase URL and key. `.env`, `public/config.js`, imported CDR datasets, and `archive/` are excluded from Git. Keep Supabase secret/service-role keys and `ANTHROPIC_API_KEY` in Supabase Edge Functions, never in Vercel or browser files.

## Files

- [DEPLOYMENT.md](DEPLOYMENT.md): Vercel and Supabase setup and verification
- [GITHUB_GIT_SETUP.txt](GITHUB_GIT_SETUP.txt): Git and GitHub setup
- `supabase/migrations/`: database schema and access policies
- `supabase/functions/`: privileged backend functions
- `public/assets/js/README.md`: frontend script load order
