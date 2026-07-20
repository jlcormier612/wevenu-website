# Commitment Lifecycle Architecture

**Status:** Approved 2026-07-16 — a foundational architecture document, alongside `docs/product-promise.md`, `docs/domain-model.md`, `docs/client-workspace-product-architecture.md`, `docs/hosted-experience-platform-architecture-spec.md`, `docs/booking-financial-architecture-event-order-model.md`, and `docs/booking-financial-architecture.md`. Now the governing architecture for commitment-based workflows across Wevenu; implementation proceeded under it as the **Commitment Alignment Sprint** (formerly the Product Completion Sprint — see `docs/product-completion-roadmap.md`), sequenced per §9's Domain Mapping Matrix. **Sprint complete, 2026-07-17** — all five items compliant; see `docs/commitment-alignment-sprint-final-report.md` and `docs/commitment-alignment-sprint-retrospective.md`. This document remains the standing governing architecture for any future domain of this shape.

**A commitment is the moment private work intentionally becomes operational work.** This one sentence is the whole document; everything below is that sentence made precise enough to build from.

**Purpose:** Over three separate corrections this session — Private Until Committed (Client Workspace), the Timeline authoritative-source model, and now this document — the same underlying pattern kept reappearing under different names, in different domains, discovered independently each time rather than recognized as one thing. This document is the reconciliation: **the single architectural pattern shared by every commitment-based workflow on the platform**, so that Timeline, Seating, Guest Lists, Vendor Selection, Website Publishing, and every future domain of this shape get built once, correctly, against one pattern — not five separate bespoke implementations that happen to look similar.

**Method:** Per the working style this document was commissioned under, this is a discovery exercise, not an invention exercise. Every state, event, and rule below is derived from a real, already-built or already-designed precedent in this codebase (Contract, Event Order, Invoice, Hosted Experience Platform publishing, Questionnaire, Task auto-completion) — cited by name at each step — not assumed from the examples in the commissioning brief. Where the brief's example states/events don't survive contact with the evidence, that's stated plainly, not silently accepted.

---

## 1. Relationship to Existing Principles

This is not a new principle competing with what's already adopted — it's the general pattern underneath five things already true about this platform, named individually until now:

- **Workspace Sovereignty** — every participant (couple, venue, vendor) owns their own workspace; work inside it is private by default. This document is the lifecycle that governs how something crosses *out* of that sovereign workspace.
- **Copy at Commitment** — a commitment, once made, freezes and is insulated from later drift (Package→Event Order, Event Order→Invoice, Catalog→Floor Plan). This document generalizes *when* a commitment happens and *what triggers the freeze*, across every domain, not just pricing.
- **Beautiful by Default / Hospitality by Default** — a commitment event is often the moment a product feels most alive to the person making it (confetti, celebration, "your venue now has this"). This document's Notification rule (§7) exists specifically so that feeling is preserved: earned by a real, intentional act, not manufactured by watching someone work.
- **Never Silently Change an Agreement** — the general form of `docs/product-promise.md`'s Financial Integrity ("never silently alter financial history") and Legal Integrity ("executed contracts are never edited or overwritten") promises, extended here to *every* commitment, not just money and contracts.
- **Private Until Committed** (`docs/client-workspace-product-architecture.md` §11) — the Client Workspace–specific instance of Workspace Sovereignty, written before this document generalized it. §11 is not superseded; it's the worked example this document's universal pattern is checked against throughout.
- **Timeline as Authoritative Source** (`docs/client-workspace-product-architecture.md` §12) — the domain that forced this generalization. Timeline's three-axis model (Owner / Lock State / Visibility) and its Submit-vs-Publish split are the direct ancestor of §5 and §8 below.

**The Core Principle, as stated at the outset of this initiative and adopted here as this document's governing sentence:**

> Every participant owns their own workspace. Work inside that workspace is private by default. Information becomes operational only when intentionally committed. The platform should never observe or operationalize work in progress.

