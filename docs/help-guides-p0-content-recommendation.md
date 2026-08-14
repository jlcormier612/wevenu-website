# Help & Guides — P0 Content Recommendation

**Type:** Content architecture/product discovery only. No articles, code, schema, taxonomy, search, or Luv behavior were added or modified to produce this document.
**Method:** Read `docs/new-venue-morning-ux-audit.md`, `docs/new-venue-morning-p1-prioritization.md`, `docs/help-and-guides-phase-1-implementation.md`, `docs/library-ia-final-decision.md`, `docs/automation-sequence-p1-product-recommendation.md`, and `docs/automation-sequence-p1-implementation.md` in full. Every claim about current product behavior below was then independently re-verified against the live database schema and current source — `contracts`/`contract_signers` tables read via `\d`, `lib/contracts/signers.ts` read in full, the Stripe Connect settings section, the Floor Plan editor's actual toolbar icons and tooltip text, invoice status constants, and the current live Brand Colors setup copy. Nowhere below repeats a prior document's claim without having checked whether the current tree still agrees with it.

---

## 1. Executive Summary

The product has moved substantially since the original Help & Guides content inventory was written, in ways that make roughly a third of the original 18 P0 candidates stale and create several genuinely new, higher-value ones. Most importantly: the setup copy this engagement previously flagged as overpromising ("displayed throughout your workspace") **is already fixed** in the current tree — it now reads "these colors define your venue's visual identity where Hello to Cheers presents your brand to clients and in venue-branded collateral," which is accurate. Contracts now have a real, sophisticated multi-signer model (`contract_signers`, venue-first enforced server-side, a SHA-256 content hash captured at signing, plain-language derived states like "Ready for client") that did not exist when the original content inventory was written — any Help content written against the old single-signer model would now be actively wrong. Automations gained a Tour Completed trigger and true per-enrollment pause/resume since the original inventory, both real, both worth their own short articles. Floor Plan Studio's toolbar already has hover tooltips on every icon, including the least obvious one (the magnet, labeled "Snap to grid: on/off") — meaning the original "icon meaning" framing is now partly solved by the product itself, and the real remaining gap is workflow-level ("why can't I move this," "how do I reorder overlapping objects"), not icon literacy.

**Final recommendation: 18 P0 articles** — the same target size as the original inventory, but a meaningfully different list, re-derived from current evidence rather than carried forward. Two topics from the original list are recommended to **not** be written at all, because the underlying product behavior looks like a UX gap that documentation would only paper over (detailed in §4 and §8).

---

## 2. Current Help & Guides State

Confirmed directly: `/help`, 12 task-oriented areas (`lib/help-guides/areas.ts`), a persistent Overview nav entry, the legacy `/success-library` redirect, and **six** published articles today — the five migrated Success Library articles plus "Getting Started: Your First Morning," added during the New Venue Morning P0 pass. No search, no related-article engine, no feedback mechanism, no contextual/Luv integration — all confirmed still true and all explicitly out of scope for this pass, consistent with the brief.

---

## 3. What Has Changed Since the Original Audit

| Area | What changed | Source verified |
|---|---|---|
| **Pipeline** | Unchanged in substance — venue-customizable stage names/order, canonical `LeadStatus` underneath, stage colors are functional UI (not brand) colors. Confirmed no drift. | `lib/pipeline-templates/*`, live board |
| **Automations** | Gained a **Tour Completed** trigger, **per-enrollment pause/resume** (`sequence_enrollments.paused_at`/`resumed_at`), and a **resolved message preview** in the pre-move confirmation dialog — none of these existed at the time of the original content inventory | `docs/automation-sequence-p1-implementation.md`, confirmed live in `lib/message-sequences/types.ts` |
| **Contracts** | Gained a real **`contract_signers`** table — venue-first signing enforced server-side ("The venue must sign this contract before it can be released to the client"), an explicit **release** action distinct from signing, support for **multiple client signers**, and a SHA-256 **content hash** captured per signature. The single-signer model the original inventory would have described no longer exists. | `contract_signers` schema, `lib/contracts/signers.ts`, `lib/contracts/service.ts` |
| **Branding** | The setup copy this engagement previously flagged as inaccurate **is already corrected** — confirmed live, no trace of "displayed throughout your workspace" remains anywhere in the tree | `components/settings/venue-settings.tsx` |
| **Library** | IA fully closed (`docs/library-ia-final-decision.md`) — Inventory moved to Planning, Packages page title corrected, Library home description revised. Help content must reflect the closed structure, not the pre-decision one. | `docs/library-ia-final-decision.md` |
| **New Venue Morning remediation** | The Pipeline Templates page no longer says "Not connected to Leads" (fixed); the Pipeline-to-Automation drag now shows a confirmation before enrolling anyone | `docs/new-venue-morning-p0-remediation.md`, confirmed live |

