# Architectural Exploration: Does Lead Need to Split?

**Status:** Exploration only. No schema, no migration, no code in this document. Written specifically to be resolved *before* Program 2 Phase 2 (Conversation) schema work begins, because Conversation's anchor choice is the one place this question can't be deferred safely — see the closing recommendation.
**Origin:** Surfaced while stress-testing Conversation's design against a continuity scenario (`docs/conversation-lifecycle-design.md` §7.8), generalized across five repeat-business scenarios (§2), then pushed one level higher: is the enduring identity underneath Lead a **Person**, or something more general — a **Relationship** (or Account), capable of representing an individual, a couple, a family, a planner-fronted client, a corporation, or a nonprofit? That reconsideration is §4, and it changes the recommendation from §6 of the first pass.
**Question, stated precisely:** Should `Lead` remain the one canonical identity for "a customer's relationship with the venue," or does the Domain Model need two concepts — a long-lived enduring counterparty and a short-lived **Opportunity** — where today there is one? And if so, what *kind* of thing is that enduring counterparty?

---

## 1. What Lead is doing today

`Lead` currently carries two jobs at once:

1. **Identity** — "this is Emma & James, and here is everything we know about our relationship with them" (contact info, how they found us, notes, tour history, activity log).
2. **Opportunity** — "here is one specific ask, at one specific pipeline stage, for one specific event" (`event_type`, `event_date`, `status` moving through new → contacted → tour-scheduled → won/lost).

For a venue whose business is exclusively first-time weddings with zero repeat contact, these two jobs are the same size — one identity, one opportunity, always. The model has never been tested against a case where they diverge, because Program 2 Phase 1 (which built the current dedup logic) was scoped exactly to that case: guarantee one Lead per person across entry points. It didn't need to ask what happens when one customer legitimately has *more than one* opportunity over time, or is more than one person, because nothing before now forced the question.

## 2. Running the five scenarios through the current model

| Scenario | What happens under "Lead = Identity + Opportunity" |
|---|---|
| **Wedding inquiry** (first contact) | Clean. One Lead, one opportunity, no tension. |
| **Anniversary party, same couple, years later** | `find_lead_by_email` matches Emma's email back to her *original* Lead — the one already `status='won'`, already pointing at a completed wedding Event. To represent the anniversary ask correctly, something has to either overwrite that Lead's opportunity fields (`event_type`, `event_date`, `status`) — destroying the historical record of the wedding opportunity — or create a second Lead for the same email, which is precisely what Phase 1's dedup logic was built to prevent. **There is no third option inside the current model.** |
| **Baby shower, past bride** | Same shape and same forced contradiction as the anniversary case. |
| **Corporate event, recurring account** | Same contradiction, except it's no longer a rare multi-year edge case — it recurs every time the account rebooks, which for a real annual-gala or quarterly-event customer could be every few months. This is the scenario where the compromise ("just let the pipeline data go a little stale") stops being tolerable, because it's now a standing, repeated reporting defect on the venue's *best* customers, not a curiosity. |
| **Referral from an existing client** | Different shape — a *new* customer, not a repeat one. Handled today by a proposed `referred_by_lead_id` self-reference (already sketched in `docs/conversation-lifecycle-design.md` §5), which works fine without any split. This scenario doesn't force the issue on its own. |

Three of the five scenarios (anniversary, baby shower, corporate) hit the same genuine either/or: **mutate a closed historical fact, or defeat the dedup guarantee Phase 1 just established.** That's not a style preference — it's two commitments the project has already made (Standard #4: completed facts are append-only; Phase 1: one Lead per person) that cannot both hold once a customer has a second legitimate opportunity. The referral scenario is real but doesn't independently force a split.

## 3. A precedent already living in the Domain Model

This split isn't a new idea being proposed from scratch — Wevenu already draws it, on the other side of the relationship. **Vendor** splits identity from relationship today: `vendors` is the vendor's own global identity (they may work with many venues), and `venue_vendor_relationships` is *this venue's* specific, ongoing relationship with them — itself capable of spanning many Events over many years, and explicitly named a **relationship**, not a person (`docs/domain-model.md`'s Vendor entity). Nobody has ever proposed collapsing those two, because it would obviously be wrong the moment a florist worked two weddings for the same venue.

The naming there turns out to matter for what comes next: the domain already calls this shape a "relationship," not a "person" — because the thing on the other end of it isn't always reducible to one individual.

## 4. Is the enduring identity a Person? Testing it against how the business actually thinks

The first pass of this exploration (superseded below) proposed a **Person** table as the enduring identity beneath Lead. Before building anything, it's worth actually running "Person" against the six shapes a Wevenu customer relationship takes — because a couple, a family, a planner-fronted client, a corporation, and a nonprofit are not all, structurally, one person.

