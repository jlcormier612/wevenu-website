# Commitment Alignment Sprint — Vendor Selection Submission Report

Closes item 3 of 5 in the Commitment Alignment Sprint, per `docs/commitment-lifecycle-architecture.md` §9's Domain Mapping Matrix. Next: Booking Financial alignment items.

## What Shipped

| # | File | Delivers |
|---|---|---|
| 1 | `supabase/migrations/20261026000000_..._vendor_selection_submission.sql` | `event_vendor_recommendations.picked_at` (new, private); `vendor_selection_submissions` (append-only); `toggle_vendor_pick`; `submit_vendor_list`; `get_event_vendor_recommendations` extended with `pickedAt`; `select_event_vendor_recommendation` dropped (fully superseded, confirmed single caller) |
| 2 | `lib/playbooks/constants.ts` | New stock Client Planning task, "Choose your vendors," wired to the existing (previously-unused-in-stock, previously-broken-in-practice) `vendor_selected` trigger |
| 3 | `app/api/portal/vendors/route.ts` | POST now calls `toggle_vendor_pick` (private) instead of the old immediate-reveal RPC; the broken `triggerAutoComplete` call removed entirely |
| 4 | `app/api/portal/vendors/submit/route.ts` | New — the couple's Submit action |
| 5 | `components/portal/vendor-section.tsx` | Pick/unpick toggle replacing one-way "Choose"; a submit summary bar with confirm flow; cards distinguish not-picked / picked-privately / submitted |

## The Shape of This Domain, and Why the Fix Was Smaller Than It Looked

Two things made this item more contained than Seating, confirmed by research before any code was written:

- **Selection here is already a shortlist, not an exclusive per-category choice** — `event_vendor_recommendations` is one row per (event, vendor), with a category living on the vendor, not the recommendation. The couple can pick multiple vendors in the same category today, by design (the migration's own comment: "three florist options is the whole point"). Submit therefore commits the couple's *whole current picked set* in one action, not a single per-category decision — the review screen is "here's everyone I've picked," not "confirm your one florist."
- **The existing venue-facing surfaces needed zero changes.** Both `event-vendor-recommendations-section.tsx`'s "Chosen by {clientName}" badge and the DB trigger that fires the venue notification already keyed off `selected_at` — not off which RPC happened to set it. Splitting the couple's private choice (`picked_at`, new) from the venue-visible commitment (`selected_at`, existing column, existing semantics) meant the only things that needed to change were *what writes to `selected_at`* and *when* — not what reads it.

## A Second, Independent Bug Found During Research — Fixed as Part of This Redesign

Before writing any code, research confirmed `app/api/portal/vendors/route.ts`'s old auto-complete call was silently broken for every real couple: it resolved `client_portal_sessions` via a raw `.from(...).select(...)`, and no RLS policy on that table grants the `anon` role access — the identical bug class already found and fixed for `/api/portal/invite` earlier in this initiative. In practice this meant any venue that manually configured a custom task with the `vendor_selected` trigger would have seen it never actually complete. This wasn't a separate fix — it became moot by construction: `submit_vendor_list` completes tasks natively in SQL inside the same SECURITY DEFINER function that already handles auth, the same pattern used for Guest List and Seating, which structurally cannot hit this bug class.

## Design Decisions

1. **Un-picking is now possible, before and after submission — a small, deliberate product improvement, not scope creep.** The old UI had no unselect at all (`disabled={isSelected}`, permanently). "Private, freely editable until committed" is a core tenet of the Commitment Lifecycle Architecture, and honoring it here required allowing the couple to change their mind. After a submission, un-picking doesn't retroactively hide anything from the venue — the prior submission snapshot stays exactly as it was, permanently; a *new* submission is required to sync the venue-visible state to the couple's current picks, matching the same resubmission shape as Guest List and Seating.
2. **Submit syncs `selected_at` to exactly match current `picked_at` — additions and removals — in one statement.** This is Guest List's "the latest submission is the current truth, history is preserved separately" pattern, applied to a set instead of a scalar or a seating chart.
3. **The stock task is `isRequired: false`, unlike Guest Count and Seating's required stock tasks.** Vendor recommendations are venue-optional to begin with — the empty state already says "your venue will add vendor recommendations here as they get to know your event." A required task tied to a feature that may never have any content for a given couple would be a false negative on every readiness score. Guest Count and Seating are universal to every wedding; vendor recommendations are not.
4. **`vendor_selected` (existing trigger value) was reused, not replaced with a `vendor_list_submitted`-style name.** It already existed, was already selectable, and — per the bug above — had never actually worked for any real venue. Reusing it means this fix makes an existing, already-surfaced option start working correctly for the first time, rather than adding a second, overlapping trigger name.

## Live Validation

Real venue, client, event, two real vendors (a florist and a DJ) with real recommendations, one real Playbook task wired to `vendor_selected`.

- **Picks are private, proven with a live read**: after picking both vendors via the real API, a direct read of `event_vendor_recommendations` confirmed `picked = true, selected = false` for both — the coordinator's own read path (which already, correctly, only shows `selected_at`) would show nothing.
- **Freedom to change mind before submitting**: unpicked and re-picked the DJ; both operations succeeded cleanly.
- **Submit → three-way commit, verified independently**: after submitting, both recommendations flipped to `selected = true`; the pre-existing `_trigger_vendor_selection_notification` fired correctly (two `vendor_selected` venue notifications, one per vendor — unchanged trigger, now actually reachable); the "Choose your vendors" task auto-completed (`status: complete`, `completed_by: system`).
- **Resubmission, proven with a live write**: unpicked the DJ, submitted again — the DJ's `selected_at` correctly cleared (venue no longer sees it as chosen) while the florist's stayed; **both** submission snapshots (`selected_count: 2`, then `selected_count: 1`) remained in `vendor_selection_submissions` permanently, neither mutated.
- **Security**: invalid token rejected on both the read route and the submit route.
- `tsc --noEmit` clean throughout, aside from the same two pre-existing, unrelated stale `.next` entries noted in every prior report this session.

All test data (venue, venue_staff, client, event, two vendors, two recommendations, portal session, task, both submission snapshots, both venue notifications) created and fully removed; final verification confirmed zero rows across every touched table.

## Recommendation: Vendor Selection Submission Complete

All three domains needing a genuinely new Submit action (Guest List, Seating, Vendor Selection) are now compliant. Ready to proceed to item 4 of the Commitment Alignment Sprint — Booking Financial alignment items — per `docs/commitment-lifecycle-architecture.md` §9's scoping: the smaller, previously-named gaps (`get_portal_payments` not gating on Invoice send-status; the guest-count-triplication finding, already folded into the Guest List item now shipped) rather than a new Submit mechanism.
