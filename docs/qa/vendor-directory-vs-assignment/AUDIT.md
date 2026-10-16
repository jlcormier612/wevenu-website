# Vendor directory vs event assignment — read-only audit

**Status:** AUDIT ONLY — not implemented, not GREEN  
**Date:** 2026-10-16  
**Production:** untouched

## Current lifecycle (authoritative records)

| Concept | Record | What it means |
|---|---|---|
| Directory identity | `vendors` | Global business profile. Not venue-specific. |
| Venue listing | `venue_vendor_relationships` | This venue offers the vendor. `status`: `invited` / `active` / `inactive`. Default path for manual adds is `active` without an invitation. |
| Recommendation | `preference_level` on the relationship: `standard` / `recommended` / `preferred` | Informational ranking. `isPreferred` in the UI is derived from `preferred`, not a second fact. |
| Required / in-house | `is_required`, `is_in_house` on the relationship | Explicit venue policy. Distinct from preference. Required vendors are assigned by `book_relationship` when the relationship becomes Booked — not by being listed. |
| Couple shortlist | Portal picks (`picked_at` private) then `submit_vendor_list` | Submit reveals `selected_at`, creates `event_vendor_assignments`, and notifies newly assigned vendors. |
| Event assignment | `event_vendor_assignments` | Vendor is on this event/client. Pre-booking rows use `client_id` and no `event_id`. |
| Invitation | `vendor_invitations` | Claim/portal access. Created by an explicit invite, or by **booked-event** assignment notify for unclaimed vendors. |
| Confirmation | Assignment notify + vendor portal presence | Not the same as directory listing or recommendation. |

## What already exists

- **Venue directory** (`components/vendors/vendor-list.tsx`): add vendors for couples, recommend/prefer, mark required or in-house, invite separately.
- **Couple portal** (`components/portal/vendor-section.tsx`): Recommended vs full directory, private picks, Submit. Required vendors are labeled and treated as on the event team. Submit copy says it notifies picked vendors (`app/api/portal/vendors/submit/route.ts` → `notifyVendorOfEventAssignment`).
- **Venue assignment** (`components/events/vendors/event-vendors-section.tsx`): multi-select assign. Booked events call `assignVendor`, which emails the vendor and may create an invitation. Pre-booking calls `assignVendorToClient`, which does **not** notify or invite (`lib/vendors/service.ts`).
- **Internal notes** stay venue-side (`INTERNAL_NOTES_PRIVACY_HINT` on the assignment form).
- **Booked-only required assignment** is transactional in `book_relationship` (`lib/vendors/required-vendors.test.ts`).

## Why Start booking file feels like “assignment only”

The pre-booking workspace section is titled Vendors and the only action is **Assign Vendor** (`event-vendors-section.tsx`). That writes `event_vendor_assignments` immediately. It does not offer:

- share the directory without assigning
- mark a recommendation without an assignment
- record a couple’s intended vendor without notifying them
- show required/in-house as policy separate from “assigned”

Those capabilities live on the vendor list and the couple portal, not in this setup panel. The panel reuses the booked-event assignment form, so the wording is assignment-oriented even when the save is the quieter pre-booking path.

## Gaps (no migration proposed yet)

1. Start booking file has no “share directory / recommend” action. Recommendation already lives on `preference_level`.
2. Couple selection already exists, but only after portal access, and Submit both assigns and notifies. That is stronger than “tell the venue who you intend to use.”
3. Pre-booking assignment does not invite; booked assignment and couple Submit do. The product rule “selection must not invite or notify” is true for `assignVendorToClient` and false for couple Submit and `assignVendor`.
4. Required vs recommended is already stored. It is not explained in the Start booking file vendor panel.
5. No new table is required to distinguish listing, recommendation, required/in-house, and assignment. A couple “intent” that is not an assignment would be a new state (or a reuse of private picks without Submit’s notify). That is a product choice, not a missing column on the relationship.

## Smallest change (recommendation — do not build until approved)

Keep `venue_vendor_relationships` and `event_vendor_assignments`. Do not add a second vendor system.

1. In the pre-booking Vendors section, stop presenting directory sharing as assignment. Show the venue directory with preference and required/in-house labels, and a separate explicit **Assign to this event** action (the current multi-assign).
2. Leave couple Submit’s notify behavior unchanged until product approves a quieter “intent” submit that does not call `notifyVendorOfEventAssignment`.
3. Do not auto-assign recommended vendors. Keep required assignment on the existing Booked transition only.

## Tests and browser checks before any build

- Pre-booking assign still creates no `vendor_invitations` and sends no email.
- Booked `assignVendor` and couple Submit still notify (unless product changes Submit).
- `preference_level` does not insert `event_vendor_assignments`.
- `is_required` still assigns only inside `book_relationship`.
- Internal vendor notes stay off the couple portal.
- Browser: Start booking file Vendors shows directory vs assign as separate actions; assigning two vendors still does not duplicate or invite.

## Decisions needed before implementation

1. Should couple Submit keep emailing vendors, or become a private intent the venue reviews?
2. Should “share directory” in setup mean “couples can see active relationships” (already true in the portal) with no new setup step?
3. Should pre-booking **Assign** stay silent (current) while booked Assign keeps notifying?
