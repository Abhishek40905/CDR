# Deploy TraceCDR: Vercel frontend + Supabase backend

Vercel serves only `public/` (HTML, CSS, JavaScript, and generated public configuration). Supabase hosts Auth, Postgres with row-level security, and the `admin-users` and `ai-proxy` Edge Functions. The old Express server under `server/` is retained for legacy local/API use and is **not** part of this deployment.

## 1. Set up Supabase

1. Create a Supabase project and copy its **Project URL** and **publishable/anon key** from Project Settings → API Keys. Never use a secret/service-role key in Vercel.
2. In SQL Editor, run these files in order:
   - `supabase/migrations/20261118_secure_tracecdr.sql`
   - `supabase/migrations/20261123_app_states.sql`
   - `supabase/migrations/20261124_active_user_guard.sql`
   If a migration was already applied, do not run it again; apply only later migrations. The first migration is not fully idempotent because it creates named policies.
3. In Authentication settings, enable **Allow new users to sign up** and keep the Email provider enabled. Enable **Confirm Email** if users should verify ownership of their address before signing in. No superadmin approval is involved: the database trigger creates an active `analyst` profile for each new Auth user.
4. In Authentication → URL Configuration, set Site URL to your Vercel production URL once it exists. Add the same exact origin to allowed Redirect URLs, because the registration form sends confirmation links back to its own origin. Add `http://localhost:3000` if you test registration locally.
5. A superadmin is optional and only needed for the admin console. If desired, create one confirmed account and use the promotion SQL in `README.md`.

The browser workspace is stored in `public.app_states`, one JSON document per user. The separate `cases` and `cdr_records` tables belong to the legacy normalized API; the current browser import wizard saves to `app_states`.

## 2. Deploy Supabase Edge Functions

Install the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started). From this repository root:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy admin-users
supabase functions deploy ai-proxy
```

In Supabase Dashboard → Edge Functions → Secrets, set:

| Secret | Value |
| --- | --- |
| `APP_ORIGINS` | Exact allowed browser origins, comma separated, e.g. `https://your-app.vercel.app,http://localhost:3000` |
| `GEMINI_API_KEY` | Optional, only if you want AI features |

Supabase provides its URL and service-role/secret keys to its Edge Functions. The functions check the signed-in user and their active profile before privileged work. Do not copy these secrets into Vercel. If you change your Vercel domain, update `APP_ORIGINS`.

## 3. Deploy the static frontend on Vercel

1. Push this repository to a **private** GitHub repository. Review staged files first: `.env`, `public/config.js`, `node_modules/`, `archive/`, and real CDR datasets must be absent. See `GITHUB_GIT_SETUP.txt` for Git setup.
2. In Vercel, import that repository as a new project. Use **Framework Preset: Other**, repository root as the root directory, **Build Command: `npm run build`**, and **Output Directory: `public`**. `vercel.json` contains those settings too.
3. Add these Vercel environment variables for Production (and Preview only if you will allow preview origins in `APP_ORIGINS`):

   | Variable | Value |
   | --- | --- |
   | `SUPABASE_URL` | `https://YOUR_PROJECT_REF.supabase.co` |
   | `SUPABASE_ANON_KEY` | Supabase publishable/anon key |

4. Deploy. The build generates `public/config.js` from only those public values. The Create an account button is always available; Supabase Auth controls whether signup succeeds. There is no Vercel server function or Node runtime in the deployed app.
5. Copy the deployed HTTPS origin into Supabase `APP_ORIGINS` and Auth Site URL. Update them again if you attach a custom domain.

Vercel preview deployments have different hostnames. The Edge Functions accept only origins listed in `APP_ORIGINS`, so add preview URLs explicitly before using admin or AI tools there.

## 4. Verify

1. Open the Vercel URL, choose **Create an account**, and register with a fresh email. If Confirm Email is enabled, open the email link, return to Vercel, and sign in. No administrator action should be needed.
2. Create a small test case and import a non-sensitive sample. Reload, then sign in from a second browser and confirm the same workspace appears.
3. Register a second account and confirm it gets a separate workspace. A new account should have the `analyst` role in `public.profiles`.
4. If you use the optional admin console, test it with a superadmin. Deactivate a test account in `profiles` and confirm it loses Data API and Edge Function access.
5. If AI is enabled, use Data Studio → AI settings → Test Proxy Connection.

The browser still keeps local workspace copies in `localStorage` for recovery. Use trusted devices for sensitive CDR data and clear site data when retiring a device. The app's local case record and deleted-case bin are browser-side features; the Supabase `audit_logs` table receives the app's cloud audit events.

## Local static check

Copy `.env.example` to `.env`, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`, then run:

```sh
npm ci
npm run build
python -m http.server 3000 --directory public
```

Open `http://localhost:3000`. Do not open `public/index.html` as a `file://` page. The generated `public/config.js` is ignored by Git because Vercel creates it during each build.
