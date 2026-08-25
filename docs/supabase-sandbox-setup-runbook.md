# HTC Sandbox Supabase — setup and validation runbook

**Type:** Runbook only. Nothing in this document has been executed. No Supabase project was created, no database was touched, no code was changed, nothing was deployed while producing it.
**Date:** 2026-08-14
**Confirmed architecture this runbook assumes, not re-evaluates:** CloudFormation (IaC) + ECS/Fargate (compute) + ALB (entry point) + GitHub Actions/OIDC (deploy mechanism) + Supabase-hosted Postgres (database) + Supabase Auth (identity) + Supabase Storage (files) + Resend (email) + Stripe (SaaS billing). No RDS, no raw Postgres connection, no custom auth — none of that is proposed anywhere below.
**Builds on:** `docs/supabase-sandbox-readiness-audit.md` (the inspection this runbook turns into steps).

Every count and schema detail below was pulled live from this repo's own local Supabase instance moments before writing this — not estimated — specifically so the verification steps have real numbers to check against, not guesses.

---

## 1. Creating the new Sandbox Supabase project

1. Sign in to [supabase.com](https://supabase.com/dashboard) with your own account.
2. **New Project** → select (or create) the organization this should live under.
3. **Name:** a clear, consistent label — recommend `hello-to-cheers-sandbox` (or `htc-sandbox`, matching the AWS resource-naming convention already in use). This is just a Dashboard label; it doesn't drive the project's actual URL (that's an auto-generated project ref, e.g. `abcdefghijklmnop.supabase.co`).
4. **Database password:** let Supabase generate a strong one, or set your own directly in the Dashboard — **do not tell me what it is**. Save it in your password manager now; you'll need it once, to run the migration-apply commands in §4.
5. **Region:** see the explicit call-out below — this genuinely cannot be finalized yet.
6. Wait for provisioning to finish (a few minutes).

**Region — cannot be fully determined yet, stated plainly rather than invented:** I searched this repo for any AWS region value already decided (`us-east-1`, `AWS_REGION=...`, anything beyond the `${AWS::Region}` CloudFormation pseudo-parameter) and found none — the AWS region hasn't been fixed anywhere yet, because AWS hasn't been bootstrapped. Supabase project region ideally matches wherever ECS ends up running, to minimize latency between ECS tasks and Supabase's HTTP API. Since that isn't decided:
- If you already have a region preference for AWS in mind, pick the nearest matching Supabase region now.
- If not, `us-east-1` (N. Virginia) is a reasonable default for both — it's Supabase's and AWS's most common/cheapest region, and nothing in the repo argues for a different one.
- Either way, this is a judgment call for you, not something this audit resolves.

**Postgres version:** confirm the created project is on **major version 17** (matches `supabase/config.toml`'s `db.major_version = 17`, which must match the real database's version for local tooling to keep working correctly against it later). Check under **Project Settings → Infrastructure** after creation.

**Plan (Free vs. Pro):** nothing in the app requires a Pro-only feature (Storage image transformation and Analytics Buckets are Pro-only per `config.toml`'s own comments, and neither is used anywhere in the codebase). The one practical thing worth knowing: Supabase's Free tier auto-pauses inactive projects — disruptive if ECS tasks expect the database to always be reachable during ongoing Sandbox testing. Your call, not dictated by anything in the repo.

---

## 2. Project credentials you will eventually need — names only

Found on **Project Settings → API** (URL/anon/service_role) and **Project Settings → Database** (DB password), after the project exists. Never paste any of these into this chat — just note where each one goes:

| Credential | Where it's used |
|---|---|
| Project URL (`https://<ref>.supabase.co`) | Becomes `NEXT_PUBLIC_SUPABASE_URL` |
| `anon` / `public` key | Becomes `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `service_role` key | Becomes `SUPABASE_SERVICE_ROLE_KEY` — **secret**, goes only into AWS Secrets Manager (§13), never GitHub |
| Database password (set in §1) | Used once, by you, to run the migration-apply commands in §4 — never stored in the app itself |
| Project ref (the `<ref>` in the URL) | Only needed if you ever use the Supabase CLI against this project directly |

---

## 3. Applying the 442 migrations — exact method

**Not `supabase db push`.** I looked for evidence in the repo that would justify recommending it despite the 4 known timestamp collisions and found none — no migration content proves the CLI's remote push path handles duplicate-prefixed migrations identically to the proven-safe local reset path, and every prior deployment note in this repo (`docs/postgres-account-bridge-deployment-checklist.md` and earlier) has deliberately used direct SQL instead, for this exact reason. Preserving that convention here, not reversing it.

**Method: direct SQL via `psql`**, applying every file in `supabase/migrations/` in plain sorted filename order — the same order `supabase db reset --local` already uses successfully every time it replays this repo's full migration history from empty. That's real, standing proof this order works; nothing more needs inventing for the 4 collision groups specifically — plain alphabetical sort already produces the correct order for all of them:

| Collision timestamp | Order that plain `sort` already gives you |
|---|---|
| `20261175000000` | `venue_account_access_lock.sql`, then `wedding_website_coastal_art_direction_pass2.sql` |
| `20261176000000` | `studio_canonical_color_story_clear.sql`, then `task_reminders_service_role_grant.sql`, then `vendor_availability_event_source.sql` |
| `20261177000000` | `lifecycle_engine_service_role_grants.sql`, then `vendor_documents.sql` |
| `20261222000000` | `document_workspace.sql`, then `legal_documents_vsa_sentence_case_disclaimers.sql` |

**You don't need to do anything special for these** — as long as you apply files in the order `ls supabase/migrations/*.sql | sort` produces (which the loop below does automatically), the collisions resolve themselves the same proven way they do locally.

**Exact commands** (run these yourself, from the repo root, in your own terminal — I'm not running any of this):

**Connection type — confirmed against the real project, not assumed:** Supabase's Direct connection resolves to an IPv6-only address unless the IPv4 add-on is enabled. Rather than depend on your network's IPv6 support, use the **Session Pooler** instead — it runs over IPv4 by design and, unlike the Transaction Pooler, preserves the session-level semantics this migration set needs (e.g. `do $$ ... $$` blocks). Confirmed connection details for this project: host `aws-0-us-east-1.pooler.supabase.com`, port `5432`, user `postgres.wvpsldwwjqdannqasrdf`.

```bash
cd "/Users/jensmac/Library/Mobile Documents/com~apple~CloudDocs/Wevenu Website/wevenu-website"

# Enter the Sandbox DB password when prompted — never put it in this file or in chat.
read -s -p "Sandbox DB password: " PGPASSWORD
export PGPASSWORD
# No password embedded in the URL itself — psql reads it from PGPASSWORD, which keeps
# it out of `ps` output while the command runs.
CONN="postgresql://postgres.wvpsldwwjqdannqasrdf@aws-0-us-east-1.pooler.supabase.com:5432/postgres"

for f in $(ls supabase/migrations/*.sql | sort); do
  echo "Applying $(basename "$f")..."
  psql "$CONN" -v ON_ERROR_STOP=1 -f "$f"
  if [ $? -ne 0 ]; then
    echo "STOPPED at $(basename "$f") — fix the error before continuing, do not skip ahead."
    break
  fi
  version=$(basename "$f" | sed -E 's/^([0-9]+)_.*/\1/')
  name=$(basename "$f" | sed -E 's/^[0-9]+_(.*)\.sql$/\1/')
  psql "$CONN" -v ON_ERROR_STOP=1 -c \
    "insert into supabase_migrations.schema_migrations (version, name) values ('$version', '$name') on conflict (version) do nothing;"
done
unset PGPASSWORD
echo "Done. Applied $(ls supabase/migrations/*.sql | wc -l | tr -d ' ') migration files if no STOPPED line appeared above."
```

If `psql` isn't installed, install it (Postgres.app, or `brew install libpq` and add it to your PATH) rather than substituting a different apply method — the Dashboard's SQL Editor can run individual files too, but 442 one-at-a-time pastes isn't practical, and this loop is still "direct SQL," not `db push`.

**Worth knowing before you start, found while preparing this runbook, not previously on record:** this repo's own local dev database — which has successfully replayed all 442 files via `db reset --local` — currently shows only **363** rows in `supabase_migrations.schema_migrations`, not 442. That gap is pre-existing (this project's own account-provisioning-bridge checklist already flagged that bookkeeping into this table has been applied inconsistently over time) and it doesn't mean 79 migrations were skipped — the newest tracked version matches the newest file exactly, and the gaps are scattered through the history, not clustered at the end, consistent with "sometimes forgotten to record it" rather than "never applied." **Practical implication for you:** don't treat `select count(*) from supabase_migrations.schema_migrations` as the primary proof that all 442 applied correctly on the new project — the loop above records every one as it applies (closing this exact gap going forward), but the object-level checks in §5 are the real signal.

---

## 4. Verifying the migrations completed successfully

1. **The loop finished without stopping early.** If it stopped, the error message names the exact failing file — fix that specific issue before re-running (the loop is safe to re-run from the top; nearly every migration is written idempotently with `if not exists` / `on conflict do nothing`, so already-applied statements no-op rather than erroring twice — but confirm that's true for whichever file actually failed before assuming a blind re-run is safe).
2. **Row count sanity check** (not the primary signal, per the note above, but a quick smell test):
   ```sql
   select count(*) from supabase_migrations.schema_migrations;
   ```
   Using the loop in §3, this should end at **442** on a freshly-bootstrapped Sandbox project (unlike local dev's own inconsistent 363, because the loop above records every file as it goes).
3. **Table count sanity check**, compare against local dev's own count as a rough completeness signal:
   ```sql
   select count(*) from information_schema.tables where table_schema = 'public';
   ```

---

## 5. Verifying specific required pieces

Every query below, run on the new Sandbox project, with the real number from this repo's own local dev instance to compare against (pulled live while writing this runbook):

**`pg_trgm` and `pgcrypto`:**
```sql
select extname from pg_extension where extname in ('pg_trgm', 'pgcrypto') order by extname;
```
Expect both rows present. `pg_trgm` is explicitly created by `20260710100000_sprint86_global_search.sql`; `pgcrypto` rides on Supabase's own new-project default (never explicitly created by any migration) — its presence here is the confirmation that assumption held.

**`gen_random_uuid()` actually works:**
```sql
select gen_random_uuid();
```
Should just return a UUID with no error — a functional proof `pgcrypto` is really active, not just installed.

**RLS policies:**
```sql
select count(*) from pg_policies where schemaname = 'public';
```
Local dev: **360**. Expect the same (or very close — depends on exactly which migration set you're on) on Sandbox.

**Postgres functions:**
```sql
select count(*) from information_schema.routines where routine_schema = 'public' and routine_type = 'FUNCTION';
```
Local dev: **397**.

**All storage buckets** — correcting one thing from the prior audit while verifying it: that audit found 10 buckets via a text search that missed one (`couple-messages`, created by `20260702960000_sprint955_message_polish.sql`, using an insert statement the earlier grep pattern didn't catch). The real, complete count is **11**:
```sql
select id, public from storage.buckets order by id;
```
Expect exactly these 11, with these public/private flags:

| Bucket | Public? |
|---|---|
| `client-media` | public |
| `contract-representations` | **private** |
| `couple-messages` | public |
| `documents` | public |
| `event-order-representations` | **private** |
| `feedback-screenshots` | public |
| `floor-plans` | public |
| `inventory` | public |
| `request-uploads` | public |
| `uploads` | public |
| `vendors` | public |

**Seeded `lead_sources`:**
```sql
select count(*) from public.lead_sources;
```
Local dev: **14**.

**Seeded website design catalog — corrected 2026-08-14 after a live Sandbox run exposed that the original local-dev-sourced baselines below were wrong for 2 of the 4 tables.** Local dev's live database has non-migration drift (its running container reflects whatever ad-hoc testing has happened since its last reset, not a clean replay) — recomputing the correct counts directly from every migration's actual `insert`/`on conflict` statements (not trusting either database's live state) gives:
```sql
select count(*) from public.collections;         -- correct: 11 (8 from 20261009000000 + 3 from 20261167000000)
select count(*) from public.color_stories;        -- correct: 27 (8×3=24 from 20261009000000 + 3 from 20261167000000)
select count(*) from public.typography_styles;     -- correct: 10 (4 + 4 + 2, confirmed consistent across local/Sandbox)
select count(*) from public.photo_styles;          -- correct: 10 (7 + 2 + 1, confirmed consistent across local/Sandbox)
```
The original baselines here (10 collections, 38 color_stories) were sourced from local dev's live state without cross-checking the migration source and were simply wrong — Sandbox's actual counts (11, 27) are the correct ones.

**Seeded `legal_documents`** (content will be placeholder — that's expected and doesn't block a technical Sandbox E2E per your own framing; this check confirms the *rows* exist, not the copy):
```sql
select document_type, count(*) from public.legal_documents where is_active = true group by document_type order by document_type;
```
Local dev: exactly one active row each for `acceptable_use_policy`, `cookie_policy`, `couple_end_user_terms`, `privacy_policy`, `terms_of_service`, `vendor_end_user_terms`, `venue_terms_of_service` — 7 document types total.

---

## 6. Configuring hosted Supabase Auth for Sandbox

**Dashboard → Authentication → URL Configuration.**

**Site URL and Redirect URLs — what to set now vs. what must wait:**

This is the one place a naive answer would invent a URL that doesn't exist yet, so being explicit: AWS hasn't been bootstrapped, there's no live ALB, no DNS decision has been finalized (still an open item from the original deployment plan), and no ACM certificate exists. The CloudFormation template's `VenueAppHostname`/`MarketingHostname`/`WorkspaceHostname` parameters (`app.sandbox.hellotocheers.com` etc.) are **intended future values baked into the template as defaults**, not live, resolvable domains today.

**Set for now**, so you can validate everything in §9–11 using a locally-running instance of the app pointed at the real Sandbox database — entirely decoupled from whether AWS exists yet:
- **Site URL:** `http://localhost:3000`
- **Redirect URLs:** `http://localhost:3000`, `http://localhost:3000/**` (matching the exact pattern `config.toml` already uses for local dev, just pointed at a real project instead of the local one)

**Must wait until AWS is actually deployed** — come back and update these once the ALB exists, DNS points at it, and a real cert is issued:
- The real `https://app.sandbox.hellotocheers.com` (and the marketing/workspace equivalents, wherever couple/vendor-facing redirects apply) as the production-facing Site URL/Redirect URLs.

Don't set the real hostnames now — they'd point Auth at domains that don't resolve yet, and doing this step twice (once now, correctly, for local validation; once later, correctly, for the real deployment) is cleaner than guessing today and being wrong.

**Other Auth settings worth a deliberate decision, not inherited from `config.toml`** (which is local-CLI-only and does not transfer to a hosted project by any mechanism — no `config.toml` setting here is applied to the hosted project automatically):
- `enable_confirmations` — local dev has this off; decide deliberately for Sandbox.
- Session/JWT expiry — local dev intentionally uses a 1-week `jwt_expiry` and a 720h session timebox, both explicitly commented as dev-only conveniences. Pick real values for Sandbox rather than copying those.

---

## 7. Creating the initial Sandbox Auth owner

**No self-service signup path exists anywhere in the app** — confirmed by grep: zero `supabase.auth.signUp()` calls, no `/signup` or `/register` route anywhere in `app/`. Account creation is exclusively admin-API-driven (matches the established architecture). So:

1. **Dashboard → Authentication → Users → Add user.**
2. Enter a real email address you control and a real password **directly into the Dashboard form — never into this chat.**
3. Confirm the user is created and note their **User UID** (shown in the Users list) — you'll need it for §8.

Do **not** hand-insert a row into `auth.users` via SQL on this hosted project. `supabase/seed.sql` does that locally, but only because it's a tightly-controlled, dev-only script mirroring Supabase's own password-hashing exactly — doing the same against a real hosted project bypasses Auth's own consistency mechanisms in ways that aren't supported. The Dashboard's "Add user" form is the correct, supported equivalent.

---

## 8. Inserting that user into `public.hq_admins`

Verified directly against this repo's schema, not assumed — `hq_admins` has `id` (auto), `user_id` (required), `role` (defaults `'team'`), `is_active` (defaults `true`), `created_at` (auto). Via the Dashboard's SQL Editor:

```sql
insert into public.hq_admins (user_id, role) values ('<the User UID from §7>', 'owner');
```

This exact command already exists as a comment inside `supabase/migrations/20260710020000_sprint108_5_hq_admins.sql` — the migration's own author anticipated this being a manual step; nothing here is invented.

---

## 9. Verifying the owner can log in through the existing HTC login path

This can be done **before AWS exists at all**, using a local instance of the venue app pointed at the real Sandbox project:

1. Temporarily point your local `.env.local` at the Sandbox project's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (from §2) instead of the local Supabase stack. (Keep a copy of your original local values — you'll want to switch back afterward.)
2. Run the app locally (`npm run dev`), visit `http://localhost:3000/login`.
3. Sign in with the email/password created in §7.
4. Confirm a real session starts and the dashboard loads.
5. Visit `http://localhost:3000/admin` — confirm it's reachable (proving the `hq_admins` row from §8 actually grants access, through the app's real three-layer HQ gate: middleware, layout, and the `requireAdminUser()` service check — not just a database row existing in isolation).

---

## 10. Verifying the enrollment → activation → real account bridge against Sandbox

The previously-implemented Postgres account-provisioning bridge (`venue_enrollments` table, `activate_venue_enrollment()` function, the two internal `/api/internal/enrollment/*` routes) can be exercised directly, the same way it was verified locally before — by calling the internal endpoints directly with `curl`, entirely bypassing Stripe:

1. With the local app still pointed at Sandbox (from §9) and `PRODUCT_SYNC_API_KEY` set locally to match whatever you'll eventually put in Secrets Manager (§13) — pick any value for this local test run, it just needs to match between the request and the app's own env var.
2. `curl` the enrollment upsert endpoint with the `Authorization: Bearer <PRODUCT_SYNC_API_KEY>` header, simulating what marketing/workspace would send after a real Stripe checkout — check `app/api/internal/enrollment/upsert/route.ts` for the exact expected request body shape before constructing this call.
3. Query Sandbox directly: confirm a real `venue_enrollments` row now exists, `status = 'pending'`, with a real `activation_token`.
4. `curl` the activation endpoint the same way, using that token.
5. Query Sandbox directly: confirm a real `auth.users` row and a real `venues` row now exist, correctly linked, and `venue_enrollments.status = 'activated'`.
6. Log in at `http://localhost:3000/login` with the credentials just created — confirm a real session starts, proving the bridge produces a genuinely usable account, not just database rows.

---

## 11. Values you'll eventually need for AWS Secrets Manager / GitHub Environment variables

Recapping the already-established mapping (`docs/github-actions-deployment-implementation.md`) — names only, never values, and none of this happens until AWS is actually bootstrapped:

**AWS Secrets Manager** (`htc/sandbox/*`, populated by you directly, never through GitHub):
- `supabase-service-role-key` → the Sandbox project's `service_role` key
- `resend-api-key`, `product-sync-api-key`, `stripe-saas`, `stripe-connect` — unrelated to this runbook, unchanged

**GitHub Environment variables** (`sandbox`, non-secret):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the Sandbox project's URL and anon key (both browser-safe by design)
- `SUPABASE_URL` — the CloudFormation template's parameter for this exists, but no app code currently reads the resulting runtime env var (flagged in the readiness audit as a template accuracy note); set it to the same project URL anyway so the template deploys cleanly, without expecting it to do anything yet

---

# Jennifer's manual steps (Supabase Dashboard)

1. Create the project (§1) — name, region (your call, no fixed answer exists yet), confirm Postgres 17, choose Free/Pro.
2. Note the credentials (§2) in your password manager — Project URL, anon key, service_role key, DB password, project ref.
3. Run the migration-apply loop from §3 yourself, in your own terminal, entering the DB password when prompted.
4. Set Site URL / Redirect URLs to the `localhost:3000` values in §6 (not the real hostnames yet).
5. Create the first owner account via Dashboard → Authentication → Add user (§7); note their User UID.
6. Run the `insert into public.hq_admins` command from §8 in the SQL Editor, using that UID.
7. Tell me once all of the above is done — I'll pick up from §4/§5/§9/§10 to validate.

# Claude validation steps (after the project exists and Jennifer confirms the above is done)

1. Run the migration-completeness checks in §4.
2. Run every verification query in §5 (extensions, RLS count, function count, all 11 buckets, `lead_sources`, design-catalog tables, `legal_documents`) and compare against the local-dev baselines already recorded above.
3. Temporarily point a local app instance at Sandbox and verify the owner login path (§9).
4. Exercise the enrollment → activation bridge against Sandbox via direct `curl` calls (§10) and confirm a real, usable account results.
5. Report back a clear pass/fail per item, using the same evidence-labeling discipline as the Event Order verification pass — live results only, nothing assumed.
6. Explicitly hold off on touching the real Site URL/Redirect URLs or anything AWS-dependent until you confirm AWS has actually been bootstrapped.

No code, migrations, or configuration were changed while producing this runbook. Nothing was deployed. This is the plan; §"Jennifer's manual steps" is where execution actually starts, and only when you're ready.
