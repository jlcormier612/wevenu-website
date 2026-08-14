# Event Order Product Readiness & Rollout Recommendation

**Type:** Research and product recommendation only. No code, schema, migrations, Library, navigation, or UI were modified to produce this document, and the feature was not enabled.
**Method:** Builds directly on `docs/event-order-production-readiness-audit.md` (this engagement's own prior, live-verified audit, including a reversible local flag toggle that was confirmed restored). This pass adds new depth specifically requested here — the exact origin of the starter template's $0 content, the exact origin and safety of the duplicate template, the client-facing portal experience (not previously traced), and an exhaustive rollout-options comparison — verified against the current source and live database, not re-guessed from the prior document's summary.

---

## Executive Decision

# B. Ready after a small, explicitly bounded remediation.

Not A: two real, specific, non-architectural gaps exist (the default starter's content collides with an unfinished validation step; zero automated tests). Not C: nothing found in this pass or the prior one requires new architecture, new workflow engines, or a redesign — the opposite is true, this is the most rigorously pre-verified system found anywhere in this engagement. Not D: there is no evidence the feature should stay hidden — the flag was deliberately built as a reversible rollout mechanism, not a verdict, and everything this pass found is fixable in scope, not in kind.

---

## Current Product Truth

An Event Order is the venue's own, single-party, editable working record of what one specific booked event will actually receive — sections and line items, each optionally priced, each optionally traced back to a real Package or Inventory catalog item. It is not a contract, not an invoice, and not a payment request. It has no client-approval or e-signature mechanism of any kind, confirmed directly in the client-facing component's own comment: *"Event Order remains a single-party venue record... this phase adds visibility, not collaboration, which was never asked for."* Clients can only ever view it, read-only, and only after the venue has both finalized and explicitly shared it.

---

## End-to-End Venue Journey

Traced against the real, running application in the prior audit (flag temporarily and reversibly enabled, confirmed restored afterward) and against source in this pass:

1. **Library → Planning → Event Order Templates.** A venue browses starters or their own saved templates.
2. **A Client's event → Event Order tab.** Empty state: *"No Event Order yet"* with a **Start blank** / template dropdown and **Start Event Order** button.
3. **Apply a template (optional).** `ensureEventOrder` copies each template section's name and each line's description/quantity/price into new, independent rows, every copied line stamped `provenance: 'custom'` — a real copy, confirmed live, not a reference. Applying with no template creates a genuinely empty order.
4. **Edit.** Sections and lines can be added, removed, and (for lines) priced — each Package- or Inventory-sourced line carries a real `package_id`/`inventory_item_id` FK; custom lines carry neither. All edits save immediately; there is no separate "save" step.
5. **What's required vs. optional:** the only hard requirement to finalize is at least one line (`lines.length > 0`) — **nothing requires a nonzero price on any line.**
6. **What remains live-linked vs. becomes committed:** once a line references a Package or Inventory item, its price is copied at that moment — confirmed live in the prior audit's companion document (`booking-financial-architecture-final-release-assessment.md`): raising a Package's catalog price afterward does not move an already-committed line.
7. **If the source template changes afterward:** nothing — the instance owns its own copied data; there is no sync path back to the template.
8. **If Packages/Inventory change afterward:** only future lines added from the updated catalog reflect the change; already-committed lines are unaffected, per the same copy-at-commitment proof above.
9. **Finalize.** `status` moves `open → finalized`, `revision` increments, both an application-layer guard and independent Postgres triggers on sections and lines now block any further mutation.
10. **Release/share.** A separate, explicit **Share with Client** action — confirmed only reachable in the UI once `isFinalized` is true — with its own honest copy: *"Applying a Library template earlier only built this working order — Share is what makes it visible to the client."*
11. **Client experience:** see below — new tracing in this pass.
12. **Final document/PDF:** a real PDF download path exists, reachable once both finalized and shared.
13. **Post-finalization:** a **Reopen for Editing** action exists, symmetric and logged, un-locking the same double-enforced protections until finalized again.

---

## Client Experience

**Newly traced in this pass — not covered in the prior audit.** A real, dedicated Couple Portal component exists (`components/portal/event-order-section.tsx`), backed by a real API route (`/api/portal/event-order`) and a real database RPC (`get_event_order_for_portal`).

- **The trust boundary is enforced at the database level, not just the UI**, confirmed by reading the RPC body directly: it returns rows **only when `shared_at is not null`** — a client hitting the API before the venue shares anything gets an empty result, not a preview of a draft.
- **What the client sees:** a read-only list of sections and priced lines, a running total, and a single badge reading **"Ready"** — confirmed the component does not distinguish `open` vs. `finalized` status in its own display logic, though this is moot in practice since sharing itself is already gated behind finalization in the venue-side UI.
- **What the client can do:** nothing but read. No acknowledge, approve, sign, or comment mechanism exists — confirmed intentional, not missing, per the component's own comment citing a prior, explicitly confirmed decision not to build Event Order collaboration.
- **Relationship to Contracts, Invoices, Payments:** none, directly — confirmed no shared route, token, or data dependency between this portal section and any of those three. It is purely informational.
- **The same $0 risk applies here too:** if a venue finalizes and shares an Event Order whose lines are all zero-priced, the couple sees a real, formatted "Total: $0.00" on their own screen — this is the client-facing half of the Default Starter issue below, not a separate finding.

---

## Template Model

Confirmed, precisely, in this pass: `lib/event-order-templates/starters.ts` is code, not data — two masters, `EO-01` ("Standard Wedding Event Order") and `EO-02` ("Standard Wedding — Reception Only"), each a pure structure of section names and line descriptions. Provisioning (`provisionEventOrderStarters`) is confirmed idempotent and safe: it checks for an existing row by `source_master_key` first, then by exact name, before ever inserting — and its own code comment explicitly anticipates exactly the kind of leftover test data found in this account: *"Preserve customized / pre-existing same-named templates (e.g. D7 leftovers)."* A venue can archive or delete any template freely (`setTemplateArchived_`, `deleteTemplate_`, both real, both confirmed in the service layer).

---

## Default Starter Assessment

**This is the most important diagnosis in this document, and the root cause is different from what a surface reading of "$0.00 total" would suggest.**

1. **Why does the starter contain these items?** By deliberate design. The source file's own header comment states plainly: *"Structure only: section names + starter operational lines. No fake dates, guest counts, venues, vendors, or prices."*
2. **Are they examples, placeholders, or commitments?** A checklist structure — confirmed every single line is generated through one shared helper that hardcodes `quantity: 1, unitPrice: 0` for every item, without exception.
3. **Does applying it create real line items?** Yes — 139 real, independent `event_order_lines` rows, confirmed live in the prior audit.
4. **Are the $0 prices inherited from anything?** No — they are the deliberate, literal default in the starter's own code, not a bug, not a broken lookup.
5. **Is there a distinction between an example line, a real catalog item, and a committed line?** Yes, at the data level — `provenance` is `'custom'` for every starter-sourced line versus `'package'`/`'inventory'` for catalog-sourced ones — **but nothing in the UI surfaces this distinction to the venue.**
6. **Does the UI communicate the "checklist, not pricing document" intent?** No. The panel's own header says, unconditionally: *"The single record of what this event will actually receive. Running total: $0.00."*
7. **Can a venue accidentally finalize/share this exactly as-is?** Yes, confirmed — finalize is blocked only by `lines.length === 0`, which 139 checklist lines do not trigger.
8. **Is there any validation against an obviously incomplete Event Order?** None found.
9. **Is $0 ever a legitimate real value for a line?** Yes, plausibly — a complimentary or already-included item. This is exactly why the fix cannot be "require every line to have a price," which would break a legitimate use case; the fix has to be about disclosure and intent, not a blanket price requirement.
10. **Where does the problem actually live?** **A combination, precisely apportioned:** the *template content itself is correct and intentional*, not the problem. The gap is **template UX** (nothing tells a venue this starter is a checklist to price out, not a ready document) and **finalization/release validation** (nothing warns before finalizing or sharing a document whose total is suspiciously zero despite having real lines).

---

## Feature Flag Assessment

Confirmed exhaustive by grep, unchanged from the prior audit and re-verified in this pass: exactly four references (`app/(app)/clients/[id]/page.tsx`, `lib/venue/repository.ts`, `lib/venue/types.ts`, `components/events/event-detail.tsx`). `false` hides the Event Order tab entirely and skips fetching its data; it does **not** affect Library visibility — Event Order Templates remain fully visible and usable in Library regardless of the flag's value, confirmed by inspecting `app/(app)/library/page.tsx`'s own data-fetching, which has no dependency on `eventOrderEnabled` at all. `true` unlocks only the tab and one readiness check; nothing else in the product reacts to it. Confirmed idempotent-safe to flip either direction: enabling creates nothing automatically (no backfill, no batch job — confirmed no such call site exists anywhere), and disabling again after use does not delete or corrupt any already-created Event Order data, since the tab's visibility and the underlying rows are entirely independent. **There is no existing admin or venue-facing infrastructure anywhere in the codebase that reads or writes this flag other than a direct database update** — confirmed by the same exhaustive grep; no HQ admin page, no Settings section, nothing.

---

## Trust / Immutability Assessment

Independently re-verified in this pass, not merely re-cited: `event_order_sections_enforce_finalized_immutability` and `event_order_lines_enforce_finalized_immutability`, read via `\sf` directly, are real `BEFORE INSERT OR UPDATE OR DELETE` triggers that raise a hard Postgres exception (`errcode 23001`) whenever the parent order's `status = 'finalized'` — enforcement that exists independently of the application layer and would block even a direct, non-UI write. The application layer's own `assertOpen` guard is confirmed present on every single mutating function in `lib/event-orders/service.ts`, no exceptions found. **Nothing in the UI was found to claim protection it doesn't have** — the one thing that looks informational but isn't independently protected is the client-visible "Ready" badge (it doesn't reflect real status), but this is a display simplification, not a false trust claim, since the underlying data genuinely cannot be edited once finalized regardless of what any badge says.

**What becomes immutable, and when:** every section and every line, the instant `status` becomes `'finalized'`, enforced identically at the application and database layers.

---

## Test Coverage

Confirmed, unchanged from the prior audit: no automated test file exists for `lib/event-orders/` — only `lib/event-order-templates/starters.test.ts`, which validates starter *content* shape, not live domain behavior.

**Minimum high-value regression scenarios, sized to what the implementation actually does — not a generic test-everything list:**

1. Applying a template copies sections/lines as independent rows, not references.
2. Applying with no template creates a genuinely empty order.
3. Editing (add/remove line or section) is blocked once finalized — both the service-layer guard and, separately, the database trigger.
4. Finalize requires at least one line; succeeds otherwise regardless of price.
5. Reopen is blocked unless currently finalized; succeeds otherwise and correctly re-permits edits.
6. A committed line's price does not change when its source Package/Inventory item's catalog price changes afterward.
7. A template edited after being applied does not retroactively change any already-created instance.
8. Share is only reachable once finalized (service-layer, not just UI).
9. The portal RPC returns nothing for an Event Order that has never been shared, and the correct data once it has.
10. Flag `false` hides the tab and skips data fetching; flag `true` renders it; neither state touches unrelated data.

---

## New Venue Experience

**What would they think Event Orders are?** Reasonably guessable from the tab's own header — *"The single record of what this event will actually receive"* — but a first-time venue has no in-product cue for *when* to reach for this versus Packages, Inventory, or the event's own Documents tab.

**Where would they discover them?** Library → Planning (templates) or the event's own tab (once/if enabled) — both confirmed clear and consistent with this product's existing definition-vs-instance pattern.

**Would they understand the relationship to Package/Inventory/Contract/Invoice?** Partially — the `provenance`-tracked lines make the *data* relationship correct, but nothing in the UI explains it in plain language anywhere a venue would read before their first use.

**Could they accidentally create a misleading client-facing document?** **Yes, confirmed directly** — this is the Default Starter Assessment finding, restated from the new-venue's specific vantage point: their very first, most obvious action (apply the default starter, finalize, share) produces exactly this outcome.

**Is the current feature self-explanatory enough?** Mostly, with the one specific, scoped exception above — not a broad comprehension failure.

---

## Risks

Only real risks, not theoretical ones:

- **A venue finalizes and shares a $0.00-total document with a real couple**, confirmed possible today, confirmed to look identical to a genuinely complete one from both the venue's and the couple's screens. This is the one risk in this entire assessment with real reputational weight if it reaches a real customer.
- **No regression protection** if this code is touched again before broad exposure, given zero automated tests today.
- **No operational control exists to enable it safely for anyone**, which is a rollout risk (§ below), not a data-safety risk — confirmed enabling/disabling is otherwise inert and reversible.

Explicitly **not** risks, confirmed by this and the prior pass: data loss, cross-venue leakage, silent financial drift, or any gap in the immutability model.

---

## Minimum Safe Release

### P0 — must fix before any venue exposure

1. **Problem:** the default starter's checklist nature is invisible in the UI, and nothing blocks finalizing/sharing a document with a real total of $0 despite having real lines.
   **Why it matters:** this is the one plausible path to a real customer seeing a broken-looking, unpriced "official" document.
   **Evidence:** `starters.ts` header comment + live confirmation, both in this pass.
   **Smallest safe fix:** a plain warning at finalize and/or share time when the total is $0 but lines exist ("This Event Order has no pricing yet — share anyway?") — a UI/validation addition, not a data model or template content change.
   **What can remain unchanged:** the starter content itself, which is well-designed and intentional; the immutability and release architecture.

2. **Problem:** zero automated test coverage for live domain logic.
   **Why it matters:** regression risk the moment this code is next touched, right before its first real exposure.
   **Evidence:** file-system confirmed, both passes.
   **Smallest safe fix:** the ten scenarios listed above — no new test infrastructure, this domain already has everything needed to test it the same way adjacent domains in this codebase are tested.
   **What can remain unchanged:** everything the tests would be verifying, since it's already confirmed correct by hand.

### P1 — should fix before broad rollout

3. **Problem:** no real control (venue Settings or HQ) exists to turn the flag on for anyone.
   **Why it matters:** without one, "broad rollout" can only mean a single irreversible-feeling global flip, or continued direct database edits — neither is an operable rollout mechanism.
   **Smallest safe fix:** one control, in whichever surface fits this product's existing pattern best (this document does not choose).

4. **Problem:** the leftover "D7A Test Wedding Template" duplicate rows in this seeded account.
   **Why it matters:** cosmetic, isolated — confirmed via direct query to be dev-only test data in one account, not a systemic risk, and confirmed the provisioning system already safely ignores it.
   **Smallest safe fix:** delete the two rows in this account (data hygiene, not a code change) before this specific account is ever used to demo the feature.

### P2 — polish / future

5. The client-facing "Ready" badge could reflect the real revision/shared-at timing for a more informative couple-facing view — not required, since the trust boundary is already fully enforced without it.
6. In-product, plain-language explanation of Event Order's relationship to Packages/Inventory/Contracts, for first-time venue comprehension — a Help & Guides topic, not a code change (already named as a future Help topic in this engagement's prior P0 content pass).

---

## Rollout Options

**A — Keep disabled.** Gives up nothing functionally (no venue currently depends on it), but leaves the P0 gap unaddressed indefinitely and Event Order Templates sitting in Library implying a capability that doesn't work — real, accumulating product debt, not neutral.

**B — Enable for all venues.** Requires both P0 items closed first; without them, this is the option most likely to produce the one real risk named above, at full scale, on the first day.

**C — Enable selectively.** Requires a real per-venue control (P1 item 3) — the current flag is a genuine per-venue boolean, so it *can* safely support this once a control exists; it cannot today, because nothing can set it except a direct database write.

**D — Soft launch.** The smallest safe cohort is a handful of real or beta venues, specifically chosen to include at least one that will exercise the default starter, watching specifically for the P0 scenario (a zero-priced document reaching a real client) as the success/failure signal — not general usage volume.

---

## Recommended Rollout

**Close the two P0 items, then D — a small soft-launch cohort, not a global flip —** using the flag exactly as it was originally designed to be used (this engagement's own prior research already confirmed it was modeled deliberately on a proven, reversible, per-venue rollout pattern already used once in this codebase). Building the P1 control is a prerequisite for D to be operable at all, not an optional nice-to-have alongside it.

---

## Exact Implementation Scope

If remediation proceeds: (1) a finalize/share-time warning when total is $0 despite having lines — UI and one validation check, no schema change; (2) the ten test scenarios listed above; (3) one enablement control (Settings and/or HQ — a product decision, not resolved here); (4) delete two specific rows in one seeded account. Nothing else.

---

## Explicitly Deferred

Anything tempting that should **not** be part of this work: redesigning the starter content, adding required-price validation to every line, building Event Order approval/signature/collaboration of any kind, connecting Event Order directly to Contracts or Invoices beyond the existing Invoice FK, building a general "Event Order health check," or expanding the client portal view beyond read-only. None of these are evidenced as needed; all would expand scope well beyond what this assessment found broken.

---

## Acceptance Criteria

Readiness is proven when: (1) applying the default starter and finalizing/sharing it without adding any pricing surfaces a real, visible warning rather than silently succeeding; (2) the ten regression scenarios in Test Coverage pass as real, committed automated tests; (3) at least one real control exists to enable the flag for a specific venue without a direct database write; (4) the two duplicate template rows in the research account are gone. All four are small, verifiable, and do not require re-opening this document's own conclusion that the underlying architecture is already sound.

This document ends here. No code, schema, migrations, Library, navigation, or UI were changed in producing it, and Event Order was not enabled for any venue.
