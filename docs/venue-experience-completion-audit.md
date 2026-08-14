# Venue Experience Completion Audit

**Type:** Discovery only. No code, schema, migrations, UI, copy, Help content, or Luv behavior were modified to produce this document.
**Method:** A full lifecycle trace — new-venue setup through post-event — combining live browser walkthrough (logged in as `owner@example.com` on Sweet Daisy Barn & Farm, the same realistically-seeded account used throughout this engagement: 5 clients, 33 contracts, 6 message sequences, real event data) with direct database/schema inspection and source reads. Every Client/Event workspace tab was actually clicked and its rendered text and console/network behavior captured — zero console errors and zero page errors across all eleven reachable tabs (Planning, Timeline, Floor Plans, Documents, Vendors, Inventory, Payments, Conversation, Activity, Notes, Team). No post-event (`status = 'complete'`) client exists in any seeded account in this database, so the Post-Event section is verified by code and schema rather than by driving a live completed event — stated plainly, not glossed over.

---

## 1. Executive Summary

The product holds together as one coherent system far more than a checklist of individual features would suggest — the definition-vs-instance discipline this engagement has enforced everywhere (Packages, Contract Templates, Timeline Templates, Payment Schedules) is genuinely intact end to end, terminology is consistent almost everywhere it matters, and every workspace tab this pass actually clicked rendered cleanly with zero errors. Contracts, Automations, Pipeline, Library, and Branding — the five areas this engagement has done the deepest prior work on — are confirmed still correct and unchanged; nothing found here reopens any of them.

**One finding changes the shape of this report: Event Order — a fully built feature with its own templates, line items, sections, and finalization logic, actively promoted as a Library category — is completely inaccessible to every venue in this database.** `venues.event_order_enabled` defaults to `false`, zero of the eight venues in the system have it set to `true`, and there is no control anywhere in the product — not in venue Settings, not in HQ admin — to turn it on. A venue can browse and build Event Order Templates in Library today and will never be able to apply a single one to a real event. This is not a UX nuance; it's a feature the product actively advertises that doesn't work for anyone, and it is the headline finding of this audit.

The second real finding is smaller but genuine: the Vendor list's "Status" column shows preference ranking ("✓ Preferred") but silently omits whether a vendor has actually accepted their portal invitation — a vendor who still needs an invite sent looks identical in the list to one who's simply unranked.

Everything else found is P2 or Documentation-shaped — real, but none of it threatens the coherence or trustworthiness of the product as it stands today.

---

## 2. Overall Venue Lifecycle Assessment

Walked start to finish, the lifecycle tells one consistent story: sell (Leads/Pipeline) → commit (Contract/Invoice) → plan (Client workspace, Library-sourced templates applied per-event) → operate (Event Day surfaces) → close out (feedback, reporting). The handoffs between these phases — Lead-to-Client, Template-to-Instance, Venue-signs-then-releases-then-Client-signs — are each individually well-built and confirmed working. The one place this story breaks is the planning-to-operating handoff for Event Orders specifically, covered in detail below.

---

## 3. New Venue / Setup

