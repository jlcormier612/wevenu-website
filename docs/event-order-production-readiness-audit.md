# Event Order — Production Readiness Audit

**Type:** Discovery only. No code, schema, migrations, UI, Library, or Help content were modified to produce this document. One reversible local database write was made to drive the live UI (`venues.event_order_enabled` temporarily set to `true` for Sweet Daisy Barn & Farm, confirmed originally `false`) and was restored to its original value before this document was finished; the one test Event Order record created during that walkthrough was deleted afterward. Confirmed via direct query: the venue's flag is back to `false` and zero Event Order records exist for that client.

**Method:** Full schema inspection (`event_orders`, `event_order_sections`, `event_order_lines`, their RLS policies and triggers, all read via `\d`/`\sf`), the complete `lib/event-orders/service.ts` and `event-order-panel.tsx` read in full, a live browser walkthrough (apply a real starter template, inspect the resulting data, reach the Finalize control) against the actual running application, and — critically — this engagement's own prior, rigorous **`docs/booking-financial-architecture-final-release-assessment.md`**, a real, live-RLS-enforced, end-to-end walkthrough of this exact system that already exists in the repository. That document is treated as primary evidence, re-verified rather than re-derived from scratch, and its one open follow-up item was independently confirmed still resolved in the current tree.

---

## 1. Event Order Enablement

