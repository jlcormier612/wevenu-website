# Work Package D5C — Event Order / BEO Operational Experience & Document Completion

## 1. Event Order Source-of-Truth Map

```
Contract (signed)          — legal/commercial agreement (no dollar figure of its own — D5B confirmed)
Event (events table)       — date, guest count (authoritative), space, timing
Questionnaire              — ceremony/reception times, meal notes, special requests
Event Inventory (D5A)      — finalized, snapshotted event-specific selections
Package (catalog)          — reusable priced bundle, referenced not copied
        │
        ▼  all of the above are READ, never duplicated
Event Order                — the one operational/commercial record: sections + line items + total
        │  Finalize (DB-enforced immutable, this phase)
        │  Share with Client (this phase — new)
        ▼
canonical_documents (Document Domain) — the Event Order's PDF representation only
        │
        ▼  existing, unmodified pipeline (D5B)
Invoice → Payment Schedule → Payment → Reporting
```

Every piece of information the Event Order panel now displays was traced to its real authoritative owner before being surfaced — nothing new was added to the `event_orders`/`event_order_lines`/`event_order_sections` schema except two purely operational additions (`shared_at`, and the immutability trigger — no new *content* columns).

## 2. Pre-Implementation Map (as required by §4)

| Question | Finding |
|---|---|
| Existing Event Order data | `event_orders` (status open/finalized, revision), `event_order_sections` (name, floor_plan_id), `event_order_lines` (provenance, quantity, unit_price, amount) — confirmed unchanged, mature (Booking Financial Architecture Phase 2) |
| Existing sections | Optional, ordered, may link a Floor Plan — sufficient for the content model; not extended |
| Existing upstream sources | Event (guest count, date), Questionnaire (ceremony/reception times), Event Inventory (D5A, already hands off via `insertLineFromInventory`), Packages (`insertLineFromPackage`) — all already real, all already wired for financial purposes |
| Existing downstream consumers | Invoice (freeze-on-send, D5B), nothing else — confirmed via repo-wide search |
| Existing sharing | **None** — confirmed zero client/vendor portal exposure before this phase (repo-wide search returned no matches) |
| Existing finalization | `assertOpen()` — **app-layer only**, before this phase (same class of gap D4/D5A already found and fixed elsewhere) |
| Existing representation | **None** — confirmed zero PDF/print mechanism for Event Order before this phase |
| Existing gaps | Sharing, representation, DB-level finalize enforcement, upstream-data display, task deep-link — all genuinely missing, all addressed below |

Event Order Template layer: **deliberately not built**. The Library page's own pre-existing `ComingLaterCard` ("today, every Event Order is built from scratch per event") is a prior, explicit product decision, not a gap this phase discovered — and §34's own instruction only authorizes building one if "the established requirements explicitly require" it. None do. Documented as an intentional scope decision, not a silent omission.

## 3. Event Order Content Model

No new fields were added to `event_order_lines`/`event_order_sections` — they already fully support what this phase needed (description, quantity, price, provenance, sectioning). The **panel UI** gained one new read-only "Event Overview" block, sourced entirely from existing data:

| Displayed field | Source | Notes |
|---|---|---|
| Date | `events.event_date` | Authoritative |
| Guest Count | `events.guest_count` | **Authoritative — never `questionnaire.final_guest_count`** (see §4) |
| Space | `venue_spaces` via `events.space_id` | Same lookup `event-detail.tsx` already performs elsewhere |
| Ceremony/Reception time | `event_questionnaires.ceremony_start_time`/`.reception_start_time` | Read-only display; Event Order never stores its own copy |

## 4. Guest Count Integration — the specific trap avoided

The brief's own §8 named this exact risk: reintroducing the Questionnaire → Guest Count duplication D5 already flagged. The Event Order Overview card reads `event.guestCount` (the authoritative column) directly — it never reads or writes `questionnaire.finalGuestCount`. Verified live: a real event with `guest_count = 125` populated on the `events` table (independent of whether a questionnaire exists at all) rendered correctly on both the panel and the generated PDF.

## 5. Inventory Integration — reused, not rebuilt

D5A's `Event Inventory → Add to Event Order` handoff (`lib/event-inventory/service.ts` `addToEventOrder`) was not touched. Verified live: a finalized Event Inventory item with a real catalog reference, handed into the Event Order via the existing `insertLineFromInventory` path, produced a correctly-priced Event Order line (`Chiavari Chairs × 100 = $1,200`) with the snapshot preserved — no live re-join to the master catalog.

## 6. Contract & Package Integration