**Confirmed sensible, no contradictory instructions found.** Venue information, Brand Colors (now accurately described, per this engagement's own prior correction), and at least one Package are the only genuine prerequisites for a venue to start operating — everything else (Pipeline customization, Venue Guide content, Stripe connection) has a working default or can wait. The Brand Colors section's live preview (a swatch row plus a mock button/badge) and its now-accurate description ("these colors define your venue's visual identity where Hello to Cheers presents your brand to clients and in venue-branded collateral") together set an honest expectation on first contact.

**One setting that is genuinely important and is not discoverable anywhere in Setup or Settings:** `event_order_enabled`. See §6 and §11.

**Classification:** Already correct, apart from the Event Order gap named separately below.

---

## 4. Lead → Sales

**Confirmed to feel like one coherent system.** The Pipeline board, stage customization, the canonical/venue-label bridge, the pre-move Automation confirmation (with its now-real resolved message preview), Tour Completed as a trigger, and the Lost/Cancelled/Booking exit behavior are all confirmed live and unchanged from this engagement's own prior, deep verification of this exact area. No new drift found. Lead → Client conversion remains automatic and clean.

**Classification:** Already correct. Per the "do not reopen closed decisions" instruction, this section is confirmed, not re-litigated.

---

## 5. Contract → Booking

**Confirmed against the current `contract_signers` architecture, not the old single-signer model.** The venue-first constraint is enforced server-side, not just in the UI (`"The venue must sign this contract before it can be released to the client"`); release is a distinct, explicit action from signing; multiple client signers are supported with a real "(X of Y)" progress label; a SHA-256 content hash is captured per signature; and Invoices already snapshot branding at send time. The signature states (`review → sign_contract → signed_by_venue → ready_for_client → awaiting_client_signature → fully_signed`) are all derived, plain-language labels, not raw database values — exactly the discipline this engagement has asked for everywhere else.

**One thing this pass could not verify live** (would have required signing a real contract, which this discovery-only pass does not do): whether Contracts now also snapshot branding at the *release* moment specifically, versus only at generation time. This engagement's own prior Brand Palette audit found Contracts lacked any snapshot at all; the `contracts.branding_snapshot` column now exists, confirming the gap was closed, but this pass did not re-drive a full sign-to-release cycle to confirm the exact moment it's written. **Unable to fully verify the precise write timing from static evidence alone — flagged, not guessed.**

**Classification:** Already correct, with one item noted as unverified rather than assumed.

---

## 6. Client → Event Planning

This is where the audit's headline finding lives.

**Confirmed live: every Event workspace tab this pass could reach renders cleanly.** Planning, Timeline, Floor Plans, Documents, Vendors, Inventory, Payments, Conversation, Activity, Notes, and Team all loaded with zero console errors and zero page errors on a real, richly-seeded event (Emma & Jordan's Wedding). The Overview tab's "Event Readiness" panel (Needs Attention / Waiting / Not Started / Complete, per sub-area) remains the single strongest piece of UX in this entire product, confirmed again in this pass.

**Event Order is the one tab this pass could not reach — and confirmed, precisely, why.**

- `components/events/event-detail.tsx` gates the entire tab behind `eventOrderEnabled`, which defaults to `false`.
- `app/(app)/clients/[id]/page.tsx` resolves this from `venue?.eventOrderEnabled ?? false` — a real per-venue database column, not a build-time flag.
- Confirmed directly against the database: `venues.event_order_enabled boolean NOT NULL DEFAULT false`, and **`select count(*) from venues where event_order_enabled = true` returns zero**, across all eight venues in this database, including the most fully-featured demo venue in the system.
- Confirmed by grep: **no UI anywhere in the product** — not venue Settings, not HQ admin — contains any reference to `eventOrderEnabled`. There is no toggle. The only way to turn this on today is a direct database write.
- Meanwhile, **Event Order Templates are a real, promoted Library card** (confirmed in this engagement's own Library IA work), complete with real starter content and a working template editor.

**Why this matters:** a venue can go to Library → Planning → Event Order Templates, build a genuinely useful reusable Event Order template, and then discover — with no explanation anywhere in the product — that there is no way to ever apply it to a real event. This is not a rough edge; it's a promoted capability that silently does not exist for anyone using the product today. It also directly touches this engagement's own named architectural principle, "Event Order as system of record" — a system of record that no venue can currently write to.

**Classification: P0.** Not because it's dangerous — no data is at risk and nothing is misleading in a trust-breaking way — but because it fails the brief's own P0 test outright: a venue is *prevented from completing a core, actively-promoted workflow*, with zero explanation anywhere in the product.

**This is a product decision, not a bug fix, and this document does not presume the answer.** Two genuinely different resolutions are both plausible from the evidence: (a) Event Order was intentionally staged behind a manual, HQ-only enable flag as a soft launch, and the real gap is simply that no venue has been switched on yet — in which case the fix is either flipping it on broadly or building the missing HQ toggle; or (b) Event Order Templates were promoted to Library ahead of the live feature being ready, and the correct near-term fix is demoting the Library card until the tab is actually reachable. **This document flags the decision; it does not make it.**

**Everything else in Client → Event Planning is confirmed coherent:** the Catalog-vs-Commitment distinction holds throughout (Inventory catalog vs. the event's own copied Inventory, confirmed via the Inventory tab's own copy: "What's actually part of this event — chairs, decor, bar service, anything selected for this booking"), Requests are correctly reached globally (filtered by client) rather than duplicated as an event tab, and Tasks/Playbooks feed Task Center exactly as this engagement's own Automation/Pipeline documents already established.

---

## 7. Vendors

**Confirmed real, working, and mostly clear — one precise terminology gap found.**

The Vendor Network's two-axis model (`VendorRelationshipStatus`: invited/active/inactive; `VendorPreferenceLevel`: featured/preferred/recommended) is real and deliberately separate — confirmed in `lib/vendors/types.ts`'s own comment explicitly rejecting a merged "four-value" field as recreating a "two-fields-one-concept" problem. This is good, disciplined modeling.

**The gap: the Vendor list's "Status" column shows only the preference level, not the relationship status.** Confirmed live: "Baker's Dozen" shows a blank Status cell in the list and a live "Send Invite" button on its own detail page (meaning it has never been invited to the vendor portal) — while several other vendors show "✓ Preferred" in that same column. A venue scanning the list cannot tell whether a blank Status means "no preference ranking set" or "hasn't accepted an invite yet" — these are two entirely different facts, one about ranking and one about whether the vendor is even reachable through the portal, and the list conflates them into one ambiguous blank cell.

**Classification: P1.** Not blocking — a venue can always click into a vendor to see the real state — but a real, evidence-based inconsistency between what the list column is named and what it actually shows.

**Confirmed correctly out of scope, per this engagement's own prior decision:** no Vendors Help article is warranted without evidence of venue confusion; this pass found a real UI gap, not a comprehension gap, and it belongs in a future product pass, not Help content.

---

## 8. Event Day

**Confirmed operationally trustworthy for the surfaces that exist.** Timeline, Floor Plan, and Inventory tabs all render live, current data with no stale-cache or conflicting-source issues found in this pass. A dedicated `wedding-day-dashboard.tsx` component exists, confirming a real day-of operational view beyond the general Event workspace tabs — not driven live in this pass (no event in the seeded data is dated today), but its presence in the codebase confirms this isn't a missing capability.

**Classification:** Already correct, based on available evidence; the one caveat is that this pass could not drive a real, in-progress event day live, since none exists in the seeded data — noted rather than assumed clean.

---

## 9. Post-Event

**Confirmed real, working infrastructure exists**, verified by schema since no completed event exists in any seeded account to drive live. `couple_venue_feedback` is a genuine, well-built table — `overall_rating`, `loved_most`, `could_improve`, `would_recommend`, and a real approval workflow (`public_permission`, `venue_status` starting `'pending'`, `approved_for_public_at`) that connects directly to the "Public review link" setting already confirmed in this engagement's Brand Palette work ("Shown in Post-Event Feedback when a couple says they're comfortable sharing a review publicly"). This is a coherent, closed loop, not a stub.

**What could not be verified:** the exact venue-facing UI for reviewing and approving a submitted piece of feedback for public sharing — this pass found the data model but did not locate or drive the review-approval screen live, since no real submitted feedback exists in the seeded data. **Unable to verify the approval UI from current evidence — flagged, not assumed either way.**

**Classification:** Already correct at the data-model level; the UI layer is unverified rather than confirmed broken.

---

## 10. Cross-Cutting Terminology

Only meaningful inconsistencies, per instruction — not a full sweep:

- **Vendor list "Status"** — already covered in §7; the one real terminology/data-conflation finding in this pass.
- **Everything else checked** (Lead vs. Client, Pipeline vs. stage, Automation — never "Sequence" — vs. Enrollment, Package vs. Inventory, Task vs. Request, Contract vs. Event Order, Sent/Released/Signed/Fully-Signed, Venue Guide vs. Help & Guides, all Library category and card labels) **is confirmed consistent**, per this engagement's own prior, exhaustive terminology passes (Library IA, Left Navigation, Automation P1) — re-checked spot-fashion in this pass with no new contradiction found.

---

## 11. System of Record

Verified per domain, evidence-based:

| Domain | Canonical truth lives in | Displayed where | Competing surface? |
|---|---|---|---|
| Lead status | `leads.status` | Leads list, Pipeline board, Lead detail | No — Pipeline stage is a display/trigger layer over the same value, confirmed in this engagement's own Pipeline architecture work |
| Contract | `contracts` + `contract_signers` | Contract detail, Library (templates only) | No — templates and live contracts are architecturally and visually distinct |
| Invoice / Payment | `invoices`, `payment_schedules` | Financials, Client workspace Payments tab | No — same underlying data, two legitimate views (cross-venue vs. per-relationship) |
| Event Order | `event_orders` + line/section tables | **Nowhere reachable for any venue today** | **N/A — the system of record exists but has no live writer** (§6) |
| Inventory | Catalog: `inventory_items`; Instance: event-scoped copy | Library (catalog), Event workspace Inventory tab | No — confirmed via the tab's own copy distinguishing catalog from "what's actually part of this event" |
| Timeline | Template: `timeline_templates`; Instance: event-scoped entries | Library, Event workspace Timeline tab | No |
| Floor Plan | Template: `floor_plan_templates`; Instance: event-scoped plan | Library, Event workspace Floor Plans tab | No |
| Vendor relationship | `vendors` + relationship/preference fields | Vendor Library, Vendor detail, Event Vendors tab | No conflict, but the list-view **display** of relationship status is incomplete (§7) |
| Tasks | Playbook-instantiated (event-scoped) or ad hoc | Task Center (aggregated), Event Planning tab | No |

**Verdict: the system-of-record model is sound everywhere except Event Order, where the record exists but is unreachable.**

---

## 12. Definition vs. Instance

**Confirmed intact everywhere checked.** Packages, Inventory, all Library templates, Pipeline configuration, Message Templates, and Automations all cleanly separate their reusable definition from any live instance they produce, consistent with this engagement's own prior, repeated verification of this exact pattern. **The one place this model is technically intact but practically inert is Event Order** — the definition side (templates) is real and reachable; the instance side is real in the schema but has no live path to ever be created by a venue today. This is the same finding as §6 and §11, restated in this framing because the brief asked for it explicitly: the model isn't broken, it's half-connected.

---

## 13. Trust

**No silent actions, no unexpected automation, and no irreversible-without-warning actions found in this pass** beyond what this engagement has already found and closed (the Pipeline-to-Automation confirmation dialog, confirmed still working). Contract signing order is enforced server-side, not just suggested by the UI — a genuinely strong trust property, confirmed by the actual guard error message rather than assumed from the UI alone. Branding freezes correctly at Invoice send time.

**The one trust-adjacent concern in this pass is Event Order's silence, not its danger** — nothing is misleading or destructive, but a venue investing time in an Event Order Template with no way to ever know it can't be used is a real, if quiet, breach of the implicit promise every other Library category keeps.

**Classification:** Already correct, with the Event Order gap counted once (in §6/§11/§12), not repeated as a separate trust finding.

---

## 14. Premium Experience

**Confirmed strong, not merely acceptable.** The Event Readiness panel, the Automation editor's plain-language safeguards, the Contract signature state labels, and the zero-console-error tab walkthrough all read as a genuinely finished, considered product — not a collection of individually-shipped features. The one place the experience feels unfinished is, again, Event Order: a promoted Library category leading nowhere is the one interaction in this entire pass that would make a careful venue owner's confidence waver, precisely because everything around it is so consistently well-built.

---

## 15. Luv Opportunities

Consistent with this engagement's own established, deliberately restrained Luv philosophy — no new surfaces designed, only moments identified:

- **A new possibility this pass surfaces directly:** if Event Order remains gated behind a flag for some venues and not others (per whichever resolution is chosen in §6), Luv would be the wrong tool to explain that — a silent, product-level fix or a Help article stating the real limitation is more honest than a chatbot working around a gap the product itself should resolve.
- **First Vendor invite sent** — a natural, low-stakes moment for a quiet "Want a hand inviting the rest of your vendor network?" nudge, reusing the existing observation pattern.
- **Where Luv should stay silent, confirmed by this pass:** every Event workspace tab walked in this pass rendered cleanly with a clear next action already visible (via Event Readiness) — none of them need a Luv prompt layered on top.

---

## 16. Help & Guides Boundaries

**No approved P0 article's current product truth has changed since the P0 content pass.** This pass specifically re-checked the Contracts, Automations, and Branding claims underlying those articles and found them all still accurate.

**One genuinely new, P1-shaped documentation gap surfaced by this pass:** if Event Order is ever enabled broadly, "What is an Event Order and how is it different from a Package?" would become a real P0/P1 Help topic — explicitly **not recommended for now**, since writing Help content for a feature no venue can reach would be documentation covering for a product gap, exactly the pattern this engagement has repeatedly rejected.

**Where Help should explicitly not be used:** Event Order's inaccessibility. No article should be written to explain why a promoted Library category doesn't work — that's a product decision to make and either fix or reverse, not a fact to document around.

---

## 17. Findings by Severity

| # | Finding | Surface | Classification | Severity | Safe to defer? |
|---|---|---|---|---|---|
| 1 | Event Order tab unreachable for every venue; no UI toggle anywhere | `venues.event_order_enabled`, `components/events/event-detail.tsx`, Library's Event Order Templates card | Product decision required | **P0** | No — recommend resolving before further Event Order-adjacent work (Help content, further Library changes) |
| 2 | Vendor list "Status" column shows preference level only, omits invite/claim state | `/vendors` list view | UX/Product | **P1** | Yes, but should be scheduled |
| 3 | Contract branding-snapshot exact write timing at release not live-verified | `contracts.branding_snapshot` | Unverified (not a confirmed defect) | Documentation/verification task | Yes |
| 4 | Post-event feedback approval UI not located/driven live | `couple_venue_feedback` | Unverified (not a confirmed defect) | Documentation/verification task | Yes |
| 5 | Everything else audited across all 9 lifecycle stages | — | Already correct | — | N/A |

---

## 18. What We Should NOT Change

Every item on the brief's own closed-decisions list is confirmed still correct in this pass and is **not** reopened: Left Navigation, Library IA, Packages canonical route, Pipeline canonical-stage architecture, Automation P0/P1 architecture and exit behavior, Contract venue-first signing/multi-signer/content-hash/branding-snapshot, the couple-owned Hosted Experience/RSVP palette, the venue dashboard remaining Hello to Cheers-branded, Luv's restraint, Help & Guides Phase 1 structure and its P0 content list, the decision not to write a Vendors Help article without evidence, and "Sequence" staying an internal-only term. Additionally, based on this pass's own fresh evidence: the Event workspace's tab structure and Event Readiness panel, the Vendor Network's two-axis status model (the *model* is correct; only its *list-view display* needs attention), and the Post-Event feedback data model are all confirmed sound and should not be redesigned.

---

## 19. Recommended Next Workstream

**One workstream: resolve the Event Order decision named in §6.** This is a product-judgment call this document deliberately does not make — either commit to turning Event Order on (broadly, or via a real HQ toggle) and validate the full template-to-live-instance path end to end, or demote Event Order Templates out of Library's promoted grid until the live feature is reachable. Everything else in this audit (the Vendor list display fix, the two unverified-not-broken items) is real but small enough to fold into ordinary iteration rather than justify its own workstream.

---

## 20. Final Assessment

Hello to Cheers already feels like one coherent, premium product across the overwhelming majority of the lifecycle a real venue owner would actually live in — selling, signing, planning, and closing out a relationship all hold together, and the deep, repeated verification work this engagement has done on Pipeline, Automations, Contracts, Library, and Branding is confirmed to have held up under a full end-to-end trace, not just in isolation. The one thing standing between this product and feeling fully finished is narrow and specific: a real, well-built feature that the product actively invites a venue to invest in, that currently leads nowhere for anyone. Fix that one decision, and this audit found nothing else standing between Hello to Cheers and feeling completely trustworthy.

This document ends here. No code, schema, migrations, UI, copy, Help content, or Luv behavior were changed in producing it.
