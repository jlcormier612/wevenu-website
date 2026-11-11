# Restore Luv in Booked Client Workspace + Two-Row Tab Navigation

**Status: GREEN**  
**Sandbox only. Production untouched.**

## Product / deploy

| Item | Value |
| --- | --- |
| Product commits | `ce13de88` (Luv tab + two-row nav), `f3cd4187` (Lead typing fix), `2262f82c` (narrow nowrap) |
| Serving SHA | `2262f82cb7a572a09475c6152116c47ed4a070a8` (`dpl=` match) |
| Deploy run | [39803683833](https://github.com/jlcormier612/wevenu-website/actions/runs/39803683833) — **success** |
| Prior failed deploy | [39800326261](https://github.com/jlcormier612/wevenu-website/actions/runs/39800326261) — TS `linkedClientId` on `Lead` (fixed in `f3cd4187`) |

## Root cause (before)

1. **Luv disappeared after booking** because the booked workspace (`EventDetail`) never mounted a Luv tab; only Overview L3 “Luv noticed” (hard-vanishes when quiet). Lead kept `LuvDraftPanel`. Dead `LuvClientPanel` had been retired intentionally — but product now requires a first-class booked Luv tab.
2. **Tab wrapping** used `TabsList className="flex-wrap"` — accidental second/third lines, not a deliberate two-row layout.

## Intended change (smallest)

- Load originating lead + drafts + follow-up presentation on `/clients/[id]`.
- Add booked **Luv** tab reusing `LuvDraftPanel` (same review-first drafting; revalidate `/clients/…` after draft mutations).
- Replace wrap with **two `grid-cols-7` rows** in the exact order (Luv last on row 2). Overview L3 remains; empty secondary summary still hard-vanishes.
- Narrow: `whitespace-nowrap` + horizontal scroll per row (`min-w-[40rem]`).

## Tests

```text
npx tsx --test \
  lib/clients/booked-workspace-tabs-luv.test.ts \
  lib/clients/booking-workspace-luv-scope.test.ts \
  lib/luv/draft-send-lifecycle.test.ts \
  lib/luv/draft-context-boundary.test.ts
→ 50 pass / 0 fail (pre-deploy suite including lifecycle/boundary)
```

Focused nav+Luv after type fix: **13 pass / 0 fail**.

## Browser acceptance (Sandbox)

Script: `scripts/qa/luv-booked-tab-nav-acceptance.mts`  
Evidence JSON: `luv-booked-tab-nav-acceptance.json`

| Check | Result |
| --- | --- |
| Quiet booked client — Luv tab + draft CTA + empty hint | Pass |
| Eligible booked — Overview Luv noticed + Luv tab draft; draft generated pending_review; **no send** | Pass |
| Row order 7+7, Luv last | Pass |
| Desktop even spacing / same-row tops | Pass (`row1Aligned`/`row2Aligned`) |
| 900px viewport — two rows aligned, no third row | Pass after `2262f82c` |
| Lead Luv tab intact | Pass |

Screenshots: `luv-booked-quiet-luv-tab-1280.png`, `luv-booked-eligible-luv-tab-1280.png`, `luv-booked-nav-900.png`, `luv-lead-tab-intact-1280.png`.

## Privacy / side effects

- Draft prompt still excludes venue-originated inquiry notes (`customerFacingInquiry*` / “Never invent… venue-internal notes”).
- Draft created as `pending_review` only; Conversation send not invoked.
- No questionnaire send, portal invite/release, or invoice/payment side effects from this task.
- Unrelated dirty tree preserved; Production not deployed.

## Remaining limitations

- Post-event **Feedback** remains a conditional third strip when `eventDate` is past (not in the fixed 14); future booked acceptance fixtures are unaffected.
- Booked drafting still keys off the **originating lead** identity (correct relationship continuity); bookings without `clients.lead_id` show the Luv tab but block drafting with an honest empty message.