Confirmed (D5B, re-verified here): Contract carries no dollar figure of its own, so there is nothing to "copy" from Contract into Event Order — the Event Order's commercial line items are its own authoritative record, same as before this phase. Packages, when used (`insertLineFromPackage`, pre-existing, untouched), still copy at commitment time — the Event Order never re-reads a package's current catalog price after the line was added.

## 7. Financial Consistency — re-verified with the new capability in place

The full chain (Event Order Total → Invoice → Payment Schedule → Payment → Outstanding Balance) was re-validated end-to-end with Event Order's new Finalize/Share behavior active, confirming D5B's own chain still holds:

- Event Order total ($5,000 + $1,200 = $6,200) → Invoice total (frozen, identical) → confirmed no independent recalculation.
- **Scenario D** (Invoice already issued; Event Order changes afterward): verified live — adding a line to the Event Order *after* the invoice was sent left the sent invoice's total exactly unchanged ($6,400 stayed $6,400, not $7,399) — the existing drift-fingerprint mechanism (`eventOrderLinesFingerprint`, D5B) correctly detects the change without silently rewriting anything.
- Reporting: `canonical_gross_booked_revenue()` remained callable and consistent throughout: no new formula, no new metric.

## 8. Event Order Lifecycle & Ready/Finalized Behavior — made honest

**Before this phase:** the "Finalized" status label (`DISPLAY_STATUS_LABEL`) was real, customer-facing product language, but enforcement was app-layer only (`assertOpen()` in `lib/event-orders/service.ts`) — the same class of gap D4 found for Contracts and D5A found for Event Inventory.

**Decision made, per §17's own explicit instruction not to conflate "ready for use" with "immutable":** since the existing label is literally "Finalized" (not "Ready"), and the brief's own examples repeatedly treat this domain's finalize as a real lock, the honest choice was to make "Finalized" **actually true** — not rename it to something softer. A database trigger (mirroring D4's Contract version-lock trigger and D5A's Event Inventory trigger exactly) now rejects any `INSERT`/`UPDATE`/`DELETE` on `event_order_lines` or `event_order_sections` while the parent `event_orders.status = 'finalized'`.

**Verified live, real transactional test:** a raw `UPDATE` on a finalized Event Order's line, a raw `INSERT` of a new line, and a raw `INSERT` of a new section were all rejected at the database level with a clear error — not merely blocked by the app.

## 9. Reopen Behavior

`reopenEventOrder` (pre-existing, unmodified) flips status back to `open`, re-enabling edits — exactly as before. What's new: **`shared_at` and the Document Domain's prior representation are never touched by reopening.** Verified live: after reopening a shared Event Order, the client's last-shared PDF remained exactly as it was (same version, same representation, `getVersionHistory` unchanged) — a coordinator can safely fix a typo without silently invalidating what the client already has open in their portal. A fresh "Share with Client" (or "Update Shared Copy") call afterward creates a **new** version and a **new** representation; the old one is never overwritten.

## 10. Document Representation — reused D4's PDF pipeline exactly

`lib/event-orders/pdf.ts` uses `@react-pdf/renderer` — the same library, same server-side rendering approach D4 established for Contracts, explicitly avoiding the page-level `lineHeight` bug D4 discovered and fixed (this module never sets `lineHeight` at the page level from the start). `lib/event-orders/document-integration.ts` mirrors `lib/contracts/document-integration.ts`'s exact boundary discipline: Event Order remains authoritative for its own structured data; the Document Domain is used *only* for the PDF representation, with `behavior: 'venue_authored'` (not `'negotiated'` — there's no counterparty back-and-forth, matching the Type Matrix precisely).

**Immutability, re-verified for this new producer:** a direct `UPDATE` on the generated representation's row (`canonical_document_representations`) was rejected — the same certified, table-wide `UPDATE`-revoked-for-all-roles protection D1 already established, now proven against a second real producer.

## 11. PDF Visual Quality — actually inspected, not assumed

Two real PDFs were rendered and visually inspected (not just checked for existence):

- **Short** (2 lines, 1 page): clean venue branding (logo, name, brand-colored header rule), Event Overview grid (date/guest count/client), two correctly priced lines, correct total, footer with venue contact and "Page 1 of 1."
- **Long** (26 lines across 3 sections, 2 pages): correct section breaks (Ceremony/Reception/Bar Service), correct text wrapping on long descriptions, no clipping, no overlapping content, no orphaned headings, footer with correct page numbering on *both* pages, correct running total.

No blank pages, no corrupted fonts, no missing branding.

## 12. White-Label Behavior

Venue logo, name, address, and brand primary color render from real venue data — confirmed in both PDFs. Typography remains a single fixed pairing, consistent with D4's own finding (BA1: no venue typography customization field exists in the schema) — not a parallel font system, the same honest limitation D4 already documented.

## 13. Client Experience

