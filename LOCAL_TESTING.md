# Local testing — stable sessions & credentials

Local-only. Do **not** use these passwords outside your machine.

## Apps

| App | URL | Auth |
| --- | --- | --- |
| Venue / vendor / client product | http://localhost:3000 | Supabase Auth |
| Marketing site | http://localhost:3001 | Public (no login) |
| CRM (Relationship Workspace) | http://localhost:3002 | `ws_session` cookie (JSONL store) |

Start all three detached (survives Cursor agent terminal teardown):

```bash
npm run dev:all:detach
```

Or individually:

```bash
npm run dev              # :3000
npm run dev:marketing    # :3001
npm run dev:workspace:detach  # :3002
```

Keep Supabase local Auth running (`supabase start`). After changing `supabase/config.toml` auth timings, restart Auth so they apply:

```bash
npx supabase stop && npx supabase start
```

## Stable credentials

### Venue (Sweet Daisy / seed owner) — http://localhost:3000/login

| Role | Email | Password |
| --- | --- | --- |
| Owner | `owner@example.com` | `devpassword123` |
| Manager | `manager@example.com` | `devpassword123` |

Long-lived demo venue data (e.g. **Sweet Daisy Barn & Farm**) usually lives under the owner account once created in your local DB. Fresh `supabase db reset` recreates the seed venue as **Seed Venue** with the same owner login.

### Client (couple) — http://localhost:3000/client/login

| Role | Email | Password |
| --- | --- | --- |
| Couple | `emma.carter@example.com` | `devpassword123` |

Portal token (no password): `/p/seedcoupleportal00000000000000000000000000000001`

### Vendor — http://localhost:3000/login

| Role | Email | Password |
| --- | --- | --- |
| Test vendor (Golden Hour) | `test-vendor@wevenu.local` | `devpassword123` |

Vendor and venue share the same Supabase cookie jar on `:3000` — only one account can be signed in per browser profile at a time.

### CRM — http://localhost:3002/login

| Role | Email | Password |
| --- | --- | --- |
| Jennifer (demo owner) | `jennifer@hellotocheers.com` | `cheers-demo` |

CRM demo CS relationship: **Sweet Daisy Barn & Farm** via  
`npx tsx workspace/scripts/seed-demo-customer.mts`

### Marketing — http://localhost:3001

No credentials. If the page “bumps” you, the next dev process died or Turbopack restarted — re-run `npm run dev:all:detach` (or `dev:marketing`).

### Platypus / other custom venues

Not in the SQL seed. If you created **Platypus** (or similar) through onboarding, use that account’s email with whatever password you set. Prefer resetting via Admin API / studio rather than wiping the DB.

## Keep sessions stuck

1. **Always use `http://localhost:…`**, not `127.0.0.1` (cookies do not transfer between those hosts).
2. **One role per browser profile** (Chrome/Safari profiles or different browsers). Venue owner, vendor, couple, and CRM can all sit side-by-side without stomping each other.
3. Local JWT lifetime is 7 days (`supabase/config.toml`); CRM `ws_session` is 30 days and stored on disk under `workspace/.data/` so HMR does not wipe the session store.
4. Do **not** run `supabase db reset` unless you accept re-seeding and losing custom demos.
5. Welcome/legal redirects are **not** logouts — if you land on `/welcome`, accept legal docs; cookies should still be intact.
6. Marketing on `:3001` and CRM on `:3002` do not use Supabase login cookies; they will not sign you out of `:3000`.

## If you still get bounced to login

1. Confirm all three ports answer: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/login` (and `:3001/`, `:3002/login`).
2. Confirm Auth: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:54321/auth/v1/health` → `200`.
3. Soft reload (⌘R) after navigating a few pages — session cookies should persist.
4. Hard refresh / cleared site data / mixing localhost↔127.0.0.1 will force a fresh login.
