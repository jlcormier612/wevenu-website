# Build Restoration Report — Sprint 3A

**Date:** 2026-07-22
**Status:** Resolved. `tsc --noEmit` and `next build` both pass clean. No other Sprint 3 work proceeded until this was confirmed.

---

## Root cause

This repository is a monorepo-by-convention, not a real npm/TS workspace: four independent projects sit side by side in one directory tree — the main app (repo root), `marketing/`, `workspace/`, and `shared/` (a plain folder of support modules, not a package — no `package.json` at any level under it). Each of the three real apps (main, `marketing`, `workspace`) has its own standalone `tsconfig.json`; none of them use TypeScript's `extends`/`references` fields, so there is no actual inheritance chain to trace — they're three flat, independent configs.

**The main app's `tsconfig.json` is the only one with a defect.** Its `include` list has always contained repo-root-relative, unscoped globs:

```json
"include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts", ".next/dev/types/**/*.ts", "**/*.mts"]
```

Because these patterns carry no leading path, TypeScript resolves them relative to `tsconfig.json`'s own directory — the repo root — which is also where `marketing/`, `workspace/`, and `shared/` all live as sibling directories. Anything not explicitly listed in `exclude` is swept in. `git log` shows `"marketing"` was added to `exclude` on 2026-07-15 (commit `04d5b9e`), and `"workspace"` was added afterward (uncommitted, part of the same round of infra changes that added the `workspace/` app itself). **`"shared"` was never added.** That's the entire defect — one missing string in one array, not a deeper structural problem.

This was invisible for a while because `shared/`'s regular `.ts` files (e.g. `shared/relationships/ingest.ts`) being swept into the main app's type-check didn't happen to produce errors. It became a hard build failure once `shared/`'s `_smoke.mts` files — standalone smoke-test scripts (see below) — were added, because their `import "./index.ts"`-with-extension style is only valid under `allowImportingTsExtensions`, which the main app's `tsconfig.json` doesn't (and shouldn't) enable.

**Why `shared/` has no `tsconfig.json`/`package.json` of its own, and why that's correct:** it's meant to be imported via TypeScript `paths` aliases from whichever app consumes it, not as an installable package. `workspace/tsconfig.json` and `marketing/tsconfig.json` each map `@shared/relationships`, `@shared/email`, `@shared/product-sync` to relative paths (`../shared/relationships/index.ts`, etc.), and each app's `next.config.ts` sets `turbopack.root` to the repo root specifically so Turbopack can resolve an import reaching outside the app's own directory:

```ts
// workspace/next.config.ts and marketing/next.config.ts
turbopack: { root: path.join(__dirname, "..") },
```

`shared/relationships/README.md` confirms this is real, active, currently-used infrastructure — `marketing` writes relationship data, `workspace` reads it, both backed by on-disk JSONL under `shared/relationships/.data/` (or `RELATIONSHIPS_DATA_PATH`). The `_smoke.mts` files are that package's own test scripts, invoked directly via `tsx` (`npx tsx shared/relationships/_smoke.mts`), never imported by any app's production code. The main app has zero references to `shared/` anywhere in `app/`, `lib/`, or `components/` (confirmed by search) — it was never supposed to be part of this project's compilation unit at all.

**On `package.json` and `instrumentation.ts`, specifically, since they were named as possible causes:**
- `package.json`'s only change was adding a `"dev:workspace"` convenience script (`npm run dev --prefix workspace`) — this doesn't affect what TypeScript compiles anywhere. Not a factor.
- `instrumentation.ts` was defensively wrapped in a try/catch this session for an unrelated, legitimate reason: because `workspace`/`marketing` raise `turbopack.root` to the repo root, Next.js can end up loading the main app's root-level `instrumentation.ts` in the context of those other apps, where its `@/` alias doesn't resolve. That's the *reverse* direction of this bug (another app's build reaching into the main app's files) and has nothing to do with `shared/` being swept into the main app's own `tsc` run. Not a factor in this regression, but worth understanding as a related, correctly-defensive change.

**No TypeScript project references are in use anywhere in this repo** — there is no `references` field in any of the four `tsconfig.json` files, so "inheritance chain" in the formal TS-project-references sense doesn't apply here. The mechanism is purely glob-matching against `include`/`exclude`.

---

## Changes made

One line, in the main app's `tsconfig.json`:

```diff
-  "exclude": ["node_modules", "marketing", "workspace"]
+  "exclude": ["node_modules", "marketing", "workspace", "shared"]
```

This is not a suppression. It doesn't silence a real error in code that's supposed to be checked — it removes `shared/` from the main app's TypeScript project entirely, which is the intended, standard mechanism for multi-project boundaries in this repo (identical in kind to how `marketing` and `workspace` are already excluded). `shared/`'s own files continue to be type-checked, correctly, by whichever project actually owns them (`workspace/tsconfig.json`, via its `@shared/*` path mappings) — verified below, not assumed.

No other files were changed. `package.json`, `instrumentation.ts`, `workspace/next.config.ts`, `workspace/tsconfig.json`, and `shared/`'s own files were all left untouched — they weren't the cause and don't need to be.

---

## Verification

1. **`tsc --noEmit` (main app, repo root) — passes, zero output.** This is the first time this session it ran clean without needing to filter out `shared/`'s pre-existing noise (`grep -v "^shared/"`, used throughout every prior verification pass this session as a workaround) — that workaround is no longer necessary.
2. **`next build` — passes.** `✓ Compiled successfully`, `✓ Generating static pages using 7 workers (183/183)`, full route manifest printed including every route built this session (Tour Scheduling, Email Intake, Facebook, QR Capture). No "Failed to type check" error.
3. **`workspace` continues functioning** — verified two ways, not assumed:
   - The already-running `workspace` dev server (port 3002) still responds live (`curl localhost:3002` → HTTP 307, its normal unauthenticated-redirect behavior).
   - `cd workspace && npx tsc --noEmit` passes clean — confirming its own `@shared/relationships`/`@shared/email`/`@shared/product-sync` path-mapped imports still resolve correctly, unaffected by the main app's `tsconfig.json` change (they're independent config files).
4. **`shared` package continues functioning** — verified by actually running it, not inferring it from architecture. Per `shared/relationships/README.md`'s own documented smoke-test instructions:
   ```
   RELATIONSHIPS_DATA_PATH=./shared/relationships/.smoke-data npx tsx shared/relationships/_smoke.mts
   ```
   Ran in the isolated `.smoke-data` sandbox path the README specifies (never touching real relationship data). Result: **19/19 checks passed** (`PASS draft existed before purchase` through `PASS checklist idempotent`), ending `OK { id: 'rel_8d65f1340845', events: 9, subs: 1, checklist: 8 }`. The sandbox data this generated was deleted afterward — zero residue, same discipline as every other live verification this engagement.

All four of the requested checks pass. Sprint 3 feature work (already completed for Tour Scheduling, Email Intake, Facebook Lead Ads, and QR Capture prior to this regression being found) needed no changes as a result of this fix — none of that work touched `shared/`, `workspace/`, or `marketing/`.