---

## 4. Documentation vs. Product Defects

Two items this pass specifically checked for a documentation-shaped fix, and rejected:

- **"Why did my Automation confirmation dialog say 'Message preview unavailable'?"** — investigated whether this deserves an article. It does not: per `docs/automation-sequence-p1-implementation.md`, this is a truthful fallback for when merge resolution genuinely cannot produce a preview (e.g., missing recipient data), not a bug and not something a venue needs explained in Help — the dialog itself already says exactly what happened. No article; not a defect.
- **Two Automations sharing the same trigger with no visible warning** (confirmed still true, unchanged) — this was already correctly classified in the prior Automation P1 document as a small **product** gap (a transparency note in the trigger picker, P2), not a documentation opportunity. Writing an article to explain this away would be using Help to excuse a product behavior the team already decided should eventually change. **Not recommended for Help.**

No other item investigated in this pass crossed the line from "genuinely unfamiliar" into "the product itself is misleading." Everything in the P0 list below is a case of unfamiliarity, not malfunction.

---

## 5. P0 Article Recommendations

| # | Category | Exact title/question | Why users need it | Current product truth | Target length | Search terms | Luv opportunity |
|---|---|---|---|---|---|---|---|
| 1 | Getting Started | *(existing — "Getting Started: Your First Morning")* | Already published, no change | Unchanged | — | — | Already the first-session moment |
| 2 | Getting Started | "What should I set up before I start?" | A brand-new venue doesn't know the minimum viable setup order | Venue info + at least one Package are the only true prerequisites for most workflows; Pipeline and branding have sensible defaults and can wait | 150 words | "setup checklist," "getting started," "what do I need" | First login, if setup is incomplete |
| 3 | Finding & Booking Clients | "How does my Pipeline work?" | The board is self-explanatory once used, but a first glance benefits from one paragraph | Drag-and-drop; stages map to a fixed underlying set of outcomes (New, Contacted, Qualified, Proposal Sent, Won, Lost, Cancelled) | 150 words | "pipeline," "sales process," "how do I move a lead" | First Pipeline visit |
| 4 | Finding & Booking Clients | "Can I customize my Pipeline stages?" | Venues need to know this is their process, not a fixed one | Yes — names and order are fully venue-editable from Sales → Leads → Pipeline Templates; the underlying meaning (e.g., "this counts as a tour") stays fixed so reporting and Automations keep working | 200 words | "rename pipeline stage," "customize stages," "pipeline templates" | First Pipeline Template edit |
| 5 | Finding & Booking Clients | "What happens when I move a lead into a stage with an Automation?" | Directly answers the confirmed live safety confirmation dialog a venue will see | Confirmed: Hello to Cheers shows a preview of the message before anything sends, and nothing is enrolled until the venue clicks Continue | 200 words | "automation confirmation," "why did this pop up," "enroll" | N/A — the dialog itself is the moment |
| 6 | Working With Clients | "What's the difference between a Lead and a Client?" | Genuinely confusing on first use — two words for what looks like one relationship | A Lead becomes a Client automatically the moment they're marked Won/Booked; nothing needs to be manually copied over | 150 words | "lead vs client," "where did my lead go" | N/A |
| 7 | Contracts & Payments | "Who signs a contract first, and what happens after?" | The venue-first model is a real, deliberate constraint a venue needs to understand before they're confused by a blocked signature | Confirmed: the venue must sign before the contract can be released; releasing is a separate, explicit action; the client can't see it until then | 250 words | "who signs first," "release contract," "not yet released," "ready for client" | First contract send |
| 8 | Contracts & Payments | "Can more than one person sign a contract?" | The couple often expects both partners to sign | Confirmed: yes, a contract can require more than one client signature; status shows progress as "Awaiting client signature (1 of 2)" | 150 words | "both sign," "second signer," "multiple signatures" | N/A |
| 9 | Contracts & Payments | "Can couples pay online?" | A venue needs to know this depends on them, not on Hello to Cheers | Confirmed: yes, once the venue connects their own Stripe account (Settings → Payments); until then, couples cannot pay online | 200 words | "stripe," "online payment," "couples pay," "connect stripe" | First Payments settings visit |
| 10 | Contracts & Payments | "What do Sent, Paid, and Void mean on an invoice?" | Plain but worth stating once, precisely | Draft = not yet sent; Sent = delivered to client; Paid = fully paid; Void = cancelled/superseded | 100 words | "invoice status," "what does void mean" | N/A |
| 11 | Building the Event | "What's the difference between a Package, Inventory, and an Inventory Template?" | Three related words, genuinely easy to conflate | A Package is what you sell; Inventory is what you own; an Inventory Template is a starter bundle of Inventory items for a typical event | 200 words | "package vs inventory," "inventory template" | N/A |
| 12 | Building the Event | "What do the Floor Plan Studio icons mean?" | The richest icon-only toolbar in the product | Every icon already has a hover tooltip (confirmed: Lock/Unlock, Magnet "Snap to grid," grid toggle, zoom, duplicate, layering) — this article is a single reference list for someone who wants it written down rather than hovering each one | 200 words | "floor plan icons," "lock icon," "magnet icon," "snap to grid" | First Floor Plan Studio visit |
| 13 | Building the Event | "How do I move an object that's behind another one?" | Layering isn't discoverable from icons alone, even with tooltips | The selection toolbar's forward/back controls reorder stacked objects; described in workflow terms, not icon terms | 150 words | "objects behind each other," "bring to front," "layering" | N/A |
| 14 | Vendors | *(none recommended — see §8)* | | | | | |
| 15 | Automations | "What is an Automation?" | The one concept-level article the whole feature needs | Plain definition: when something happens, Hello to Cheers can send a message automatically, on the schedule the venue sets | 150 words | "what is an automation," "automated message" | First Automations visit |
| 16 | Automations | "Can I pause an Automation for just one person?" | Directly answers the one real gap identified in the P1 architecture pass, now closed | Confirmed: yes — pausing one enrollment doesn't affect anyone else in the same Automation; resuming picks up where it left off | 150 words | "pause automation," "stop for one person," "resume" | First pause action |
| 17 | Automations | "Why did this person get this message?" | Trust-critical — a venue needs to be able to answer a client's question about an automated send | The relationship's Activity timeline shows exactly which Automation enrolled them and when | 100 words | "why did they get this," "automation history" | N/A |
| 18 | Automations | "What happens to an Automation if someone is marked Lost, Cancelled, or books?" | Directly addresses whether the system is safe to trust | Confirmed: all three automatically stop any active Automation for that person before anything new can start — no manual cleanup needed | 200 words | "lost automation," "booked automation," "does it stop" | N/A |
| — | Your Venue | "Where do my venue colors actually show up?" | Directly named by the brief as a priority; confirmed still the single most likely branding confusion point | Client-facing surfaces (Couple Portal, contracts, some print documents) — not the venue's own Hello to Cheers dashboard, and not the Hosted Wedding Website/RSVP, which is the couple's own separate color choice | 250 words | "where do my colors show up," "brand colors not working," "wedding website colors" | First brand-color save |

