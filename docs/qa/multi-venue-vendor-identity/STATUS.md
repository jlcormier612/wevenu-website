# Multi-venue vendor identity, invitation, portal, Venue Guide

**Status:** IN PROGRESS (forensic + preference persistence fix; awaiting Sandbox browser proof)

## Established product decisions (documented + code)

| Decision | Source |
|---|---|
| Global vendor identity may be reused across venues | `decideVendorResolve` → `attach_global`; `resolve-or-create-vendor.test.ts` |
| Venue relationships hold private notes, preference, required flags, status independently | `venue_vendor_relationships`; prior Sandbox probe `docs/qa/vendor-required-forensic/scope-b-disposable.json` |
| Ambiguous email/name matches must NOT merge (Cuppity pattern) | `findGlobalVendorIdentity` + `create_new` on ambiguous; Cuppity stays 3 rows |
| Lightweight venue switcher when partnerships.length > 1 | `VendorVenueHero` comment + UI |
| Venue Guide: event-scoped RPC `get_vendor_handbook(p_event_id)`; multi-venue list uses `VendorHandbookPicker` | `lib/vendor-handbook/service.ts`, handbook picker |
| Branding on vendor dashboard is venue hero/logo/colors for the active partnership | `get_vendor_active_venue` + `applyLiveVenueBrandingUrls` |

## Confirmed in current code

- Invitation / claim path: `notify-assignment` + `/vendor/accept` with claim token for unclaimed vendors.
- Auth: vendor user linked to global `vendors.id`; membership via relationships.
- RLS: venue staff sees only own venue relationship rows (proven in scope-b probe).
- Event assignments scoped by `venue_id` + `event_id`.

## Confirmed defect fixed this pass

| Defect | Root cause | Fix |
|---|---|---|
| Multi-venue switcher lost on refresh / section navigation | Client-only state; SSR always called `getVendorActiveVenue()` with null → newest relationship | Preference cookie `htc_vendor_active_venue_id` written on switch; read on resolve; RPC still authorizes; stale cookie cleared |
| Switcher select looked like a plain text box | Same native-select discoverability gap as client portal | `HTC_NATIVE_SELECT_CLASS` on venue switcher |

## Live Sandbox (prior DB probe — still valid architecture proof)

`scope-b-disposable.json`: same email → one global vendor; Fancy + Lulu independent notes/status; deactivate one venue only; event assignment Fancy-scoped; RLS hides other venue notes; Cuppity count 3 untouched; disposable cleaned.

## Still required this closure

Full browser claim/accept for disposable Vendor X on Venue A then B, guide/branding at 390 + desktop, unauthorized access denial, fixture cleanup — after Sandbox deploy of this revision.

## Production / marketing

Not deployed. Sandbox only. Cuppity historical rows not mutated.
