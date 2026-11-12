# Performance change manifest

**Do not merge/deploy without explicit approval.**

| Stream | Branch / PR | Head (verify) | Scope | Conflicts with #33? | Ready? |
| --- | --- | --- | --- | --- | --- |
| Hospitality + floor + reporting | PR #33 | `ee22f319` | Combined #30+#31+#32 | — | Sandbox accept pending |
| Wave B + C2 | PR #34 `perf/launch-remediation` | `6f5973e4` | loading shells + Dashboard streaming | No (based on #33 integrate) | KEEP after #33 |
| C1 deferral prototype | `perf/wave-c1-lead-deferral-prototype` | `10429dc4` | Defer docs/Luv only | No | **REVERT** as release (insufficient) |
| **C1 optimize** | `perf/wave-c1-lead-optimize` | (this branch) | Scoped journey contracts, parallel lead RSC, idle/hover prefetch, nav pending | No (isolated; do not land into #33/#34 without coordination) | **KEEP** pending review |
| Client C1 | design doc only | — | EventDetail pack design | N/A | Not authorized to implement |

## C1 optimize file touch list

- `lib/booking-journey/load.ts`
- `lib/contracts/service.ts` / `repository.ts` (`getContractsForClient`)
- `lib/leads/service.ts` (`cache(getLead)`)
- `app/(app)/leads/[id]/page.tsx`
- `components/leads/lead-detail.tsx`
- `components/shell/navigation-pending.tsx` (+ sidebar/shell/css)
- Docs under `docs/qa/launch-performance/`

Excluded: Stripe, Production, Sandbox reseed, migrations, hospitality PNG baseline overwrites, Client/EventDetail rewrite.