A new, read-only portal section (`components/portal/event-order-section.tsx` + `/api/portal/event-order`) — mirrors D5A's Inventory portal section exactly: a client-side fetch to a token-scoped API route, which itself calls a `SECURITY DEFINER` RPC (`get_event_order_for_portal`) that only ever returns rows once `shared_at` is set. The client sees sections, line descriptions, quantities, and amounts (already visible to them via their Invoice — not new disclosure) — never internal notes, staff-only fields, or technical metadata.

**A real regression was found and fixed while wiring this in:** D5A's own Inventory portal wiring (the import + render line in `portal-shell.tsx`) had been silently lost, almost certainly during a large concurrent edit to that same 5,700-line file by another session between D5A and this phase. Restored alongside the new Event Order wiring, in the same single-line-per-section pattern, minimizing further risk to that file.

## 14. Client Approval — not built, correctly

No approval/e-signature mechanism exists for Event Order today, and none was invented. "Client can view" and "client has approved" remain distinct, never-conflated concepts — the client sees a read-only Ready copy; nothing implies legal sign-off, and no UI language claims otherwise.

## 15. Vendor Experience

Not built. No existing vendor-facing Event Order requirement or precedent was found (confirmed: zero matches in `app/vendor`/`components/vendor-app` before and after this phase). Per §26's own conditional framing ("If vendor-specific sharing does not yet exist: document it rather than inventing a new vendor collaboration model"), this is documented as a real, named gap — not built.

## 16. Relationship Workspace

Unchanged structurally — the Event Order remains the existing tab in `event-detail.tsx`, now with the Overview card and Share/Download actions added in place, no new top-level navigation.

## 17. Task Integration

`event_order_shared` was added as a real `auto_complete_trigger`, fired from `shareEventOrderWithClient()` using the exact same non-blocking, best-effort `triggerAutoComplete()` call D5A's Inventory finalize already established — a safe no-op unless a venue has configured a Task with that trigger. Registered in `TRIGGER_WORKSPACE` so any such task deep-links straight to the couple's read-only Event Order view, following the established "domain trigger → owning workspace section, never a bare checkbox" policy.

## 18. Activity, Notifications

New activity type: `shared` (`"Shared with client"`), logged via the existing `event_order_activities` table/`ActivityTimeline` component — no new activity system. No new notification type was added; sharing an Event Order is a venue-initiated action on the venue's own record, not something requiring a coordinator alert (consistent with D5A's identical reasoning for Inventory finalization).

## 19. Permissions — verified live

`event_orders`/`event_order_lines`/`event_order_sections` RLS uses a single, venue-scoped policy with **no role differentiation** (`venue_id = current_user_venue_id()`, all four roles equally) — confirmed by reading the actual policy, then verified live with real Coordinator and Staff sessions (reusing the accounts created in D5B): both could view Event Orders without error. This matches Event Order's established, correct classification as an *operational* record (like Task Lists), not a *financial* one — Staff being blocked from Invoices/Payment Schedules (D5B) but not from Event Orders is the intended, existing distinction, not an oversight.

## 20. Security

- **Cross-venue isolation**: verified live — an owner session querying Event Orders under another venue's id returns zero rows.
- **Representation security**: the new `event-order-representations` storage bucket is private (`public: false`), mirroring `contract-representations` exactly. A bare, unauthenticated fetch to the storage path returns `HTTP 400`; every real download goes through a freshly-minted 5-minute signed URL (`getEventOrderPdfUrl`), never a stored public path.
- **Finalized-state mutation**: proven at the raw database level (§8), not merely assumed from the app's own guard.

## 21. Reporting Integrity

