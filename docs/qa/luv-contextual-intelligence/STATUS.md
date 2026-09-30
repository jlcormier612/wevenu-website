# Luv — Contextual intelligence (S1–S4)

**Status:** IMPLEMENTING — product LOCKED 2026-09-30  
**Production:** untouched  
**S5:** explicitly out of scope  

## Locked decisions

| Signal | Window / rule | Surface | Dashboard |
| --- | --- | --- | --- |
| **S1** Event + contract sent | event ≤21 days + contract `sent` | L3 contract/event | No |
| **S2** Event + payment attention | event ≤21 days + `computePaymentsReadiness` = `needs_attention` | L3 payment/event | No |
| **S3** Unattended inquiry | age ≥48h + `last_contacted_at` null + `new_inquiry` | L3 lead | No |
| **S4** Tour prep | upcoming tour + evidence gap only | L3 (upgrades `tour-upcoming-*`) | No |

## Implementation

- `lib/luv/contextual-signals.ts` — pure evaluators + supersession
- `lib/luv/observations.ts` — wire S1–S4; suppress legacy `contract-*` / `followup-*` when superseded
- `lib/dashboard-system/luv-entry.ts` — explicit L3 id prefixes for S1–S3 (S4 already gated via `tour-upcoming-*`)

## GREEN checklist

- [ ] S1–S4 automated tests
- [ ] Dashboard L1 regressions
- [ ] Typecheck / build
- [ ] Sandbox deploy + exact image
- [ ] Browser S1–S4 on that image
- [ ] Production untouched
- [ ] S5 not implemented

**Do not hand to Jennifer until GREEN.**