**Every reference to `event_order_enabled`, confirmed exhaustive by grep:** `app/(app)/clients/[id]/page.tsx` (resolves the flag and conditionally fetches Event Order data), `lib/venue/repository.ts`/`types.ts` (the field itself), and `components/events/event-detail.tsx` (gates both the tab's visibility and one internal readiness check). Four call sites total, all consistent, no orphaned or duplicate gate found anywhere else in the codebase.

**What enabling it unlocks, confirmed precisely:** the Event Order tab becomes visible in the Event workspace, and the Event's own readiness computation (`orderUnfinalized`) starts accounting for whether the Event Order has been finalized. Nothing else in the product changes when the flag flips — no other feature, page, or automatic action is gated behind it.

**Where the flag itself came from — this is important, direct evidence, not inference:** `docs/booking-financial-architecture-roadmap.md` states outright that this flag was deliberately modeled on a pattern already used once, successfully, in this exact codebase — the Communication Platform's `conversation_experience_enabled` migration flag — specifically so the whole feature "can be turned off instantly with zero data loss if something's wrong." **This was never a hidden or forgotten switch. It is a deliberate, proven staged-rollout mechanism that has simply never been flipped on for any real venue.** That reframes the entire question this audit is answering: the flag being off today is not, by itself, evidence of incompleteness.

**Does enabling it expose any incomplete UI or dead path?** No dead route, no disabled-forever button, and no placeholder copy were found anywhere in `event-order-panel.tsx` (496 lines, read in full — every `disabled` attribute found ties to a real, live pending/finalized state, not an unfinished stub). The one genuine content gap found by driving the UI live is covered in §8 and §11, not a code-completeness issue.

---

## 2. Template → Instance

**Confirmed exactly, both from code and a live write:** `ensureEventOrder(eventId, templateId)` copies each template section's name and each template line's description/quantity/unit price into new, independent rows, every copied line stamped `provenance: 'custom'` — explicitly documented in the code's own comment as deliberate: *"a template line has no live Package/Inventory reference to preserve."* This is a real copy, not a live reference. Confirmed live: applying "Standard Wedding Event Order" produced 139 real, independent `event_order_lines` rows.

**What happens if the template changes afterward?** Nothing — the instance already owns its own copied data; there is no foreign key or sync path back to the template that could propagate a later edit.

**What happens with no template?** `ensureEventOrder(eventId, null)` creates a genuinely empty Event Order (zero sections, zero lines) with a clean "No Event Order yet." empty state and a "Start blank" option — confirmed live.

---

## 3. Event Order Domain

**Schema, confirmed via direct inspection:** `event_orders` (`status`: `open`/`finalized`, `revision`, `finalized_at`, `shared_at`, `template_id`), `event_order_sections`, `event_order_lines` (`provenance`: `package`/`inventory`/`custom`, with real `package_id`/`inventory_item_id` foreign keys, both `ON DELETE SET NULL` — a later catalog deletion cannot cascade-delete a committed line). `event_order_activities` provides an append-only log.

**Immutability is enforced twice, independently — a genuinely strong finding.** Every mutating function in `lib/event-orders/service.ts` runs through a shared `assertOpen` guard at the application layer, *and*, separately, real Postgres `BEFORE INSERT OR UPDATE OR DELETE` triggers on both `event_order_sections` and `event_order_lines` (`..._enforce_finalized_immutability`) raise a hard database exception — confirmed by reading the trigger function body — if the parent order is finalized. This means even a bug in the application layer, or a future direct API/script write, cannot silently mutate a finalized Event Order. This is the same double-enforcement discipline this engagement has found and required elsewhere (e.g., Invoice void protection).

**No missing protection found in the reachable application surface.** No `deleteEventOrder` function exists anywhere in the service or repository layer — the only way an `event_orders` row is ever removed is `ON DELETE CASCADE` from its parent Event, a pre-existing, separately-guarded, high-consequence action outside this feature's own scope.

---

## 4. Financial Integrity

Evaluated per relationship, each confirmed rather than assumed:

| Relationship | State | Evidence |
|---|---|---|
| Event Order ↔ Packages | **Copied at commitment** | `event_order_lines.package_id` + `provenance='package'`; confirmed live in the prior Final Release Assessment: a Package's catalog price was raised *after* an Event Order line committed to it, and the committed line stayed frozen |
| Event Order ↔ Inventory | **Copied at commitment**, same mechanism | `inventory_item_id` FK, same provenance pattern |
| Event Order ↔ Invoice | **Directly connected, one-directional, at the correct trust boundary** | `invoices.event_order_id` FK; confirmed in the prior assessment that a **draft** invoice linked to an Event Order is a live, zero-stored-data projection, while a **sent** invoice freezes its own `invoice_line_items` permanently — changing the Event Order afterward does not, and structurally cannot, move a sent invoice's total |
| Event Order ↔ Payment Schedule | **Intentionally indirect** | Payment Plans attach to the Invoice, never to the Event Order directly — confirmed as "clearly subordinate to Invoice" in the prior assessment's live walkthrough |
| Event Order ↔ Contract | **Not connected, correctly** | No foreign key or code path found linking the two; consistent with Contract representing the legal agreement and Event Order representing operational execution — different trust domains by design |
| Event Order ↔ Floor Plan | **Directly connected, structural only** | `event_order_sections.floor_plan_id`; confirmed in the prior assessment as real "reconciliation" (committed-vs-placed counts surfaced in a banner), not a data-ownership merge |

**Can editing or finalizing an Event Order silently change an existing financial commitment?** No — confirmed by the same live evidence above. The one honest, correctly-surfaced exception is that a **sent** invoice can legitimately *disagree* with a *later-changed, still-open* Event Order — and the existing drift banner is confirmed (live, in the prior assessment) to catch exactly that condition rather than hiding it.

---

## 5. Immutability / Commitment

**"Finalized" means:** `status = 'finalized'`, `finalized_at` set, `revision` incremented — and from that moment, every section and every line is protected at the database level, not merely hidden from the UI.

**Can it be reopened?** Yes — `reopenEventOrder`, a real, symmetric, explicit action, confirmed guarded (`status !== 'finalized'` required) and logged (`"Reopened for changes — was v{revision}"`).

**Who can reopen or edit it?** Any authenticated venue user of any role — confirmed by reading the full service and repository layer, no `owner`/`manager` role check exists anywhere in this domain. **Assessed as consistent, not a gap:** every genuinely destructive or hard-to-reverse action in this domain (editing a finalized record) is already blocked outright by the immutability trigger regardless of role; this engagement's own precedent reserves role-gating specifically for irreversible or financially consequential actions (Contract deletion, Invoice void), and reopening an Event Order is neither — it's a deliberate, logged, symmetric unlock, the same shape as reopening a signed Contract elsewhere in this product.

**Does finalization create a downstream artifact?** Yes — a real PDF download path exists (confirmed live: a "Download PDF" control appears once the order is both finalized and shared), reusing `lib/event-orders/pdf.ts`.

**Can a venue accidentally change something a client already agreed to?** No — confirmed via the explicit, two-step gate: finalizing does **not** make anything client-visible by itself. A separate, distinctly-labeled **"Share with Client"** action is required, with its own honest, in-product explanation: *"Applying a Library template earlier only built this working order — Share is what makes it visible to the client."* This is the same disclosed, deliberate release discipline this engagement has already verified for Contracts, applied consistently here.

---

## 6. Permissions / Security

**Application layer:** every mutation is gated by `withVenue` (real session + venue membership required) and, where relevant, `assertOpen`. No role distinction beyond venue membership — assessed as intentional and consistent per §5.

**Database layer (RLS):** `event_orders_all`, `event_order_sections_all`, and `event_order_lines_all` are each a single, permissive policy scoped to `venue_id = current_user_venue_id()` — correct venue isolation, confirmed no cross-venue leak path. **UI hiding is not the only protection here** — the finalized-state triggers operate independently of any RLS policy and would block a malicious or buggy direct write even from an authenticated venue member attempting to bypass the UI entirely.

---

## 7. Existing Events

**Confirmed: enabling the flag creates nothing automatically.** `ensureEventOrder` is only ever called from an explicit user action (opening the tab and choosing to start one); there is no backfill, migration, or batch job anywhere in the codebase that would retroactively generate Event Orders for a venue's existing events the moment the flag flips. Enabling the flag for a venue with existing clients, events, contracts, invoices, and inventory is confirmed safe and inert until a coordinator explicitly starts an Event Order on a specific event — **genuinely opt-in per event, not per venue.**

---

## 8. UX Completeness

Driven live against the real, running application (see Method). The empty state, template picker, and application flow are all clean, professional, and error-free — zero console errors and zero page errors were observed at any point in this walkthrough.

**One real, significant content finding, found only by actually applying a real starter and reading the result:** the "Standard Wedding Event Order" starter — the most obvious, default-looking choice in the template picker — produced **139 line items, every single one at `quantity = 1`, `unit_price = $0.00`, `provenance = 'custom'`.** Reading the actual line descriptions confirms why: this starter is built as a comprehensive **planning checklist** ("Confirm guest count against the Event record," "Coordinator assigned," "Ceremony notes — add ceremony-specific details the venue team needs"), not a priced document. The panel's own header, unconditionally, reads: *"The single record of what this event will actually receive. Running total: **$0.00**."* Nothing in the UI distinguishes "this is a checklist, pricing comes from adding real Package/Inventory lines separately" from "this total is genuinely zero" — and **finalize is not blocked by a suspiciously zero total**, only by having zero lines at all (which this starter doesn't trigger, since it has 139 of them). A venue could finalize and share this exact starter with a client, unmodified, and the client would see a document titled "what this event will actually receive" with a running total of $0.00.

