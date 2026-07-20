# Commitment Alignment Sprint — Final Report

**Status: Complete, 2026-07-17.** All five items of the Commitment Alignment Sprint are shipped and live-validated. This report closes the sprint that began with `docs/commitment-lifecycle-architecture.md`'s approval on 2026-07-16.

---

## 1. Architecture Changes

The sprint's governing document, `docs/commitment-lifecycle-architecture.md`, established one pattern — **a commitment is the moment private work intentionally becomes operational work** — as the single architecture behind every domain where a couple does private planning work before a venue needs to act on it. Five domains were aligned to it:

| Item | Domain | What changed |
|---|---|---|
| 1 | **Guest List** | `guest_count_submissions` (append-only) + `submit_guest_count`/`get_guest_count_status` RPCs give the couple a real Submit action. `events.guest_count` stays the venue-owned canonical value; a submission is a real, attributable Commitment layered on top, not a second silent writer. |
| 2 | **Seating** | Each floor plan became its own independent Commitment Lifecycle with its own append-only `seating_submissions` history and its own `seating_delegations` grant — the first real implementation of Delegation (§7): explicit, scoped, revocable, visible to both parties. |
| 3 | **Vendor Selection** | `event_vendor_recommendations.picked_at` (private) split from `selected_at` (Commitment, set only by a real Submit action) — a couple can pick and unpick freely; nothing reaches the venue until they submit. |
| 4 | **Booking Financial** | Four fixes: `get_portal_payments` now gates on the linked invoice's send-status (Publication axis); an Event-complete checkpoint warns when Event Order/Floor Plan aren't finalized (reusing existing states, no new lifecycle concept); Event became the sole canonical writer for `guest_count`/`event_type`/`event_date`, with Lead and Client now read-only + linked; `invoices.balance_due` became DB-enforced via trigger, closing a two-writer drift risk that predated this sprint. |
| 5 | **Documents** | `contracts`/`invoices.is_couple_visible` now defaults `false` and is set `true` only by each domain's own existing send action — closing the last gap where a document became visible to a couple by default, not by an explicit venue action. |

**The pattern that generalized across all five:** every domain needed (a) a private Draft-stage workspace that mostly already existed in some form, and (b) a net-new or newly-honest Submit/Send action wired as the one moment private work becomes shared. Nowhere in the sprint was a genuinely new lifecycle state invented — every fix reused a state or transition that already existed (Draft/Sent, `finalized`/`finalized_at`, the existing pick/select split) and made it actually govern visibility, rather than adding new machinery.

**A recurring bug class, found and fixed independently three times:** a raw table read for portal session context (`.from("client_portal_sessions").select(...)`) silently returns nothing for anonymous couple requests, because no RLS policy grants `anon` access to that table. Every task-completion trigger in this sprint was therefore built natively inside a SECURITY DEFINER RPC that's already token-authenticated, never via that pattern — structurally immune to the bug class, not just patched around it.

---

## 2. Domain Mapping Matrix — Final State

Per `docs/commitment-lifecycle-architecture.md` §9, condensed:

| Domain | State |
|---|---|
| Event Order | ✅ Compliant — reference implementation; completion-time checkpoint added this sprint. Full Archive-on-Event-Complete hook (§2) remains unbuilt (see §3 below). |
| Contract | ✅ Compliant — closest-aligned entity in the model. Amendment/Clone schema designed, not built. |
| Invoice | ✅ Compliant — resolved item 4. |
| Payments | ✅ Compliant — resolved item 4. |
| Documents | ✅ Compliant — resolved item 5. |
| Hosted Experience (Wedding Website) | ✅ Compliant — one dependency (Schedule) downstream of Timeline. |
| Guest List | ✅ Compliant — resolved item 1. |
| RSVPs | ✅ Compliant in shape — no work required. |
| Seating | ✅ Compliant — resolved item 2. Delegated-editing UI is functional but not the couple's pixel-identical canvas — named as a future iteration, not a compliance gap. |
| Vendor Selection | ✅ Compliant — resolved item 3. |
| Key Dates | Not a Commitment Lifecycle domain by this document's own treatment — unaffected, orthogonal open question (couple-visibility). |
| Planning Playbooks / Tasks | The mechanism, not a domain — already the working precedent every domain's auto-complete trigger reused. |
| **Timeline** | **Non-compliant — the one deliberately unbuilt domain.** Target model already designed (`docs/client-workspace-product-architecture.md` §12). Implementation remains paused, not because it was deprioritized within this sprint, but because it was paused *before* this sprint began and this sprint's own scope never included building it — only confirming its design was correct. |

