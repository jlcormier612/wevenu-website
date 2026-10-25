# Implementation decisions

## Decision: Seed Selected Package inclusions on EO start (not Package→Offering composition)

**Chosen:** When an Event Order is created or healed/replaced while **open and not yet shared**, copy missing `commercial_selections.included_items` onto the EO as **included custom** lines stamped with `package-selection:{selectionId}|{name}`.

**Why smallest complete fix:**
- Closes Stage 1–2 coherence without schema migration or Offering invention.
- Reuses existing inclusion text freeze and `insertCustomLine` path (same as manual import).
- Dedupes by description so template-copied lines are not duplicated.
- Leaves package **fee** on the booking/commercial_selection financial spine (matches Fancy runtime: 0 package-provenance EO lines).

**Rejected alternatives:**
| Alternative | Why not |
|-------------|---------|
| Auto `addLineFromPackage` fee on EO | Risks double-counting with Selected Package invoice/contract totals |
| Package inclusion → Offering FK + name match | Forbidden by Hybrid / no name-match; larger migration |
| Auto-create EO on booking inherit | Intentionally removed in booking-to-portal simplification; EO tab still recovers from preferred template |
| New package↔template mapping column | Setup Profile already selects EO template; not required to seed inclusions |

## Preserved closed work

- Conditional choice engine, template dependency editor, Offering attach/unlink, choice-tree e2e — untouched unless regression found.
- Snapshot price boundaries; invoice freeze/reissue path unchanged.

## Files

- `lib/event-orders/seed-package-inclusions.ts` — pure filter + notes stamp
- `lib/event-orders/service.ts` — `seedBookingPackageInclusions` from `ensureEventOrder` / `replaceEventOrderFromTemplate`
- `lib/event-orders/seed-package-inclusions.test.ts` — regression
