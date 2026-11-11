# Launch Recovery — the incident left a migration unapplied

Found 2026-09-28 while verifying mandatory regression B (date-hold consumption at
Booked) through the UI. This is the clearest example so far of why the journey
gate exists: every test in the repo passed, the code was deployed, and the
behaviour was still wrong in Sandbox.

## What happened

`supabase/migrations/20261408300000_book_relationship_consumes_date_holds.sql`
was never applied to the Sandbox database.

Migrations do **not** ship with the application deploy. They are applied by the
separate, deliberately human-gated `apply-sandbox-migration.yml` workflow. Two
runs of that workflow were attempted during the incident and both failed at
preflight:

```
2026-09-28T05:42:58Z  psql: error: connection to server at
  "aws-0-us-east-1.pooler.supabase.com" (44.216.29.125), port 5432 failed:
  FATAL:  Failed to connect to database: {:error, :timeout}
2026-09-28T05:44:06Z  (same, different pooler IP)
```

Both are inside the incident window (onset ~05:30 UTC, database reboot 08:06 UTC).
The workflow behaved correctly — it is atomic, so "Nothing in this batch was
applied." But nothing retried it afterwards, and nothing surfaced that the batch
was still outstanding.

Last successfully applied version was `20261408200000` (05:09:40 UTC). Exactly one
migration in the repository sorted above it, and it was the one regression B
depends on.

## Why nothing caught it

- The repo's own guard, `lib/availability/date-hold-booked-boundary.test.ts`,
  asserts the **contents of the .sql file**, not the state of the database. It
  passed the whole time.
- The deploy pipeline's database verification step is skipped:
  `SANDBOX_DB_URL is not set - skipping full database verification
  (migrations/extensions/reference data/RLS/buckets).`
  Had it been set, the deploy would have reported the drift on every run since.

## Evidence it was the cause

Two relationships booked through the identical UI path, on either side of
applying the migration:

| Lead | Booked | Hold status afterwards |
| --- | --- | --- |
| Taylor Morgan, 2027-06-19 | before the apply | `active` — never consumed |
| Robin Avery, 2027-09-11 | after the apply | `converted` — consumed correctly |

The SQL was correct all along. It simply was not in the database.

Applied via run 36464744723; regression B verified GREEN afterwards through the
real UI, with the status change confirmed in `date_holds`.

## Follow-ups

1. **Set `SANDBOX_DB_URL`** on the sandbox Environment so every deploy verifies
   applied migrations instead of skipping the check. This single setting would
   have caught this on the very next deploy. Treat as launch-readiness.
2. **Leftover data**: the Taylor Morgan hold (`09b0ec92…`, 2027-06-19) is still
   `active` on an already-Booked relationship. The migration's "already Booked"
   branch consumes leftover holds the next time `book_relationship` runs for that
   relationship, so this self-heals on the next booking write; it is recorded here
   rather than hand-edited.
3. A failed migration-apply run should be surfaced rather than left silent.
