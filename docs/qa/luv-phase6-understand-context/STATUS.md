# Luv Phase 6 — Understand Context

**Status: NOT GREEN — Sandbox deploy in progress**  
**Production:** untouched  
**Commit:** `f900f0b184e270f50364b05f91568531aa6a9944`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/36664882004 (queued)

---

## Locked product decisions (implemented)

| Decision | Choice |
|---|---|
| Pattern types | No new types — enrich P-A1, P-P1, P-A4 |
| Context engine | None — pure helpers beside Phase 5 |
| L1 | Unchanged — Phase 5 patterns remain L2-only |
| S1–S4 | Unchanged |
| Phase 5 floors | Unchanged |
| Booking clock | `leads.first_booked_at` only |
| Acquisition | Frozen `leads.acquisition_source` only (never `leads.source`) |
| Clause count | 0–2; omit when independent floor fails |
| P-P1 clause priority when all pass | sustained → tours → bookings (cap 2) |

---

## Evidence floors (Phase 6)

| Clause | Floor |
|---|---|
| P-A1 age | ≥2 qualifying cluster leads older than **7 days** (substantially older than S3’s 48h) |
| P-A1 source | Known `acquisition_source` group is a **strict majority** (>50%) of cluster and count ≥2 |
| P-P1 sustained | Prior 14d vs prior-prior 14d independently clears +2 abs and +25% with prior≥2 |
| P-P1 tours also up | Same relative floors on `tour_appointments.scheduled_at`; prior≥2 |
| P-P1 bookings also up | Same relative floors on `first_booked_at`; prior≥2 |
| P-A4 nearest | Valid YYYY-MM-DD event date among qualifying cluster; days ≥ 0 |

---

## Copy examples (factual only)

- `2 of these inquiries are more than 7 days old.`
- `Most came from your website.`
- `This rise follows an increase in the previous 14-day window as well.`
- `In the same period, tours were also up.`
- `Bookings were also up.`
- `The nearest event is 6 days away.`

---

## Implementation

| File | Role |
|---|---|
| `lib/luv/spot-pattern-context.ts` | Pure context builders + enrich helper |
| `lib/luv/spot-pattern-context.test.ts` | Phase 6 regression suite (cases 1–28) |
| `lib/luv/spot-patterns.ts` | Wire enrichment after Phase 5 qualification; sync loads `acquisition_source`, tours, `first_booked_at`, 42d inquiry history |

---

## Automated verification (pre-deploy)

- `lib/luv/spot-pattern-context.test.ts` — 25 pass
- `lib/luv/spot-patterns.test.ts` — Phase 5 suite pass (unchanged detection)
- Tour follow-up + related Luv suites — pass
- `tsc --noEmit` — clean

---

## Remaining for GREEN

1. Deploy `36664882004` success on SHA `f900f0b1…`
2. Exact image proof (sole RUNNING task, TD, tag, digest, health 200)
3. Fancy Venue browser: P-A1 / P-P1 / P-A4 context clauses, L2-only, S1–S4 unchanged, dismiss/reload, no GlobalError