**This is a real gap in starter content and copy, not in the architecture** — the pricing mechanism itself (§4) is proven sound; this starter simply doesn't exercise it.

**Secondary, minor finding:** the template picker showed **"D7A Test Wedding Template" listed twice** — confirmed dev-seed-data noise from this account specifically, not a code defect, but a concrete signal that Event Order Templates need a real content review pass before any venue's first real impression of this feature is formed.

---

## 9. Test Coverage

**Confirmed: no automated test file exists for `lib/event-orders/` today.** The only test file anywhere in this domain is `lib/event-order-templates/starters.test.ts`, which validates starter *content*, not the live domain logic (finalize, reopen, immutability, line/section mutation, totals). This is a real, meaningful gap relative to what the prior Final Release Assessment describes — that document's own methodology explicitly states it relied on "real transactional tests" having *already* verified finalize/reopen and revision counting "earlier in this engineering effort," cited rather than re-derived. **That earlier verification, whatever form it took, does not exist as a committed, re-runnable automated test today.** The behavior itself is confirmed correct (§3, §5, live walkthrough), but there is currently no regression protection if it's ever touched again.

---

## 10. Dead / Incomplete Code

None found. No `TODO`, `FIXME`, "coming soon," or placeholder copy anywhere in `event-order-panel.tsx` or `lib/event-orders/service.ts`. Every conditional UI state traced back to a real, live status value. The one prior open item from this engagement's own architecture work — the Event-completion checkpoint — is confirmed **already resolved**: `docs/booking-financial-architecture-final-release-assessment.md` records it fixed in a later "Commitment Alignment Sprint," and this pass independently re-confirmed the companion fix (`get_portal_payments` excluding draft-invoice-linked schedules) is genuinely present in the current database function body, not merely claimed.

---

## 11. Product Readiness Verdict

# B. READY WITH SPECIFIC BLOCKERS

The underlying architecture is not in question — it is the most rigorously, honestly pre-tested system this audit has encountered in this engagement, including a prior live, RLS-enforced, end-to-end walkthrough that tried specifically to break it and mostly failed to. The reason this isn't **A** is two concrete, scoped, non-architectural blockers found by this pass:

