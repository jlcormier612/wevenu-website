# Architectural Debt Review Checklist

**Status:** Adopted 2026-07-08. Every major design review, from this point forward, should run this checklist before implementation begins — not as a separate document, but as a section within the review itself. Where a pattern is found, recommend resolving it before implementation whenever practical, per the Product Strategy Charter's "remove before adding, unify before separating."

This checklist exists because all four patterns below were found independently, in unrelated subsystems, across this program — meaning they are recurring failure shapes for this codebase specifically, not generic advice. Each one is grounded in a real, already-verified instance rather than a hypothetical.

---

## 1. Duplicate Truth

The same real-world fact is answerable from more than one authoritative field, table, or column, with nothing keeping them in sync. This is what Engineering Standard #12 exists to name and prevent.

**Already found:** three overlapping "has this vendor accepted" signals (`vendors.is_claimed`, `vendor_invitations.status`, `venue_vendor_relationships.status`) — `docs/vendor-domain-model-review.md`. Also caught *before* it was built: a naive Client lifecycle status sitting alongside the Planning Playbook's own milestone progress — `docs/booking-journey-design.md`.

**Ask:** could two of these fields ever disagree about the same real-world fact? If yes, one must become the owner and the other a projection or be removed entirely.

## 2. Collected But Not Used

Data is written to the schema — sometimes with real RLS policies and a real TypeScript type — but read by no service, no UI, no report. The schema assumed a feature that never got a delivery surface.

**Already found:** `vendor_reviews` (rating, body, RLS all real; zero reads or writes anywhere in the app) — `docs/vendor-relationship-lifecycle.md`. Venue `secondary`/`accent`/`neutral` brand colors (found earlier in Program 2). Planning Playbook task `visibility` values, before Phase 2 gave them a real Builder.

**Ask:** for every field or table this design introduces or relies on, can you name the specific screen or process that reads it? If not, either build that surface as part of this work, or don't add the field yet.

## 3. Duplicate Experience

Two routes, components, or flows independently solve the same user need, usually because one replaced the other without the old one being removed.

**Already found:** `/settings/playbooks/[id]` vs. `/library/playbooks/[id]` (identical editor, two nav entry points — consolidated in Phase 2). The legacy `/v/[token]` vendor portal vs. the real `/vendor/*` app (confirmed dead, flagged for deletion in `docs/vendor-network-charter-review.md`).

**Ask:** does this design introduce a screen or flow that already has a near-equivalent somewhere else in the app? If yes, consolidate onto one rather than let both live "for compatibility" — Engineering Standard #9's exact warning about compatibility shims being where staleness hides.

## 4. Silent Failure

An action reports success to the user (or simply doesn't error) while not actually producing the effect the user believes it produced.

**Already found:** a venue coordinator editing a vendor's name, category, or pricing tier — the only UPDATE RLS policy on `vendors` belongs to the vendor's own claimed account, so the coordinator's edit call affects zero rows, throws no error, while the paired relationship-fields update in the same call succeeds — verified live with a rolled-back transaction (`docs/vendor-domain-model-review.md`).

**Ask:** for every write this design performs, what happens if the underlying permission or state guard silently rejects it? Does the caller find out? If a write can fail without the user seeing an error, that's a silent failure waiting to be found by a support ticket instead of a review.

---

## How to use this

Run all four passes as a named section in the review document itself, not a separate exercise — findings should read the way `docs/vendor-domain-model-review.md` and `docs/vendor-relationship-lifecycle.md` already do: verified, not inferred, with the specific field/table/route named. If a pattern is found, the review should recommend a resolution before implementation whenever practical; where resolving it isn't practical in the same pass, name it explicitly as accepted debt rather than leave it implicit.

Log any resulting architecture decision — including a decision to accept a piece of debt rather than fix it now — in `docs/adr/` so the reasoning survives past this conversation.
