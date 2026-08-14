# Supabase Sandbox readiness — inspection-only audit

**Type:** Read-only. No Supabase project created, no database modified, no code changed, nothing deployed.
**Date:** 2026-08-14
**Scope:** Given the confirmed architecture (CloudFormation + ECS + Postgres, Option 1 — Supabase Auth retained), determine exactly what a brand-new, real Sandbox Supabase project needs in order for the current codebase to function, and separate what's fully proven by the repo from what's a manual setup step no migration or config file can do for you.

**Method:** Direct reading of `supabase/config.toml`, `supabase/seed.sql`, and prior deployment-checklist docs, plus a targeted grep sweep across all 442 files in `supabase/migrations/`.

---

## 1. Project configuration

**What the new project needs, concretely:**
- Postgres major version **17** (`supabase/config.toml`'s `db.major_version = 17` — must match on the hosted side).
- Data API exposes the `public` and `graphql_public` schemas (config default; nothing in the app code was found calling GraphQL specifically — this is Supabase's own default, not an app requirement).
- **Exactly 3 environment variables** connect the venue app to the project — confirmed by an exhaustive grep of `app/`, `lib/`, `integrations/` for every `process.env.*SUPABASE*` reference: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Nothing else — no `SUPABASE_JWT_SECRET`, no direct Postgres connection string, no `SUPABASE_DB_URL`. This matches the earlier finding that the app never opens a raw Postgres connection; everything goes through Supabase's HTTP client.

**Template inconsistency worth flagging while we're here:** `infra/htc-ecs-stack.json`'s `SupabaseUrl` parameter feeds a runtime `SUPABASE_URL` (non-public) environment variable into the venue app's task definition — but no app code anywhere reads `process.env.SUPABASE_URL` (only the `NEXT_PUBLIC_` build-time copy is ever read). That parameter is currently dead weight in the template, not a functional problem — flagging for accuracy, not proposing a fix per your no-changes instruction.

**What does NOT transfer automatically — this is the one architectural point worth being explicit about:** `supabase/config.toml` governs the **local CLI/Docker stack only**. There is no `supabase config push` equivalent for Auth/API project settings the way `db push`/direct SQL applies migrations — a hosted Supabase project's Auth settings live in the Dashboard (or the Management API), completely independent of this file. Several of `config.toml`'s current `[auth]` values are explicitly dev-only by their own comments and must not be assumed to carry over:
- `site_url = "http://localhost:3000"` and `additional_redirect_urls` pointing at localhost/127.0.0.1 — needs real Sandbox hostnames.
- `jwt_expiry = 604800` (1 week) — commented `"Local testing: use the max so sessions survive multi-hour QA."`
- `refresh_token_reuse_interval = 120` — commented `"widen reuse window so Turbopack HMR + multi-tab refresh races do not invalidate sessions."`
- `[auth.sessions] timebox = "720h"` — commented `"Keep generous so manual testing is not kicked mid-day."`
- `[auth.email] enable_confirmations = false` — fine for local dev, a real decision for Sandbox.

None of this is a code or migration concern — it's Dashboard configuration for the new project, and the repo doesn't prescribe what the real values should be (that's a product decision, not something proven or disproven by inspection).

---

## 2. Migrations / schema

**442 migration files** under `supabase/migrations/`, need to be applied in full for the schema to exist.

**Established, unchanged convention** (already on record from earlier in this engagement, re-confirmed still true today): apply via direct SQL — Dashboard SQL editor or `psql` — never `supabase db push`, because of **4 still-unresolved migration-timestamp collision groups**:

| Timestamp | Colliding files |
|---|---|
| `20261175000000` | `venue_account_access_lock.sql`, `wedding_website_coastal_art_direction_pass2.sql` |
| `20261176000000` | `studio_canonical_color_story_clear.sql`, `task_reminders_service_role_grant.sql`, `vendor_availability_event_source.sql` |
| `20261177000000` | `lifecycle_engine_service_role_grants.sql`, `vendor_documents.sql` |
| `20261222000000` | `document_workspace.sql`, `legal_documents_vsa_sentence_case_disclaimers.sql` |

Within each group, resolution order is a lexicographic tiebreak on the full filename — the same order `supabase db reset --local` already uses successfully every time it replays from empty. That's real, standing evidence this exact order is survivable, **provided whatever applies migrations to the new Sandbox project uses that same order** (i.e., don't hand-pick a different sequence). This audit didn't re-verify that no pair within a collision group has a hidden cross-dependency that happens to need the *other* order — the topics in each group look unrelated (e.g., an access-lock migration vs. a wedding-website art-direction migration), and the proven-clean local reset is the strongest available evidence this is fine, but that's inference from existing evidence, not a fresh line-by-line dependency check of all 9 colliding files.

---

## 3. Required extensions / functions

**Extensions — only one explicit `create extension` in all 442 migrations:**
- `pg_trgm` — `supabase/migrations/20260710100000_sprint86_global_search.sql:12`. Needed for the global-search feature.

**One extension the repo silently assumes rather than declares:** `gen_random_uuid()` is used 135+ times (nearly every table's primary key default) and requires `pgcrypto`. No migration ever runs `create extension pgcrypto` — it relies entirely on Supabase enabling it by default on new projects, which it does, but this is worth explicitly confirming on the real Sandbox project rather than assuming, since it's the one hard dependency the repo itself never asserts.

**Not used anywhere:** `pg_net` (no outbound HTTP calls from inside Postgres), `pg_cron` (see §6 below — the app's scheduled jobs are external HTTP triggers, not database jobs).

**Functions:** every `SECURITY DEFINER` function, trigger function, and RLS-supporting helper is created by the migrations themselves — no separate manual function-creation step beyond applying them in full. One specific thing worth a post-migration check: `supabase/migrations/20260819010000_client_identity_sessions.sql` has two functions (`get_my_auth_sessions()`, `revoke_my_auth_session()`) that directly read/delete rows in **`auth.sessions`** — not just the usual `auth.uid()` read. This is the one place in the entire migration set that touches an `auth.*` table beyond a normal FK reference to `auth.users`. Supabase's default migration-running role should already have the needed grants, but it's the one specific thing worth confirming live on the new project rather than assuming.

**No direct `auth.*` schema DDL anywhere** — no `create trigger ... on auth.users`, no `alter table auth.*`, no custom Auth Hooks wired up (confirmed both by the grep sweep and by `config.toml`'s hook sections all being commented out/unused).

---

## 4. Auth configuration

**The app never uses Supabase Auth's own transactional email system.** Confirmed by grep: zero uses of `resetPasswordForEmail`, `signInWithOtp`, or any magic-link API anywhere in `app/`/`lib/`. Login is exclusively `signInWithPassword`; account creation goes through `admin.createUser()`/`admin.updateUserById()`, both already established from earlier work. Practically: **there is currently no self-service "forgot password" flow in this app at all** — worth knowing as a related observation, not something this audit was asked to fix. One consequence for this specific question: custom SMTP for Supabase Auth is not a hard functional requirement, since the app never triggers Supabase's own email-sending path. All real outbound email (invitations, notifications, activation) goes through the app's own Resend integration, unrelated to Supabase Auth's built-in mailer.

**RLS:** ~360 policies (established earlier this engagement), all created by migrations — nothing manual needed here beyond applying them in full.

**HQ admin bootstrap — a genuine, required manual step.** `supabase/migrations/20260710020000_sprint108_5_hq_admins.sql` creates the `hq_admins` table empty; the only `insert into public.hq_admins` text anywhere is a **comment** in that same migration documenting the manual command:
```sql
-- insert into public.hq_admins (user_id, role)
--   values ('<your auth.users.id>', 'owner');
```
No self-service path exists anywhere in the app to become an HQ admin (confirmed by grepping every app-code reference to `hq_admins` — none of them insert a row). **A brand-new project has zero HQ admins after migration replay** — someone has to create a real `auth.users` account first (via normal signup, or the admin API), then manually run that insert. Without it, `/admin/*` is unreachable by anyone, including for the very first login.

---

## 5. Storage buckets

**All 10 buckets are fully captured by migrations**, each via an idempotent `insert into storage.buckets (...) on conflict (id) do nothing` — no manual Dashboard bucket-creation step required, as long as migrations are applied in full:

| Bucket | Public? | Migration |
|---|---|---|
| `floor-plans` | public | `20260626360000_floor_plans.sql` |
| `uploads` | public | `20260627020000_uploads_bucket.sql` |
| `documents` | public (deliberate — RLS-guarded instead, per the migration's own comment) | `20260627120000_documents.sql` |
| `client-media` | public, with file-size/MIME restrictions | `20260629270000_couple_profiles.sql` |
| `inventory` | public | `20260816000000_inventory_foundation.sql` |
| `request-uploads` | public | `20260823000000_request_experience_phase1.sql` |
| `vendors` | public | `20261154000000_vendor_logo_storage_bucket.sql` |
| `feedback-screenshots` | public | `20261229000000_feedback_screenshots_bucket.sql` |
| `contract-representations` | **private** | `20261244000000_contract_representations_storage.sql` |
| `event-order-representations` | **private** | `20261252000000_event_order_representation_and_sharing.sql` |

One caveat, stated honestly: this audit confirmed the bucket *rows* exist via migration, and confirmed (from source, not freshly re-verified line-by-line here) that access to the private buckets goes through signed URLs plus RLS policies on `storage.objects` — that RLS layer was already certified correct in earlier phases of this engagement (D4/D5C/D6). This pass didn't re-audit every bucket's `storage.objects` policy individually; it confirmed the buckets themselves are migration-complete, which was the specific question asked.

---

## 6. Required seed / reference data

Two very different things live under this heading — keeping them separate matters:

**NOT required, must NOT be run against Sandbox:** `supabase/seed.sql`. Entirely a local dev fixture — one fake venue, fake owner/manager/couple accounts with the hardcoded password `devpassword123`, a fake signed contract, fake guests, a fake invoice. Its own header says so directly: *"local dev only — never use these credentials anywhere real."* This file answers no part of "what does Sandbox need" — it's disposable convenience data for a laptop, not a system requirement.

**Required, and already handled automatically by applying migrations in full** (embedded directly in migration files, not `seed.sql`):
- `lead_sources` — a 13(+1)-row lookup table (`website`, `referral`, `the_knot`, `facebook_lead_ads`, etc.). `leads.source` has a foreign-key constraint against it — lead creation is broken without these rows.
- `legal_documents` — active Terms/Privacy rows for couple, venue, vendor, and the public site. The couple/vendor acceptance-gating flow reads these directly. **Important distinction:** the rows will exist automatically once migrations are applied — but the content is explicitly commented as placeholder copy ("Replace content before launch"). That's a real content task for you before real (non-test) use, separate from whether the migration itself is complete.
- The wedding-website design catalog — `collections`, `color_stories`, `typography_styles`, `photo_styles` — fully seeded via several migrations (8 collections, multiple color stories/typography pairings, 7 photo styles).
- A default (disabled) `automation_rules` row auto-created per venue via a trigger (`20261119000000_rc2_event_completed_review_nudge.sql`) — self-perpetuating as new venues are created, not a static table that needs re-seeding.

**Explicitly absent from the migration set** (confirmed by the sweep, not merely unchecked): no feature-flag-defaults table, no pricing/plan-tiers table, no generic `system_settings`/`config` table. `success_library_articles` (Help & Guides content) is also auto-seeded via migration but is educational content, not something the app breaks without.

**The one genuine gap between "migrations create this automatically" and "a human must do this by hand":** the HQ admin bootstrap row from §4 — deliberately left as a comment, not an insert, presumably because inserting a real `auth.users.id` can't be known ahead of time in a template migration.

---

## 7. Reconciliation against the current CloudFormation templates

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` are correctly wired as Docker **build-time** args in all three Dockerfiles — consistent with these being the only build-time Supabase values the app reads.
- `SUPABASE_SERVICE_ROLE_KEY` is correctly wired as a **runtime** Secrets Manager reference in `htc-ecs-stack.json` — consistent with it being a server-only, sensitive, runtime-read value.
- The template's `SupabaseUrl` parameter → `SUPABASE_URL` runtime env var is unused by any app code (§1) — a minor template accuracy note, not a functional blocker, not touched per your instruction.
- Nothing in the templates references RDS, a Postgres connection string, or any Supabase alternative — consistent with "Postgres = Supabase-hosted, HTTP-accessed" being the actual, unchanged decision (matches what I confirmed in the prior architecture-reconciliation answer).

---

## 8. What the repo proves vs. what remains a manual Supabase setup step

**Fully proven — achieved automatically by creating the project and applying all 442 migrations, in the established order, via direct SQL:**
- Complete schema: every table, RLS policy (~360), trigger, and `SECURITY DEFINER` function.
- The one required extension (`pg_trgm`) is explicitly created.
- All 10 storage buckets, correctly public/private.
- Required reference data: lead sources, wedding-website design catalog, default automation-rule trigger, legal-document rows (content placeholder, but rows exist).

**Manual steps no migration can perform — needed regardless of how cleanly migrations apply:**
1. Create the actual Supabase project (region, Postgres 17, plan).
2. Apply all 442 migrations via direct SQL, in the same order local `db reset --local` already proves works, given the 4 known timestamp-collision groups.
3. Confirm `pgcrypto` is enabled (implicit `gen_random_uuid()` dependency the repo never explicitly asserts — should be on by Supabase's own default, but not proven by the repo itself).
4. Configure real Auth Dashboard settings — Site URL, Redirect URLs, JWT/session expiry, email-confirmation policy — none of which transfer from `config.toml`, which is local-CLI-only.
5. Manually insert the first `hq_admins` row after creating a real `auth.users` account for whoever administers HQ — no self-service path exists, and without this step `/admin/*` is unreachable by anyone.
6. Replace the placeholder `legal_documents` content with real Terms/Privacy copy before any real (non-test) use.
7. Populate the 5 Secrets Manager placeholders with real values (already established from the AWS work, restated for completeness here): Supabase service-role key, Resend API key, `PRODUCT_SYNC_API_KEY`, Stripe SaaS + Connect keys.

Nothing above required creating a project, touching the database, changing code, or deploying anything — this is the inspection you asked for, not the execution of it.