| Shape | Does "Person" hold up? |
|---|---|
| **A couple** (Emma & James) | Already strained. Two people, not one — under a strict Person model, is the enduring identity Emma's Person row, with James bolted on as a Contact? That's exactly the asymmetry the Conversation walkthrough already tripped over (`docs/conversation-lifecycle-design.md` §7.6, step 3: James's email doesn't match anything because he was never a first-class identity, only a Contact of Emma's). Person makes this asymmetry structural instead of incidental. |
| **A family** (parents booking a milestone anniversary celebration) | Multiple decision-makers, no single person is "the" customer. Person has no natural home for this at all — you'd have to arbitrarily pick one family member as canonical. |
| **A planner representing a client** | The planner isn't the customer — they're a delegate acting on behalf of one. Modeling the planner as the enduring Person would misattribute the relationship to the wrong party (the venue's real relationship is with the couple/family/company, not their delegate) — see the note at the end of this section on planners as a *separate* recurring-relationship shape in their own right. |
| **A corporation** | The sharpest case. The venue's relationship with "Acme Corp" outlives any individual person at Acme — the employee who books this year's gala may not be the one who books next year's. A Person-based model has no way to represent "the relationship persists even when every human involved changes," because by definition a Person *is* one of those humans. This case doesn't just strain Person — it breaks it. |
| **A nonprofit** | Same shape as corporate — an organization, not an individual, and the actual human contact turns over independently of the relationship. |
| **Repeat customer, years later** | Works fine under either Person or Relationship — this scenario doesn't discriminate between the two options, which is why it wasn't decisive in isolation the first time around. |

Two of six cases (corporate, nonprofit) don't just complicate a Person model, they invalidate it outright — an enduring identity that must survive every human on the other end being replaced cannot itself be modeled as a human. Two more (couple, family) are inherently multi-person from the start, not a primary person plus attachments. That's four of six shapes where "Person" is either wrong or an awkward fit, and the fifth (planner) reveals a related concept (a professional delegate who may serve many customers, or many venues — structurally closer to Vendor than to a customer) that Person also has no room for.

**Conclusion: the enduring identity is not a Person. It's what the venue owner named it — a Relationship** (or Account, in the common CRM sense of that word): a container that can represent one individual, a couple, a family, a company, or a nonprofit uniformly, and that:

- Owns **many Contacts** (the individual humans attached to it — a bride, a groom, a parent, a corporate coordinator — each of whom can come and go without the Relationship itself changing identity, which is exactly what "Acme's coordinator changed jobs" requires and Person could never express).
- Owns **many Opportunities over time** (what Lead becomes under this model — one per distinct ask: this year's gala, next year's gala, the wedding, the anniversary).
- Owns **one continuous Conversation** (communication is with the Relationship, carried out through whichever Contact happens to be speaking — this is a strictly better fit than anchoring to a Person, since it removes the "which person is canonical" question entirely rather than answering it awkwardly).
- Owns **one composed Activity History**, the same way Calendar and the Relationship Timeline already compose rather than store.

This is also, not coincidentally, the same shape most CRM systems converge on independently (Account/Household above Contact above Opportunity) — further evidence this is a well-worn, correctly-shaped concept rather than a novel one being invented for Wevenu specifically.

**One thing this section surfaces but deliberately doesn't resolve:** a professional planner who represents many different couples, possibly across many different venues, looks structurally like a **Vendor** (an external party with their own standing identity, related to — but not owned by — any single venue relationship) more than like a plain Contact. That's a real, interesting refinement for later, flagged here so it isn't lost, but out of scope for the decision this document needs to make now.

## 5. Naming: Relationship, not Person — and it's already the project's own word

`venue_vendor_relationships` already uses this exact word for this exact shape, on the vendor side. The clean, symmetric choice is a table with the same naming pattern on the customer side — e.g. `venue_customer_relationships`, mirroring `venue_vendor_relationships` structurally and lexically. This isn't a coincidence to force; it's the same underlying concept (an enduring counterparty the venue has an ongoing relationship with, independent of any single engagement) appearing on both sides of the business, and it should look like the same concept in the schema, not two differently-named ideas that happen to behave alike.

The domain-model *word* is **Relationship**. The pipeline-stage word stays **Lead** in the UI and coordinator-facing language (coordinators already know "the Leads pipeline," "convert Lead to Client" — that's a separate, much bigger terminology decision, not implied by this one). Conceptually, though, a Lead is now precisely one **Opportunity** belonging to a Relationship — the word "Opportunity" is useful in this document and in `docs/domain-model.md` for precision, without requiring any UI or table rename today.

## 6. What a full split would cost, if done all at once

Named honestly, because "the goal isn't to redesign everything" is the operating constraint here:

- Conversation's anchor (currently designed as `lead_id`) would need to change.
- Contact is currently scoped to Client (`client_contacts.client_id`) — under this model it more naturally scopes to Relationship (a planner or family member belongs to the *relationship*, not to one specific won opportunity) — a real, if contained, change in what "belongs to" means for every existing Contact row.
- Calendar's tour/follow-up sources, Luv's lead-scoring, and the just-shipped Phase 1 dedup logic (`find_lead_by_email`) all currently reason in terms of a single Lead row.
- Several already-Resolved Trust Risk Register items (TR-B4, TR-B5) and the whole Phase 1 Architecture Delta are built on today's one-Lead model. None of them become *wrong* — but the identity they ultimately anchor to would be relocated one level up, which is real migration work, not a free rename.
- Client's own meaning sharpens rather than changes: "a Lead that has committed" becomes, more precisely, "an Opportunity that has been won" — still exactly the same lifecycle (`convertLeadToClient` → contracts/invoices/portal unlock), just now understood as a stage of one Opportunity rather than a second identity layered on top of Lead.

Taking all of that on at once, right now, in the middle of Conversation's design, is exactly the rushed redesign the venue owner said not to do. It also isn't necessary — most of that cost only matters for *pipeline reporting correctness* and *Contact scoping precision*, neither of which anything currently being built (Conversation, Assets, Activity Timeline) actually depends on.

## 7. The one piece that can't wait

Everything in §6 *can* wait — except one thing: **whatever Conversation anchors to has to be the right thing the first time**, because Conversation doesn't exist in code yet. Re-anchoring an already-shipped Conversation later would be the exact costly rework this whole exploration exists to avoid; choosing correctly now, before any table is created, costs nothing extra.

Given §2 through §4, anchoring Conversation to `leads.id` specifically (a row that's allowed to represent only one opportunity, and — per §4 — is the wrong *kind* of thing even before that) would be doubly wrong. The correct target is the enduring Relationship: the thing that outlives any single opportunity, and, for corporate/nonprofit customers, outlives any single person too.

## 8. Recommendation

**Verdict:** Lead should stop being asked to represent both the enduring counterparty and the current opportunity, and the enduring counterparty beneath it is a **Relationship** — not a Person. This is a real conclusion, not a hedge: three of five repeat-business scenarios produce a genuine contradiction under today's model (§2), the Vendor entity already proves a relationship/identity split works in this exact domain (§3), and two of the six customer shapes named (corporate, nonprofit) actively invalidate a Person-shaped answer while two more (couple, family) are inherently multi-person from the start (§4).

**Scope of what to actually do about it now — deliberately minimal, per "if Relationship is simply a thin table for now, that's fine":**

1. Introduce a small table representing the enduring counterparty — one row per distinct customer relationship (an individual, a couple, a family, a company, a nonprofit), named to match the existing `venue_vendor_relationships` pattern (e.g. `venue_customer_relationships`). Matching by email is the starting heuristic (the same logic `find_lead_by_email` already computes today), understanding that a Relationship can eventually have more than one associated Contact/email — that refinement isn't needed on day one, since today's dedup already only ever sees one email per Lead anyway.
2. Add `leads.relationship_id`. Backfill is trivial and lossless: today, dedup already guarantees exactly one Lead per email, so the backfill is a 1:1 mapping with zero ambiguity — one Relationship row per existing distinct email.
3. Conversation anchors to `relationship_id`, not `lead_id`. This is the only change that had to happen before Phase 2 schema work, and it's now made correctly the first time.
4. **Explicitly not changed in this pass:**
   - `find_lead_by_email`'s behavior stays exactly as Phase 1 shipped it — one Lead per Relationship, reused across repeat contact. The pipeline-reporting problem named in §2 (a "won" Lead getting silently reactivated by an unrelated later ask) is **not fixed by this step** — deciding *when* a Relationship's repeat contact should open a fresh Opportunity versus reuse the existing Lead is a real product decision (does "contacted again after 2 years" always mean a new opportunity? what about a corporate account that legitimately wants one Lead per season?) that deserves its own deliberate pass.
   - Contact's scope (Client vs. Relationship), Calendar/Luv's reasoning, and Client's precise reframing as "a won Opportunity" are all **out of scope here** — nothing about Conversation, Assets, or Activity Timeline requires any of them to change today.
   - The planner-as-Vendor-like-entity observation from §4 is noted, not acted on.

This is the same move the last three breakthroughs made: notice the model resisting, resolve the one piece that would be expensive to fix later, and explicitly name the rest as deferred rather than either forcing a full redesign now or ignoring the signal.

## 9. What this changes in already-written docs, pending confirmation

If this recommendation is accepted:

- `docs/conversation-lifecycle-design.md` §1 and §7.8 — anchor changes from `lead_id` to `relationship_id`; the open question in §7.8 becomes "resolved for Conversation's purposes (anchor to Relationship), deferred for pipeline-reporting purposes (when does repeat contact open a new Opportunity)."
- `docs/domain-model.md` — a new, short **Relationship** entity would be added above Lead, explicitly parallel to the existing Vendor entity's `venue_vendor_relationships`; Lead's own entry would note it's now scoped to "one Opportunity within a Relationship"; Contact's entry would note its scope question (Client vs. Relationship) as open; Conversation's entry updates its anchor description.
- `docs/program-2-implementation-plan.md`'s Phase 2 schema sketch — `conversations.relationship_id` instead of `conversations.lead_id`.

None of these edits are made in this document. They're listed here so the next step is a confirmed decision followed by a small, well-understood set of edits — not a rediscovery.
