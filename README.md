# Wevenu

The operating system for independent wedding and event venues.

> **Sprint 1 — Foundation.** This repository currently contains the application
> foundation only: authentication, navigation, theming and a responsive
> workspace shell. No business modules have been built yet.

## Tech stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling/UI:** Tailwind CSS v4 + shadcn/ui
- **Backend:** Supabase (Auth, Postgres, RLS) via `@supabase/ssr`
- **Hosting:** Vercel (target)

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in your Supabase values (optional for first run)
npm run dev
```

Open http://localhost:3000.

> The app runs **without** Supabase credentials: the login screen renders and
> protected routes redirect to it. Live credentials are an expected
> infrastructure dependency, not a requirement to run the foundation locally.

## Environment variables

Configure these in `.env.local` (local) or in your hosting provider (deploys).

| Variable | Required | Where it's used | Where to find it |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes (to sign in) | `lib/env.ts` → `integrations/supabase/{client,server,proxy}.ts` | Supabase Dashboard → Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes (to sign in) | `lib/env.ts` → `integrations/supabase/{client,server,proxy}.ts` | Supabase Dashboard → Project Settings → API Keys → `anon` public |

Both values are public/browser-safe; access is governed by Row Level Security.
The Supabase `service_role` key is a secret and must **never** be placed in any
`NEXT_PUBLIC_*` variable or referenced from client-accessible code.

### Configuring when the Supabase project is created

1. Create a project at https://supabase.com.
2. Copy the **Project URL** and **anon public** API key.
3. Add them to `.env.local` (local) and to the Vercel project's Environment
   Variables (Preview + Production).
4. Restart `npm run dev` (or redeploy) so the values are picked up.

## Project structure

```
app/
  (auth)/login/       # Public login route
  (app)/              # Protected workspace (shell layout + module pages)
  auth/actions.ts     # Server actions: signIn / signOut
components/
  auth/               # Login form
  brand/              # Placeholder wordmark (pending Brand Book)
  providers/          # Theme provider + toggle
  shell/              # Sidebar, top nav, user menu, placeholders
  ui/                 # shadcn/ui primitives
integrations/supabase/# Browser, server and proxy Supabase clients
lib/                  # env access, navigation model, utils
proxy.ts              # Next.js 16 Proxy (session refresh + route protection)
```

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — lint