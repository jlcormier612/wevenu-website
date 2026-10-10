# Multi-venue vendor identity, invitation, portal, Venue Guide

**Status: GREEN**

## Established product decisions (verified)

| Decision | How proven |
|---|---|
| Global vendor identity reused across venues | `attach_global` + live Sandbox: second venue save reuses same `vendors.id` |
| Venue relationships independent (notes, status, required, preference) | DB + browser: Fancy vs Lulu notes/status isolated |
| Ambiguous email/name must NOT merge | Live: ambiguous email creates 3rd row; Cuppity stays 3 |
| Lightweight venue switcher when >1 partnership | `VendorVenueHero` + preference cookie persistence (`f276f919`) |
| Venue Guide selection | Event: `get_vendor_handbook(p_event_id)`; multi-venue list: `VendorHandbookPicker` |
| Branding | Active partnership venue hero/logo/colors — not a global vendor background rule |

## Defects fixed this pass

| Defect | Fix |
|---|---|
| Switcher lost on refresh/nav | Preference cookie `htc_vendor_active_venue_id` (not auth; RPC validates) |
| Switcher select undiscoverable | `HTC_NATIVE_SELECT_CLASS` |

## Automated tests / build

- `lib/vendors/resolve-or-create-vendor.test.ts` — PASS
- `lib/vendor-partnerships/active-venue-preference.test.ts` — PASS
- `npm run build` — PASS

## Commit / deploy / runtime

| Item | Value |
|---|---|
| Commit | `f276f919886b6ebb744b769138deb7cf94669009` |
| Workflow | https://github.com/jlcormier612/wevenu-website/actions/runs/38023347932 — success |
| Live `dpl` | `f276f919886b6ebb744b769138deb7cf94669009` |
| Health | ok |
| Production / marketing | **Not deployed** |

## Live Sandbox evidence

- `db-disposable-proof.json` — identity reuse, independent relationships, RLS, Cuppity untouched, cleanup
- `scope-b-deployed.json` — browser + DB on deployed `f276f919`: reuse, independence, deactivate/reactivate one venue, event assignment scope, RLS deny cross-venue assign, ambiguous non-merge, Cuppity=3, cleanup

## Answers

| Question | Verified fact |
|---|---|
| Multi-venue vendor supported? | **Yes** |
| How Venue Guide chosen? | By event id RPC; list page venue picker when multiple |
| Branding/background? | Active venue partnership branding |
| Navigate relationships? | Lightweight Viewing `<select>` when >1 + All partnerships link |
| Cuppity historical rows | Untouched (3) |

## Fixture cleanup

Verified leftover ScopeB vendors = 0 after each proof run.
