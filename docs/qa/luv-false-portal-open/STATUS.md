# Luv false client-activation / portal-open card — Sandbox

## Verdict

**IN PROGRESS** — root cause fixed in code; unit tests GREEN; awaiting Deploy Sandbox + disposable-venue browser verify.

## Reproduction (reported)

New Sandbox venue, zero leads, zero clients, no invitation activity. Dashboard Luv showed:

> Your first couple hasn't opened their portal yet  
> You've sent the invite — once they open it…

Clients page correctly empty.

## Root cause

| Layer | Finding |
|---|---|
| Component | Luv setup-gap observation `setup-gap-first_portal_open` via `computeSetupGapObservations` ← Activation checklist |
| Copy | `GAP_COPY.first_portal_open` asserts “You've sent the invite” |
| Eligibility bug | SQL marks `first_portal_open` incomplete whenever `first_portal_open_at` is null (**15 pts**). No overlay required invitation evidence. |
| Why it ranked | Higher points than `first_portal_invite` (5). Invite overlay correctly left invite incomplete, but the open gap still ranked into Luv with false copy. |
| Stale stamp? | Not required — null `first_portal_open_at` alone was enough. |

## Fix

- `lib/activation/first-portal-open.ts` — `applyFirstPortalOpenToChecklist`: incomplete **only** when invite evidence exists and no booked client has `last_accessed_at`.
- `lib/activation/first-portal-open-service.ts` — session-based first-open completion + write-once stamp.
- `applyThreeCouplesPortalPrerequisite` — suppress later-stage `three_couples_active` until an invite exists.
- Wired in `enrichActivationScore` (`lib/activation/service.ts`).

## Lifecycle audit matrix

| Message / key | Eligibility source (before) | Required evidence | Result | Correction |
|---|---|---|---|---|
| `first_portal_open` — “You've sent the invite…” | `first_portal_open_at` null | Invite sent (pending\|accepted for booked client) **and** no portal open | **DEFECT** | Overlay + session loader |
| `first_portal_invite` — “Invite your first couple…” | Overlay on invitation rows (prior fix) | Booked client + pending\|accepted invite | OK | None |
| `three_couples_active` — “Get 3 couples started…” | Session open count overlay | Later-stage; needs invite journey started | **Premature** on empty venue | Suppress until invite sent |
| `first_contract_signed` | Stamp / contract evidence | Does not claim a send occurred | OK (aspirational) | None this pass |
| `first_payment_received` | Stamp | Does not claim a send occurred | OK | None |
| `first_package` / `profile_complete` | Venue data | Factual setup gaps | OK | None |
| Portal-open language elsewhere | Milestone toasts use open stamps | Separate from this Luv gap | Out of Luv gap scope | Not changed |

## Tests

`lib/activation/first-portal-open.test.ts` (+ existing invite/portal-open suites) — 43 pass including empty-venue, lead-only, client-only, failed invite, successful invite, open suppresses card.

## Deploy / verify

| Item | Value |
|---|---|
| Intended SHA | _(pending commit)_ |
| Deploy | _(pending)_ |
| Browser | `scripts/qa/luv-false-portal-open-browser.mts` |
| Production | Untouched |
