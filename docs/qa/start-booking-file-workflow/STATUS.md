# Start booking file workflow revamp

**Status:** CODE COMPLETE — tests green — **NOT runtime-GREEN** (no Sandbox deploy this pass)  
**Production:** untouched  
**Gina records:** read-only; not mutated

## Root cause (entry point)

After `startBookingFileAction`, `lead.linkedClientId` is set. Lead detail only showed **Start booking file** when `!previouslyConverted`, and **"Open booking file →"** had been intentionally removed (`lead-booked-terminology`). The pre-booking workspace at `/clients/{id}` remained valid; the lead CTA to resume it did not.

Gina Palo / Rich Dude: lead `26bd6fba-…` (`tour_scheduled`), client `132c1553-…` (`status=booking`). See `gina-readonly.json`, `AUDIT.md`.

## Changes

| Area | Change |
|---|---|
| Resume CTA | **Continue setup** → `/clients/{linkedClientId}` when linked client exists, not Booked, not Lost (`data-testid="continue-booking-setup-action"`) |
| Floor plans | Apply Template multi-select → one independent plan per template (same domain model) |
| Vendors | Multi-select assign in one submit; skip already assigned; no portal invite |
| Booked | Unchanged — still explicit Mark as Booked / `bookClient` |

**Files:** `components/leads/lead-detail.tsx`, `components/events/floor-plan-workspace.tsx`, `components/events/vendors/event-vendors-section.tsx`, `lib/booking-journey/start-booking-file-resume.test.ts`, `lib/leads/booking-lifecycle.test.ts`

## Tests

`npx tsx --test` focused suites: **54/54 pass**  
(`start-booking-file-resume`, `booking-lifecycle`, `booking-started-semantics`, `spine-remediation`, `lead-workspace-compaction`)

## Remaining / limitations

- No Sandbox deploy or browser proof this pass (per authorization: no deploy).
- Multi floor-plan apply uses sequential actions (not a new batch RPC); failure mid-loop keeps already-created plans and surfaces an error.
- Shared arrival/notes on multi-vendor assign apply to all selected; per-vendor edit remains after assign.
- Hybrid “setup progress” field not added — `linkedClientId` + client `status=booking` is the existing source of truth.

## Final status

**Implementation + unit/source tests: GREEN.**  
**Runtime/browser verification: NOT RUN** — do not call overall product GREEN until Continue setup is exercised on Sandbox for a lead like Gina.