---

## 2. The Universal Commitment Lifecycle

Six real precedents were compared to derive this, not assumed: **Contract** (`docs/contract-lifecycle-design.md`), **Event Order** (`docs/booking-financial-architecture-event-order-model.md`), **Invoice** (`docs/domain-model.md`), **Hosted Experience Platform publishing** (`docs/hosted-experience-platform-architecture-spec.md` §5), **Questionnaire** (`docs/client-workspace-product-architecture.md` §5), and **Task auto-completion** (`docs/domain-model.md`'s Task entity). The table below is the evidence; the states after it are what all six actually share.

| Precedent | States as built/designed | Two-party? | Post-commit change |
|---|---|---|---|
| Contract | `draft` → `issued` → `client_signed` → `executed` (locked forever) | Yes | Amendment (linked) or Clone/Version (`parent_contract_id`, `supersedes_contract_id`, `is_current`) |
| Event Order | `open` → `finalized` → `amended` | No (venue-internal) | Reopen-and-amend; append-only history; downstream flagged, never silently rewritten |
| Invoice | `draft` (live-synced) → `sent` (frozen) → paid over time | Effectively one-directional | New dated addition after send; never a silent rewrite |
| Hosted Experience (wedding website) | `draft` → `preview` → `published` → `archived` | No | Republish creates a new `experience_versions` row; `current_version_id` repoints; old versions stay queryable |
| Questionnaire | `draft` → `sent` → `submitted` → `reviewed` | Yes | Not yet designed beyond this — a real gap this document doesn't resolve |
| Task (as the commit mechanism, not a commitment itself) | `pending` → `complete`, some via named triggers (`contract_signed`, `questionnaire_submitted`) | N/A | N/A — Task *causes* other things to commit; it isn't itself versioned |

### The states

**Draft.** Private, freely editable, visible only to the Workspace Owner (§4) and anyone explicitly Delegated (§6). No operational or audience visibility of any kind. Matches every precedent above.

**Submitted.** The Workspace Owner's deliberate, named commit action. Becomes visible to the Operational Owner for the first time. This is the Task-completion moment named in `docs/client-workspace-product-architecture.md` §11 — the task's own completion *is* this transition, not a separate signal about it.

**Accepted** *(domain-optional — not universal)*. Present only where the Operational Owner has genuine discretion to act on what was submitted, not merely receive it: Contract's countersignature, Questionnaire's `reviewed`. Absent, correctly, wherever the same party is both Workspace Owner and Operational Owner (Event Order, a couple's own wedding-website publish) — there's no second party to accept from. **Determined, not assumed:** the commissioning brief listed this as an example state; the evidence confirms it's real but conditional, not a universal step every commitment passes through.

**Returned** *(domain-optional — designed here, not built anywhere yet)*. The Operational Owner sends a Submitted commitment back for revision rather than accepting it, without it ever having become Committed. No current precedent implements this — Contract has no reject path (only Draft is editable), Questionnaire's lifecycle as documented stops at `reviewed` with no defined "sent back" state. This document defines the *shape* (returns to Draft, with the returned reason attached, not lost) so a future domain that needs it (Questionnaire review, a venue declining a submitted Vendor selection) doesn't invent its own ad hoc version.

**Committed.** The operative, locked truth. What Contract calls `executed`, Event Order calls `finalized`, Hosted Experience calls `published`. Downstream systems may now depend on this value without it drifting under them.

**Superseded.** A newer commitment (via Revise/Resubmit, §3) has replaced this one as current. The superseded record is never deleted or mutated — it remains permanently queryable, exactly as Contract's `is_current` flip and Hosted Experience's `current_version_id` repoint already do, correctly, today.

**Archived.** The underlying real-world thing (the booking, the event) has completed. Read-only, historical. This is the direct generalization of the Booking Financial Architecture's own named gap — *"Completing an Event has zero cascading effect... a coordinator can close out an event whose supposed system of record for what was actually committed was never locked"* (`docs/booking-financial-architecture-final-release-assessment.md` Finding 5). Under this model, marking an Event Complete should be the trigger that moves every one of its still-Committed (not yet Archived) commitment records — Event Order, Timeline, Seating, Vendor Selection, Guest List — into Archived together, closing that exact gap structurally rather than one-off.

**Withdrawn** *(domain-optional)*. The Workspace Owner pulls a Submitted commitment back before the Operational Owner has Accepted (or, for single-party domains, before it's meaningfully been acted on). Only meaningful where there's a real window between Submitted and Committed to withdraw within.

**Explicitly not adopted: "Ready" as a persisted state.** The commissioning brief listed this. No precedent — Contract, Event Order, Invoice, Hosted Experience, Questionnaire — has a distinct backend status for "I believe I'm done but haven't submitted yet." Where this matters to a person (a checklist, a completeness indicator before the Submit button), it belongs in the workspace's own UI as computed, client-side readiness — not as schema. Recorded here as a deliberate exclusion, not an oversight: **determine the correct lifecycle rather than assuming these states** applies to leaving states out as much as adding them.

---

## 3. Commitment Events — Platform vs. Domain-Specific

**Platform-level** (the same six events, present in every Commitment Lifecycle, named domain-neutrally):

| Event | Transition | Who triggers it |
|---|---|---|
| **Submit** | Draft → Submitted | Workspace Owner |
| **Accept** | Submitted → Committed | Operational Owner (only where Accepted is a real step) |
| **Return** | Submitted → Draft (with reason) | Operational Owner |
| **Withdraw** | Submitted → Draft | Workspace Owner |
| **Revise** | Committed → new Draft, linked to the original (Amendment) or a new Version (Clone) | Workspace Owner (or, for venue-internal domains, whoever holds edit authority) |
| **Archive** | Committed/Superseded → Archived | System, triggered by the underlying Event completing (§2) |

**Domain-specific specializations of the above** — not new concepts, just the vocabulary each domain already uses correctly for one of the six: Event Order's "Finalize" *is* Submit-with-no-Accept-step (single party). Contract's "Sign"/"Countersign" *is* Accept, twice, for its two-party model. Invoice's "Send" *is* Submit. Wedding Website's "Publish" *is* Submit-with-no-Accept-step, same shape as Event Order.

**Determined, not assumed — "Publish" is not a Commitment Lifecycle event at all, for domains with an external audience.** The commissioning brief listed Publish alongside Submit/Approve/Reject as one list. The Timeline correction that preceded this document is the direct counter-evidence: publishing to guests/wedding party/vendors is explicitly independent of submitting to the venue — a client can adjust guest-facing Timeline visibility on their own schedule, unrelated to whether the coordinator has received the private planning timeline yet. **Publish belongs to the Publication axis (§8), a separate relationship from the Commitment Lifecycle's Submit/Accept axis, not a sixth Commitment Event.** Where a domain has no distinct external audience (Event Order, Contract), "publish" doesn't apply at all and shouldn't be forced into the vocabulary.

**Expire** is real (Contract's `expires_at`-scoped portal sessions, Hosted Experience's deferred `scheduled_expire_at`, a Questionnaire or Key Date deadline) but is not a party-triggered event like the six above — it's a **system-triggered, time-based transition**, listed separately because conflating it with a deliberate human act would misattribute it in any audit trail.

---

## 4. Ownership — Three Distinct Roles

Named distinctly because collapsing any two of them is exactly how the current Timeline/Vendor/Guest-List conflations happened:

- **Workspace Owner** — whoever does the private, pre-commitment authorship. Client for Guest List, Seating, Vendor Selection, and (per §12's target model) the client-authored portion of Timeline. Venue for Event Order, Contract drafting, Key Dates. Occasionally the individual Guest, for their own RSVP.
- **Operational Owner** — whoever operates on the fact once Committed. Almost always the Venue, since the venue runs day-of operations — but for venue-authored commitments (Event Order, Contract, Key Dates), the Venue is *both* Workspace Owner and Operational Owner at once, which is precisely why those domains have no Accepted step: there's no second party to accept from.
- **Published Audience** — whoever receives the Committed (or, per §8, sometimes pre-Commitment) content as a read-only, non-operational recipient: Guests, Wedding Party, Vendors-as-recipients, or the Client themselves (a Venue Guide: Workspace Owner = Venue, Operational Owner = Venue, Published Audience = Client).

A domain can genuinely lack any one of these three roles (Event Order has no Published Audience; a couple's own wedding-website publish has no distinct Operational Owner) — the model doesn't require all three to be populated, only that whichever ones exist are kept distinct.

---

## 5. Versioning — When a Commitment Snapshots vs. When It Stays Live

One rule, already correctly implemented independently by both Event Order and Hosted Experience Platform, generalized:

> **While a commitment is still Draft, downstream systems may read it live — nothing has been shown to anyone as final yet, so a mechanical update carries no trust risk.** The moment it becomes Committed, every subsequent change is either (a) a genuinely live-synced operational fact the domain has explicitly marked as such (RSVP counts, guest status — never the committed record itself), or (b) a new Version/Amendment, linked to what it supersedes, which itself becomes Superseded rather than mutated.

This is Event Order's own §5 relationship to Invoice, verbatim in shape ("While the Invoice is still `draft`... Event Order changes may sync live... Once the Invoice has been `sent`... never silently rewrites it"), and it's Hosted Experience Platform's `experience_versions`/`current_version_id` pattern, verbatim in shape. Neither needs to change; this document just names the rule they both already independently discovered.

**Live-synced sections are the deliberate exception, not a violation of this rule** — a Committed wedding website's Schedule section stays live specifically because it's tagged `live_synced` at the *section* level (`docs/hosted-experience-platform-architecture-spec.md` §3), a domain choosing, explicitly, that this one piece of content should never freeze. The rule is "commitments don't silently drift"; a section explicitly declared operational-and-always-current is a different, compatible promise, not an exception that weakens the rule elsewhere.

---

## 6. Publication — Three Distinct Layers

Determined directly from the Timeline correction, generalized beyond Timeline:

1. **Internal workspace visibility** — who sees it while Draft. Always the Workspace Owner alone, plus anyone Delegated (§7). Never the Operational Owner, never any audience. This is Workspace Sovereignty and Private Until Committed, restated as the first layer of this axis.
2. **Operational submission** — the Commitment Lifecycle itself (§2, §3): Workspace Owner → Operational Owner, gated by Submit/Accept.
3. **Audience publication** — Committed (or, in Timeline's specific case, even pre-Commitment for the client's own per-item guest/wedding-party/vendor tags) content → an external, read-only, non-operational audience.

**Layers 2 and 3 are independent, not sequential.** A domain can have layer 3 with no layer 2 at all (a couple's own wedding website — no Operational Owner exists to submit to). A domain can have layer 2 with no layer 3 (Event Order — internal only). And where both exist (Timeline), a client can act on layer 3 without layer 2 having happened yet, and vice versa — the coordinator can receive a submitted timeline that isn't yet published to any guest. Treating these as one axis (today's `timeline_entries.audiences` field, which conflates "visible to the couple in Portal," "visible to the coordinator," and "visible to guests" as adjacent values of one array) is the specific defect this section formalizes the fix for.

---

## 7. Delegation

**An explicit, revocable, bounded transfer of *authorship* — not visibility — from a Workspace Owner to another party, almost always the Venue.** Four requirements, all necessary:

1. **Explicit.** A real action the Workspace Owner takes ("let our venue finish our seating"), never inferred from inactivity, a support request, or a coordinator's own judgment that the couple "probably wants help."
2. **Scoped.** To one domain, one item, or one time-bounded task — never a blanket grant of "the venue can now edit everything in our workspace."
3. **Revocable.** The original Workspace Owner can reclaim authorship at any point; Delegation is a loan, not a transfer of ownership.
4. **Visible to both parties.** The delegate can tell they've been granted this and for what; the delegator can see it's active, who's using it, and can end it.

Delegation is categorically different from an Operational Owner's normal post-Commitment relationship to a record — an Operational Owner reads (and, where the domain allows, operates on) a Committed fact; a Delegate gets *edit rights on private, pre-commitment work*, which nothing else in this model otherwise grants. **This directly resolves the tension `docs/client-workspace-product-architecture.md` §11 named and left open**: "coordinator seat assignment" (the paused Seating Completion item) is Delegation, not ambient Operational Owner access to `guest_seat_assignments` — the item was correctly identified as needing re-scoping; this section is that re-scoping.

---

## 8. Notifications

**Notifications, automations, and Luv observations should fire on Commitment Events (§3) and Publication events (§6) — never on a raw write to Draft data.** This is not a new rule invented for this document — it's the discipline `docs/domain-model.md`'s Task entity already implements correctly today (`contract_signed`, `questionnaire_submitted` are real, working auto-complete triggers keyed to commitment events, not to every edit along the way) and the boundary `docs/client-workspace-product-architecture.md` §6 already stated for automations touching Client-Owned data ("Automations may act on Venue-Owned and Shared data; they should never directly write to Client-Owned data"). This document extends that boundary to *reading*, not just writing: **an automation, notification, or Luv observation should never be triggerable by a change to data still in Draft, only by the Submit/Accept/Return/Withdraw/Revise/Archive event that moves it out of Draft — or, separately, by a Publish event on the Publication axis.**

This is the direct fix for the one concrete violation already found: the feature-adoption/couple-engagement analytics (`lib/analytics/types.ts`'s `seatingStarted`, `rsvpCompletionAvg`, read into Luv's weekly venue-owner digest, per `docs/client-workspace-collaboration-architecture.md` §10) are computed from raw, continuous observation of Draft-stage client work, not from any commitment event — exactly what this section rules out.

---

## 9. Domain Mapping Matrix

| Domain | Workspace Owner | Operational Owner | Published Audience | Current state | Required adjustment |
|---|---|---|---|---|---|
| **Event Order** | Venue | Venue (same party) | Client (read-only "What's Included," per the Event Order model §4) | **Compliant.** The reference implementation this document's lifecycle is substantially modeled on. **Partially addressed 2026-07-17** (`docs/commitment-alignment-booking-financial-alignment-report.md`): marking an Event Complete now warns when its Event Order isn't finalized (reusing the existing `finalized`/`finalized_at` states as the Committed marker) — closing the practical gap Finding 5 named. | The full platform-level Archive-on-Event-Complete hook (§2, §11) — automatically moving every domain's Committed records to Archived together — is still **not built**. What shipped is narrower and UI-level only (a warning, never a block, never an automatic state transition) since `finalized` already serves as Event Order's own Committed state and no separate Archive transition was structurally required to close the named gap. The bigger, platform-level hook remains open for Timeline/Seating/Guest List/Vendor Selection once each has a real Committed state to archive. |
| **Contract** | Venue (drafts) | Client, then Venue (countersign) | n/a (the two parties are the audience) | **Compliant**, per `docs/domain-model.md`'s own ranking — closest-aligned entity in the whole model. Venue-countersignature/Amendment schema is designed (`docs/contract-lifecycle-design.md`) but not yet built. | Build the designed Amendment/Clone schema; no architectural change needed. |
| **Invoice** | Venue | Venue (same party) | Client (view balance) | **✅ Compliant — resolved 2026-07-17** (`docs/commitment-alignment-booking-financial-alignment-report.md`). | None outstanding — `get_portal_payments` now joins to the linked Invoice and excludes any payment schedule whose invoice is still `draft`. |
| **Hosted Experience (Wedding Website)** | Client | n/a (no Operational Owner — venue has no editing surface) | Guests (+ optionally password-scoped) | **Mostly compliant** — Draft/Preview/Published/Archived plus `experience_versions` already match §2 and §5 precisely. | The Schedule section's live-sync depends on the Timeline model below; not independently broken. |
| **Timeline** | Client (planning) + Venue (locked structural milestones) | Venue, after Submit | Guests, Wedding Party, Vendors — independently, per §6/§8 | **✅ Compliant — implemented and live-validated 2026-07-17** (`docs/timeline-implementation-report.md`). Owner/Lock State/Visibility built exactly per §12, refined during implementation: Submit creates an immutable snapshot (`timeline_submissions`, mirroring `experience_versions`) without freezing the client's own workspace — Copy at Commitment, not a freeze-on-submit. Visibility follows Ownership (approved refinement, 2026-07-17): only an item's own owner may set its publication tags, closing a gap the original design left unresolved (§12's own open question about `client` as a Visibility tag). | None outstanding for the core mechanism. `wedding_party` is a real, working Visibility tag with no consuming audience-facing surface yet (no Wedding Party portal exists in the product) — the projection mechanism is ready, the surface is future scope. |
| **Guest List** | Client | Venue (needs the aggregate for operations) | n/a | **✅ Compliant — implemented and live-validated 2026-07-17** (`docs/commitment-alignment-guest-list-submission-report.md`). `guest_count_submissions` (append-only) plus `submit_guest_count`/`get_guest_count_status` RPCs give the couple a real Submit action; `events.guest_count` remains coordinator-editable (Event stays venue-owned per `docs/domain-model.md`) but a couple's explicit submission is now a real, attributable Commitment, not a second silent writer. **The Event-ownership half of this is now enforced platform-wide, not just for Guest List** (`docs/commitment-alignment-booking-financial-alignment-report.md`, 2026-07-17): once an Event exists, it's the sole canonical writer for `guest_count`/`event_type`/`event_date` — Lead and Client show the value read-only with a link to where it's managed now, with a server-side guard as defense-in-depth against a stale form bypassing that. The "Submit your guest count" stock Playbook task now auto-completes as the Submit event's direct side effect (`guest_count_finalized` trigger), matching §2/§8's "the task's own completion is the act of sharing." Coordinator view distinguishes a couple's submission from a manual estimate. | None outstanding. |
| **RSVPs** | Individual Guest (their own response) | Couple (aggregates), then Venue (reads the couple's count) | n/a | **Compliant in shape** — a guest's `submit_rsvp` is already a discrete commit action, not a live-watched draft; revising an RSVP later is a legitimate Revise event. | None structural. |
| **Seating** | Client | Venue, **only if Delegated** (§7) | n/a | **✅ Compliant — implemented and live-validated 2026-07-17** (`docs/commitment-alignment-seating-delegation-submission-report.md`). Corrected finding, live-verified: the venue in fact had *full, ungated, continuous* read access before this item (`wedding-day-seating.tsx` read live `get_seating_data` with no commit gate at all) — the opposite problem from what this row originally stated. Now: each floor plan (Ceremony, Reception, ...) is an independent Commitment Lifecycle with its own `guest_seat_assignments` scoping (`floor_plan_id` added, `unique(guest_id, floor_plan_id)` replacing the old booking-wide `unique(guest_id)`), its own append-only `seating_submissions` history, and its own `seating_delegations` grant. The venue's default read is the latest submission, live data only while delegated; delegated writes are gated per-plan and fully attributable (`submitted_by`/`revoked_by` track couple vs. venue). | None outstanding for the core mechanism. Deferred, named honestly: the venue's delegated-editing UI (`VenueSeatingEditor`) is a functional list/dropdown interface, not the couple's pixel-identical drag-and-drop canvas — same data model and write path, simpler interaction, a natural next iteration. |
| **Vendor Selection** | Client | Venue | n/a today (Vendor-as-recipient is plausible future work, not built) | **✅ Compliant — implemented and live-validated 2026-07-17** (`docs/commitment-alignment-vendor-selection-submission-report.md`). `event_vendor_recommendations.picked_at` (new, private) split from `selected_at` (existing, now exclusively a Commitment fact set only by `submit_vendor_list`) — the existing venue-facing "Chosen by" badge and the existing per-vendor notification trigger both required zero changes, since they already keyed off `selected_at`. V1's shortlist model (multiple picks, not one-per-category) preserved as-is; Submit commits the couple's whole current picked set in one action. A real, separate pre-existing bug was found and fixed in the same pass: the old per-click auto-complete call was silently no-op'ing for every real couple (a raw `client_portal_sessions` table read with no RLS grant for `anon` — the same bug class as `/api/portal/invite`, confirmed independently here). | None outstanding. |
| **Documents** | Whoever uploads (Client or Venue) | The other party, gated by `share_with_venue`/`is_couple_visible` | n/a today | **✅ Compliant — resolved 2026-07-17** (`docs/commitment-alignment-documents-private-until-shared-report.md`). `is_couple_visible` now defaults `false` and is set `true` only by the send action already governing each domain's own Draft→Sent transition — Private until intentionally shared, with no new lifecycle concept introduced. | None outstanding. This closes the last item of the Commitment Alignment Sprint — see `docs/commitment-alignment-sprint-final-report.md`. |
| **Payments** | Venue | Venue (same party) | Client (view; future: pay online) | **✅ Compliant — resolved 2026-07-17**, same fix as Invoice above (they share the underlying `get_portal_payments` mechanism). Additionally, `invoices.balance_due` — the fact Payments and Invoice both ultimately feed — is now DB-enforced via trigger, so it can never drift from `total` minus actually-collected payments regardless of which app-level write path fires (`docs/commitment-alignment-booking-financial-alignment-report.md`). | None outstanding. |
| **Key Dates** | Venue (authors deadlines) | n/a (same party) | Client, if the open couple-visibility decision resolves toward it | **Not really a Commitment Lifecycle domain** — no couple private-workspace phase exists to gate, per `docs/client-workspace-product-architecture.md` §11's own treatment. A couple-visible Key Date is a plain Share (Publication axis, layer 3, with no layer 2), or the deadline simply names the Task that *is* another domain's real commitment point (e.g., "Final Guest Count Due" names the Guest List's own Submit task). | None from this document — the open decision is unaffected by this architecture. |
| **Planning Playbooks / Tasks** | N/A — not itself a domain with a Workspace/Operational/Audience split | — | — | **This is the mechanism, not a domain.** Task is the platform-level implementation of the Submit event (§2, §3) — its own auto-complete-trigger pattern (`contract_signed`, `questionnaire_submitted`) is already the working precedent §8's Notification rule generalizes from. | Extend the same trigger pattern to the domains above once each gets a real Submit action to trigger from (Finalize Guest Count, Submit Seating Plan, Submit Vendor List, Submit Timeline). |

---

## 10. Implementation Implications

Ranked by how far each domain's current implementation is from this model, most to least aligned — mirroring the ranking method `docs/domain-model.md` §"What this model implies for Program 2" already uses successfully:

1. **Event Order, Contract** — already match this model closely. Event Order's completion-time checkpoint shipped 2026-07-17 (narrower than the full Archive-on-Complete hook — see §11); Contract's Amendment schema remains already-designed/not-yet-built.
2. ~~**Invoice, Payments, Documents** — narrow, specific gaps (a send-status visibility check; an unwired default) rather than structural mismatches.~~ **All three moved to compliant 2026-07-17** — Invoice and Payments as item 4 (`docs/commitment-alignment-booking-financial-alignment-report.md`), Documents as item 5, the sprint's final item (`docs/commitment-alignment-documents-private-until-shared-report.md`).
3. **Hosted Experience Platform** — compliant on its own terms; its one dependency (Schedule) is downstream of Timeline, not independently broken.
4. **RSVPs** — already compliant in shape; no work implied.
5. *(All five domains in this ranking group are now compliant.)* **Guest List** (`docs/commitment-alignment-guest-list-submission-report.md`), **Seating** (`docs/commitment-alignment-seating-delegation-submission-report.md`), **Vendor Selection** (`docs/commitment-alignment-vendor-selection-submission-report.md`), **Booking Financial** (`docs/commitment-alignment-booking-financial-alignment-report.md`), and **Documents** (`docs/commitment-alignment-documents-private-until-shared-report.md`) all moved to compliant 2026-07-17 — all five items of the Commitment Alignment Sprint; see §9 for what shipped in each. **The Commitment Alignment Sprint is complete** — see `docs/commitment-alignment-sprint-final-report.md`.
6. **Timeline** — the largest single piece of new architecture implied by this document, already designed (§12 of the Client Workspace doc) but entirely unbuilt.
7. **Key Dates** — unaffected; the open couple-visibility decision stands on its own, orthogonal to this document.

**A cross-cutting implication for all of 5 and 6 above:** every one of these needs (a) a Draft-stage private workspace that already exists today in some form (Guest List, Seating, Vendor recommendations, Timeline planning all already have *a* private/semi-private editing surface), and (b) a net-new Submit action wired as a Task per §2/§8. **The work is consistently "add the missing commit point," not "rebuild the workspace"** — the same shape Timeline's own §12 already concluded, now confirmed as the general case rather than a one-off.

---

## 11. Recommended Roadmap Adjustments

- **The paused Product Completion Sprint** (`docs/product-completion-roadmap.md`'s 2026-07-16 note) should resume scoped against §9's Domain Mapping Matrix, not its original assessment-derived scope. Concretely: Seating Completion's "coordinator seat assignment" becomes a Delegation build (§7); the Booking Financial guest-count-triplication finding — **resolved 2026-07-17, see the Guest List row above** — and Key Dates' couple-visibility question, still open, both fold into the Guest List row rather than being tracked as separate efforts.
- **Timeline implementation remains paused** until its already-designed target model (§12 of the Client Workspace doc) is built — this document doesn't change that status, it confirms the design was correct and generalizes it.
- **A new, small cross-domain item this document surfaces that wasn't previously named anywhere:** Archive-on-Event-Complete (§2's Archived state) should be built once, as a platform-level event-completion hook, rather than domain-by-domain — it resolves Booking Financial's Finding 5 (Event Order) and would, for free, resolve the equivalent gap for Timeline, Seating, Guest List, and Vendor Selection the moment each of those gets a real Committed state to archive. **Status, 2026-07-17:** Event Order's own practical instance of Finding 5 was closed with a narrower, UI-level completion-time warning (§9's Event Order row) rather than this full hook — the platform-level Archive-on-Event-Complete mechanism itself remains unbuilt, still applicable to Timeline/Seating/Guest List/Vendor Selection once each has a real Committed state.
- **Notification/automation work** (Luv's feature-adoption digest, any future Guest-List/Seating/Vendor reminder) should be audited against §8 before being extended further — the one confirmed violation (aggregate `seatingStarted`/`rsvpCompletionAvg` signals) should be re-scoped to trigger from Commitment Events once those exist, not from raw Draft-stage table state as it does today.

---

*End of document. No implementation, schema, or migration is proposed. Per the commissioning instruction, this becomes the governing architecture for all future Client Workspace implementation once approved — implementation of any specific domain above should be scoped and approved on its own, the same way every other piece of work in this review series has been.*