1. **The default starter template produces a misleading $0.00 "what this event will actually receive" document, and nothing stops it from being finalized and shared with a client exactly as-is.** This is a content/copy/guardrail gap, not an architecture gap.
2. **No automated test coverage exists for the live domain logic today**, despite the logic itself being correct — a real regression-risk gap for a feature about to be exposed broadly for the first time.

Neither blocker requires reopening or redesigning anything about Event Order's architecture, data model, or lifecycle.

---

## 12. Smallest Safe Activation Plan (If Blockers Are Closed)

1. **Fix the starter content, or the guardrail, or both** — either give "Standard Wedding Event Order" real Package/Inventory-sourced priced lines matching how the architecture is actually meant to be used, or clearly separate a "checklist" starter from a "pricing" starter in the picker's own labels, and/or add a plain warning before finalizing/sharing an Event Order whose total is $0.00 despite having lines.
2. **Add a real automated test suite** for finalize/reopen/immutability/line-and-section mutation/totals — the exact behaviors already proven correct once, live, by hand.
3. **Curate the Event Order Template list** before any real venue sees it — remove or rename dev/test-named templates.
4. **Then, activation itself:** given the flag was explicitly designed as a proven, reversible, per-venue staged-rollout mechanism (§1), the safest path is *not* a single global flip. Recommend: enable for a small first cohort of real or beta venues, watch specifically for the starter-content issue in real use, then default-on for new venues once content is fixed, then backfill existing venues last. **A real toggle needs to exist somewhere for this to be operable at all** — today there is genuinely no UI, venue-facing or HQ-facing, to turn this on per venue; building *some* real control (venue Settings, HQ admin, or both) is a prerequisite for any staged rollout, not an optional nice-to-have. This document does not choose which; that is the product decision this audit exists to inform, not resolve.

**Should Event Order Templates remain in Library?** Yes — nothing found in this pass suggests they should be hidden or removed. The templates themselves are real, working, and correctly built; the gap is in the *content* of the most prominent one, not in the decision to promote the category.

---

## 13. If Not Ready

Not applicable — the verdict is B, not C. No missing capability was found that requires new architecture.

---

## 14. Help & Guides

**Not ready to enter the Help & Guides content plan yet.** Consistent with this engagement's own prior, explicit reasoning for the P0 content pass (never document a feature no venue can reach), Event Order should stay out of any Help content plan until it is actually enabled for at least a first real cohort of venues. Once the two blockers in §11 close and a real activation begins, "What is an Event Order, and how is it different from a Package?" becomes a genuine, immediate P0/P1 Help topic — flagged here for the *next* Help pass, not written now.

---

## Recommendation to Jennifer

**Readiness verdict:** **B — Ready with specific blockers**, not A and not C.

**Why:** The architecture underneath Event Order is the most thoroughly pre-verified system found anywhere in this audit — real copy-at-commitment (proven live), real invoice freeze-on-send (proven live), real double-enforced immutability (application *and* database trigger), a real, honest, two-step client-release gate matching Contracts' own discipline, and a prior, rigorous, live end-to-end release assessment that already concluded "Almost Ready" with its remaining items since resolved. The flag itself was never a sign of trouble — it's a deliberate, proven, reversible rollout mechanism, the same pattern already used successfully once before in this codebase, that simply hasn't been used yet.

**Exact blockers:** (1) the default starter template produces a $0.00-total document with no guardrail before it can be finalized and shown to a client exactly like that; (2) no automated test coverage exists for the live domain logic today. Both are scoped, non-architectural, and fixable without touching the data model or lifecycle.

**Safest activation approach:** fix the two blockers, curate the template list, then stage the rollout to a small cohort first — reusing the exact reversible, per-venue mechanism this flag was already built to provide — rather than flipping it on for all eight venues at once. Building a real toggle (venue Settings and/or HQ admin) is a prerequisite for that staged rollout, not a separate nice-to-have.

**Should Event Order Templates remain in Library?** Yes, unchanged.

**Should this become the next implementation workstream?** Yes, and it is now well-scoped: two concrete blockers, a template curation pass, and a decision about where the real enable-toggle should live — a bounded, well-evidenced piece of work, not an open-ended one.

This document ends here. No code, schema, migrations, UI, Library, or Help content were changed in producing it. The one temporary local database change made to drive this audit's live walkthrough has been confirmed reverted.