*(Item 14 intentionally left with no article — see §8. This brings the true count to 18 recommended articles, listed definitively in §6.)*

---

## 6. P0 Content Set — Definitive List

No alternatives; this is the list.

1. Getting Started: Your First Morning *(already published — no change)*
2. What should I set up before I start?
3. How does my Pipeline work?
4. Can I customize my Pipeline stages?
5. What happens when I move a lead into a stage with an Automation?
6. What's the difference between a Lead and a Client?
7. Who signs a contract first, and what happens after?
8. Can more than one person sign a contract?
9. Can couples pay online?
10. What do Sent, Paid, and Void mean on an invoice?
11. What's the difference between a Package, Inventory, and an Inventory Template?
12. What do the Floor Plan Studio icons mean?
13. How do I move an object that's behind another one?
14. What is an Automation?
15. Can I pause an Automation for just one person?
16. Why did this person get this message?
17. What happens to an Automation if someone is marked Lost, Cancelled, or books?
18. Where do my venue colors actually show up?

**17 new articles + 1 already published = 18 total, matching the original inventory's target size.**

---

## 7. Deferred / P1 Content

- **Why can't I edit something that's already been finalized?** (Inventory/Event Order immutability) — a real, previously-identified pattern in this product, but this pass could not re-confirm its exact current trigger conditions with the same confidence as everything in §6. **Unable to fully re-verify the precise current UI messaging in this pass** — recommend a follow-up verification before promoting to P0, rather than asserting untested specifics.
- **Multiple Automations sharing one trigger** — correctly a P2 product transparency fix (§4), revisit as a Help topic only if the product change doesn't happen first.
- **Vendor relationship states (Invited/Active/Inactive) and preference levels (Featured/Preferred/Recommended)** — confirmed real and stable, but no evidence from any of the source audits that venues are actually confused by this; hold until real evidence appears.
- **Reports vs. Saved Reports** — already resolved as a placement question in the Library IA pass; no live confusion evidence found in this pass to justify a dedicated article yet.
- **Timing/scheduling nuances for Automations** (business days, quiet hours) — explicitly not built yet per the P1 architecture document; nothing to document until it exists.