**Every domain in scope for this sprint is now Compliant.** Timeline is the sole exception, and it was never in scope — it's a separately-gated, already-designed piece of architecture waiting on its own implementation decision.

---

## 3. Remaining Deferred Initiatives

Named explicitly, not left implicit, per the Transparency promise this whole engineering effort has operated under:

- **Timeline implementation** (`docs/client-workspace-product-architecture.md` §12) — the largest single piece of architecture this document implies, fully designed, entirely unbuilt. Paused before this sprint; this sprint confirms the design generalizes correctly but doesn't change its status.
- **The platform-level Archive-on-Event-Complete hook** (§2's Archived state) — Event Order's own practical instance of this gap was closed this sprint with a narrower, UI-level completion-time warning. The bigger mechanism — automatically moving every domain's Committed records to Archived together when an Event completes — remains unbuilt, and will become buildable for Timeline/Seating/Guest List/Vendor Selection once each has a real Committed state to archive (which, after this sprint, all four now do).
- **Contract's Amendment/Clone schema** (`docs/contract-lifecycle-design.md`) — designed, not built. No architectural blocker; a scheduling decision only.
- **Seating's delegated-editing UI** (`VenueSeatingEditor`) — a functional list/dropdown interface, not the couple's pixel-identical drag-and-drop canvas. Same data model, same write path, simpler interaction — a natural next iteration, not a compliance gap.
- **Key Dates' couple-visibility question** — an open product decision this architecture doesn't resolve or block, per §9's own explicit treatment.

---

## 4. Future Product Evolution Initiatives

Two initiatives were surfaced and explicitly deferred during this sprint, per your direct instruction not to build new commercial or platform capability inside an alignment sprint:

- **Commercial Proposal Architecture** (`docs/future-initiative-commercial-proposal-architecture.md`) — a formal Proposal artifact bridging Sales CRM and Booking, supporting pricing, packages, revisions, and client acceptance prior to Event Order creation. Explicitly ruled *not* a Commitment Lifecycle artifact (it precedes Booking and Event Order entirely) and explicitly *not* reduced to "just a label" — today's `proposal_sent` pipeline stage is named as an honest limitation, not the intended design.
- **Venue Brand Experience** (raised and documented alongside this sprint, not part of it — `docs/venue-branding-architecture-audit.md`) — a brand recommendation engine using the venue's existing onboarding-time Venue Style as the single canonical input into Hosted Experience defaults, Client Portal defaults, email/PDF/guest-facing branding, and venue identity refinement, with the venue always able to review and override. Explicitly not a second self-classification step, and explicitly not a direct override of the Hosted Experience Platform's curated catalog.

Both are captured in `docs/product-completion-roadmap.md` under Program 3 (Customer Experience), cross-linked from their own documents.

---

## 5. Final Platform Readiness Assessment

Judged against the same bar the Product Completion Roadmap set for this whole engineering effort — *"would I feel proud asking a former Weven customer to run their business on this today?"*, not *"does it technically work."*

**What this sprint actually closed:** every domain where a couple does private planning work before a venue needs to act on it now has a real, attributable, append-only Commitment — not a live-watched draft masquerading as a decision. A venue can now trust that what they see for Guest List, Seating, Vendor Selection, Booking Financial, and Documents is what the couple actually decided and chose to share, at the moment they chose to share it — not a snapshot of whatever they happened to be typing. That is a direct, structural answer to the exact failure mode this whole trust-rebuilding effort exists to prevent: software that *appears* to reflect a customer's decisions but quietly doesn't.

**What this sprint did not touch, by design:** Timeline remains the one genuinely unbuilt piece of this architecture — a real gap, honestly named, not hidden behind a false affordance. The Commercial Proposal and Venue Brand Experience initiatives are real product opportunities, deliberately not built here because building them wasn't this sprint's job.

**What this sprint found and fixed along the way, beyond its own stated scope:** a contract-creation bug that would have broken every venue's first contract send before they'd saved a template; a genuine drift risk in `invoices.balance_due` that predated this sprint entirely; a recurring RLS-blind-spot bug class closed structurally, three times, rather than patched once and left latent elsewhere.

**Net assessment:** the platform's commitment-based domains — the core of what a venue and a couple actually do together day to day — are now architecturally coherent, verified with real data through real code paths (not superuser simulation), and documented well enough that the next person to touch any of these five domains has a governing pattern to build against rather than a fresh judgment call. That is a materially different, and materially more trustworthy, position than where this sprint started.