No new metric, formula, or SQL function was created. `canonical_gross_booked_revenue()` was confirmed callable and consistent before and after this phase's changes to a real test Event Order — Event Order's total flows into Invoice exactly as it did before D5C (D5B's own chain, untouched).

## 22. Mobile

**Not verified.** No scriptable mobile session is available in this environment — the same limitation stated in every prior phase of this engagement (D3, D4, D5A, D5B). Stated honestly rather than assumed. The panel's existing layout (already used by the certified Business Asset patterns) and the PDF's fixed-width, single-column design are both inherently mobile-reasonable, but this was not click-tested on an actual device or emulator.

## 23. End-to-End & Negative Test Evidence

Run against the live local dev database with real authenticated sessions, calling the actual repository/PDF/Document Domain functions directly (service.ts's cookie-bound orchestrators can't run outside a real request — same reasoning as every prior phase's own validation script). **All 25 checks passed:**

```
PASS — Owner sign-in
PASS — Event has authoritative guest count (not from Questionnaire)
PASS — Event Order reflects both lines, correct total ($6,200)
PASS — Event Order finalized
PASS — DB-level: raw UPDATE on finalized Event Order line rejected
PASS — DB-level: raw INSERT on finalized Event Order rejected
PASS — DB-level: raw INSERT of section on finalized Event Order rejected
PASS — Generate real Event Order PDF (2.56MB)
PASS — Upload PDF to private event-order-representations bucket
PASS — Document Domain: publish+version+finalize succeeds
PASS — Representation UPDATE rejected (immutable)
PASS — Signed URL generation works
PASS — Bare public URL to private bucket fails (HTTP 400)
PASS — Client portal RPC returns lines only after sharing
PASS — Reopen: status back to open
PASS — Reopen: sharedAt preserved
PASS — Reopen: prior Document Domain version/representation untouched
PASS — Edit succeeds again after reopen
PASS — Re-share creates a NEW version (old one preserved, not overwritten)
PASS — Old version is no longer current; new one is
PASS — Financial safety: total reflects a late edit correctly ($6,400)
PASS — Invoice total derived from Event Order lines, no independent recalculation
PASS — Scenario D: sent invoice total unchanged after Event Order edit
PASS — Drift is detectable (fingerprint changed from what was frozen)
PASS — Cross-venue RLS: owner sees zero Event Orders from another venue
PASS — canonical_gross_booked_revenue callable, returns a number
```

Plus a separate, real live permission check: Coordinator and Staff sessions both confirmed able to view Event Orders (the correct, intended behavior for an operational, non-financial asset).

All test data was deleted afterward.

## 24. Known Limitations

1. **Event Order Template layer does not exist** — a deliberate scope decision (§2), not a gap. The Library's own pre-existing `ComingLaterCard` already states this; not overridden here.
2. **Vendor-facing Event Order visibility does not exist** — no requirement or precedent found; documented, not built.
3. **Client approval/e-signature for Event Order does not exist** — never conflated with "client can view."
4. **A DB trigger immutability edge case** (same class as D5A's own documented one): deleting the *parent* `event_orders` row via `ON DELETE CASCADE` bypasses the child `event_order_lines`/`event_order_sections` trigger. No app code path ever hard-deletes an `event_orders` row (only reopen/finalize/share are exposed), so this has no live exploit path — noted for completeness.
5. **`service_role` lacks an INSERT grant on `client_portal_sessions`** — discovered incidentally while writing this phase's validation script (same class of pre-existing grant gap D4 found on other tables). The real app always creates these sessions as the authenticated venue owner, not via service role, so this has no live impact — flagged, not fixed, as it's unrelated to Event Order itself.
6. **Mobile** — not verified (§22).

## 25. Follow-up Items

- If vendor Event Order visibility becomes a real product requirement, build it as its own scoped phase (not invented speculatively here).
- Consider adding the missing `service_role` grant on `client_portal_sessions` as its own tiny, unrelated follow-up.
- If an Event Order Template layer is later explicitly requested, the D2/D5A "Library `*_templates` table + copy-at-commitment Working Item" pattern is the one to reuse — not a new mechanism.

## Final PASS / FAIL Matrix

| Capability | Status |
|---|---|
| Event Order creation | PASS |
| Event Order editing | PASS |
| Event Order source-of-truth integrity | PASS |
| Questionnaire integration | PASS |
| Guest Count integration | PASS — real test, authoritative source confirmed |
| Inventory integration | PASS — reused D5A handoff unmodified |
| Contract integration | PASS (N/A commercial figure to copy — confirmed, not a gap) |
| Package integration | PASS (existing copy-at-commitment behavior, unmodified) |
| Line-item integrity | PASS |
| Financial consistency | PASS — real test, Scenario D verified |
| Ready/Finalized behavior | PASS — now DB-enforced, real test |
| Reopen behavior | PASS — real test, representation preserved |
| Representation generation | PASS — real test |
| PDF visual quality | PASS — actually inspected, short + long |
| White-label presentation | PASS |
| Client visibility | PASS — new, real test |
| Vendor visibility | N/A — no requirement found, not built |
| Sharing | PASS — new, real test |
| Representation security | PASS — real test (private bucket, signed URL, immutable) |
| Activity | PASS |
| Notifications | N/A — venue-initiated action, no new notification type needed |
| Task deep-linking | PASS — wired, no live task to exercise it yet |
| Relationship Workspace | PASS — existing tab, no new navigation |
| Template behavior | N/A — deliberately not built (§2/§24) |
| Permissions | PASS — real Coordinator/Staff sessions verified |
| Cross-venue isolation | PASS — real test |
| Mobile | NOT VERIFIED — no scriptable mobile session available in this environment |
| Reporting integrity | PASS — canonical functions unaffected |