---

## 8. Articles That Should NOT Be Written

- **A Vendors-category article** (brief's own §"Vendors" candidate area) — investigated and found no evidence of genuine confusion; the current three-state model (Invited/Active/Inactive) is already plainly labeled everywhere it appears. Writing an article here would be content for its own sake.
- **An article explaining why two Automations can silently share a trigger** — per §4, this is a product transparency gap, not a knowledge gap; documenting it would quietly excuse behavior the product should eventually surface on its own.
- **A "Sequences" category or article of any kind** — explicitly rejected per the brief; "Sequence" stays an internal engineering term and must never appear as a venue-facing Help topic.
- **A dedicated "How Library works" overview article** — the Library home page's own description (already revised in the Library IA pass to "the things you set up once and use again and again") already does this job in one sentence; a full article would duplicate, not add.
- **A Message Template vs. Sequence Step article on its own** — folded into "What is an Automation?" (#14) instead, since the two concepts are only confusing in the context of building an Automation, not on their own.

---

## 9. Help & Guides Content Principles

- One specific venue question per article, phrased the way a venue would actually type it — never a generic feature-name heading.
- 100–250 words for a plain question; up to ~400 only for genuinely multi-part workflows (contract signing order is the one topic in this list that earns the higher end).
- State current, honest product truth, including real limitations ("until then, couples cannot pay online") — never soften a real gap into vague language.
- Never explain away a UX defect with careful wording; if the product itself is the problem, say so outside Help, not inside it.
- Preserve the search terms listed in §5 as article metadata now, even without search built — they cost nothing today and make a future search layer meaningfully better on day one.

---

## 10. Final Recommendation

**18 P0 articles**, listed definitively in §6, replacing the original content inventory's list rather than extending it — six of the original candidates were re-validated and kept in substance, several were rewritten to match materially changed product behavior (Contracts, Automations, Branding), and two candidate areas (Vendors, a standalone trigger-duplication explainer) were investigated and explicitly declined. This document does not write the articles themselves; that is the next, separately-scoped implementation task.

This document ends here. No articles, code, schema, taxonomy, search, or Luv behavior were changed in producing it.
