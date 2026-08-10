# Work Package BA3 — Business Asset Experience Certification

**Date:** 2026-08-08
**Scope:** Product design certification only — no code, no migrations, no architecture changes. Builds on `docs/business-asset-system-definition.md` (BA1) and `docs/business-asset-behavior-certification.md` (BA2). Every claim traces to real, quoted UI copy or a real, cited navigation structure — not invented mockups.

**A finding worth stating up front, because it shapes everything below:** this product's actual customer-facing language is already unusually plain and hospitality-toned. Across ten major surfaces audited this round, exactly one phrase ("merge fields," in a Contract Template description) reads as mildly technical, and the messaging system's status labels carry an explicit code comment documenting a deliberate effort to strip provider/carrier jargon ("Sent" not "Accepted," "Couldn't deliver" not "Failed"). This certification is not rescuing the product from bad language — it's checking whether the *structure* venues navigate is as honest and obvious as the *words* already are. It mostly is. Where it isn't, that's what follows.

---

## 1. Business Asset Experience Map (Step 1)

Every customer-facing entry point a Business Asset appears in, with a plain judgment on whether it feels natural.

| Surface | What appears there | Feels natural? |
|---|---|---|
| **Sidebar nav** (`lib/navigation.ts`) | Direct links to Contracts (templates), Event Contracts (instances), Packages, Playbooks ("Planning"), Timeline Templates ("Timelines"), Floor Plan Templates, Inventory, Invoices, Payments, Message Templates | Mostly yes — but "Contracts" and "Event Contracts" sitting in different sections of the same sidebar, pointing to a template list and an instance list respectively, is the one place a venue owner would have to stop and think. See §7. |
| **Relationship Workspace — Lead** (`lead-detail.tsx`) | Documents tab (contracts/questionnaires/etc. as generic files), Tasks, Conversation | Yes — a lead has one detail page, everything relevant to that person lives in one set of tabs |
| **Relationship Workspace — Booking** (`event-detail.tsx`) | Planning (tasks), Timeline, Floor Plans, Documents, Vendors, Event Order, Payments, Conversation, Feedback (post-wedding only) | Yes — this is the single richest, most complete home for a Business Asset in the whole product, and it reads exactly like a venue owner's own mental folder structure for one wedding |
| **Global Documents** (`/documents`, built in Work Package D1) | Cross-relationship browse/search/filter | Yes, for its stated purpose (finding one file across many weddings) — see §5 for the risk of it competing with the Relationship Workspace instead of complementing it |
| **Template Library** (flat routes under `/library/*`, plus `/contracts/templates`, `/packages`) | Every reusable asset | Mostly yes — the *content* of each page reads like a toolbox already ("Reusable day-of schedules a venue builds once and applies to any booking"). The *organization* has no landing page — see §4 |
| **Client Portal** | Documents section, Tasks, Timeline, Payments, Messages, Guide, Vendors | Yes — and the portal's own header nav already documents a deliberate "venue-operational only" principle, keeping couple-owned planning tools (Website, Guests, Budget, Seating) out of the header and reached via dashboard launch cards instead. This is the strongest existing example of §3's "one true home" philosophy already being applied correctly |
| **Vendor Workspace** | Document Library, Task Templates, per-event Documents (Vendor's Event folder) | Yes, and its own nav code comment documents the same discipline the portal uses — deliberately keeping secondary destinations (Timeline, per-event detail) out of top-level nav |
| **Dashboard** | Today's Attention / Upcoming (via the Decision Engine), Business Snapshot tiles | Yes, per the Venue Dashboard Reconstruction phase's own certification — not re-audited here |
| **Messages/Conversation threads** | Attachments (existing files linked into a thread) | Yes |

---

## 2. Customer Mental Model (Step 2)

What a venue owner actually says, mapped to what the product actually calls the same thing — confirmed against literal UI copy, not invented:

| What a venue owner says | What the product calls it | Match? |
|---|---|---|
| "I need our contract" (the template) | "Contract Templates" (`/contracts/templates`) or sidebar "Contracts" (`/library/contracts`) | **Two different destinations for the same mental sentence** — see §7 |
| "I need today's contract" (this couple's) | "Event Contracts" (`/contracts`), or the Documents tab inside their Booking | Yes, once you know to look in "Event Contracts" and not "Contracts" |
| "I need to send our brochure" | Doesn't exist (BA1) | Can't be certified — there's nothing to send |
| "I need to update their questionnaire" | "Final Details" (staff label) | Yes — the internal name `event_questionnaires` never leaks into view; "Final Details" is exactly how a coordinator would say it |
| "I need to change the Event Order" | "Event Order" | Yes, verbatim |
| "I need the latest floor plan" | "Floor Plans" tab, "Final" badge | Yes to the label. **No** to the promise the badge makes — see §4, §12 |
| "I need our task list for this wedding" | "Planning" tab, checklist applied from "Planning Templates" | Yes |
| "Are they waiting on me, or am I waiting on them?" | Messaging inbox literally has stat tiles labeled "Waiting for Client" / "Waiting for Venue" | Yes, and this is the single best implementation of this mental model found anywhere in the product — see §6 |

---

## 3. Correct Homes (Step 3)

For each asset: created / edited / found later / shared / archived / searched.

| Asset | Created | Edited | Found later | Shared | Archived | Searched |
|---|---|---|---|---|---|---|
| Contract Template | `/contracts/templates/new` | same list | `/contracts/templates` | N/A (internal only) | in-place toggle, same page | same page, no dedicated search |
| Contract (instance) | `/contracts/new`, or "Send a Contract" from the Booking's Documents tab | `/contracts/[id]` (draft only) | Booking → Documents tab, or `/contracts` | Sign link, generated on send | N/A — no archive concept, only cancel | `/contracts` list filters |
| Questionnaire | Auto-created on first "Send to client" | Booking → Planning ("Final Details" form) | Same tab | Public link (`/questionnaire/[key]`) | N/A | N/A |
| Package | `/packages` | same page | same page | N/A (added as Event Order/Invoice lines) | Archive toggle, same page | filter/search on the list page |
| Invoice | Booking → Payments, or `/invoices/new` | `/invoices/[id]` (Draft only) | Booking → Payments, or `/invoices` | Email button, portal aggregation | N/A — status-only | `/invoices` list, sort options |
| Event Order | Booking → Event Order tab | same tab | same tab | not exposed to couple (BA1/BA2) | N/A | N/A |
| Floor Plan | Applied from a Template, in Booking → Floor Plans | same tab (always editable) | same tab | Vendor/couple view toggle | N/A — "Final" doesn't archive or lock | N/A |
| Task List (Playbook application) | Applied from `/library/playbooks` | Booking → Planning | same tab | "Release to Client" | N/A | N/A |
| Payment Plan | Booking → Payments, "Create Payment Plan" | same tab | same tab | couple sees read-only | N/A | N/A |
| Vendor Document | Vendor's own `/vendor/documents`, or shared in-event | vendor library only | Booking → Documents, vendor Documents tab | share-to-event action | N/A | Global Documents (`/documents`) |
| Message Template | `/communication/templates` | same page | same page | used, not shared | Archive toggle, same page | same page |
| FAQ | `/guide` | same page (whole-array rewrite, BA1) | same page | published live on the Venue Guide | N/A — no per-item lifecycle | N/A |

**No duplicate ownership found** — this matches BA1's own finding. Every asset has exactly one true "edited here" home; every other appearance is a filtered read or a single well-defined action (sign, share, send).

**The one real violation of "single true home":** Contract Templates and Contracts (instances) are reachable from what look like two competing "Contracts" destinations in the sidebar itself, not just in casual conversation — this is a navigation-level ambiguity, not just a language one. See §7 and §12.

---

## 4. Customer Journey Maps (Step 4)

Each mapped against the brief's own Contract example shape: **Open → Choose/Create → Collaborate → Share → Sign/Lock → Archive**. Confusion points marked explicitly.

**Contract** — Open Template Library (`/contracts/templates` *or* sidebar "Contracts," ambiguous which one a new user tries first) → Choose a template → Create (`/contracts/new`, or "Send a Contract" from the Booking's Documents tab — **this link carries no client/event context in its URL**, worth confirming it doesn't force a second client lookup) → Edit while Draft → Send → Couple signs via link → "This agreement is complete" (plain, honest copy) → Archive: **doesn't exist as a concept** — a signed contract just sits in the list forever, which is fine, but there's no "put this away" action a venue owner might instinctively look for. **Confusion point:** the Template Library entry point itself (§7).

**Questionnaire** — Booking → Planning → "Send to client" → couple fills it out via a warm, well-copied public form ("no PDFs, no attachments") → submits → staff sees "Opened and submitted." **Confusion point, real and behavioral, not cosmetic:** BA2 found the couple-submission path skips the same automation the staff-submission path triggers — from the venue's chair, two submissions that look identical in the UI silently behave differently underneath. A venue owner would never see this from the screen; they'd only notice a task "should have" auto-completed and didn't.

**Package** — `/packages` → Create/Edit → used automatically wherever Event Order/Invoice lines are added. **No confusion point** — this is the simplest, most linear journey in the whole audit.

**Invoice** — Booking → Payments → New Invoice → add lines (auto-populated from the linked Event Order, or manual) → Send/Email → Mark as Paid. **Confusion point:** the UI's own copy already tells the truth here ("Invoice is locked — edit is only available in Draft status") — but BA2 confirmed the line-item edit functions have no actual guard once sent. The copy promises a lock the code doesn't enforce. This is the most serious gap in the whole certification because the *product's own words* set an expectation the *architecture* doesn't keep.

**Event Order** — Booking → Event Order tab → "Start Event Order" → add sections/lines → "Finalize" → (if needed) "Reopen," which the UI displays as status "Amended." **No confusion point** — this is the one asset where the words, the behavior, and BA2's own finding (the only consistently-enforced app-layer lock besides Legal Documents) all agree with each other.

**Floor Plan** — Booking → Floor Plans → build on canvas → "Mark Final." **Confusion point, the clearest FAIL in this whole certification:** the badge says "Final." BA2 confirmed, in the code's own words, that Final "never gates editing." A venue owner reading "Final" has every reason to believe the floor plan is locked in the same sense a Finalized Event Order is — it isn't, and nothing in the UI says otherwise.

**Task List** — Apply a Planning Template → Draft (visible to coordinator only) → "Release to Client" → tasks show as Overdue/Waiting/Upcoming/Completed/Waived (all real, plain, on-screen words — "blocked" never appears). **No confusion point.**

**Payment Plan** — Booking → Payments → "Create Payment Plan" → "Record Payment"/"Pay" per line → 🟢 Current / 🟡 Needs Review badge if it drifts from the linked Invoice. **No confusion point** — the drift indicator is one of the most honest, well-designed pieces of UI found in this whole audit; it tells the venue owner exactly what BA2 found architecturally (Payment Plans and Invoices are independently maintained) without ever using that sentence.

**Vendor Document** — Vendor uploads to their own Library → shares onto a specific event → appears in the Booking's Documents tab and the vendor's own event folder. **No confusion point** for the flow itself; the confusion (per BA2) is that insurance/permit expiry, once shared, is silently untracked — invisible to this journey entirely, which is itself the problem.

**Message Template** — `/communication/templates` → create/edit → used when composing a message, or by an Automation. **No confusion point.**

**Brochure** — **Cannot be journey-mapped. It does not exist as a real asset** (BA1). Recommend deciding whether it's needed before writing a journey for it.

**FAQ** — `/guide` → edit the whole list → live immediately on the Venue Guide. **Minor confusion point:** because the whole array rewrites at once (BA1), there's no per-FAQ "this one's still a draft" state — a venue mid-edit on one FAQ has no way to keep the rest of the list live while working on it, though this is a small, low-stakes gap given FAQs are low-risk content.

---

## 5. Workspace Pattern Specification (Step 5)

Regions found to already recur, informally, across the asset detail screens audited:

| Region | Always present? | Evidence |
|---|---|---|
| **Title** | Yes, on every asset | Contract title, Invoice number, "Event Order," Floor Plan name |
| **Status** | Yes, wherever a status concept is real | Draft/Sent/Signed; Draft/Sent/Paid/Void; Open/Finalized/Amended; Final/not-marked (Floor Plan) |
| **Owner** | Implicit, never explicit | No screen currently shows "Owned by: Venue" the way it shows status — it's implied by which app you're in (venue vs. portal vs. vendor), never stated |
| **Shared With** | Inconsistent | Real and visible on Documents (share toggles), absent as a concept on Contracts/Invoices/Event Orders (you'd have to know a contract "shares" via its sign link, not see a "shared with" list) |
| **Activity** | Present on Contracts and Event Orders (both have a literal "Activity" disclosure), absent elsewhere | Contract Detail, Event Order Panel |
| **Version/History** | Absent everywhere except Event Order's `revision` counter and Contract Template's Archive/Restore, neither of which is a browsable history a user can open | BA2 §2 |
| **Actions** | Yes, everywhere, but positioned inconsistently (top-right buttons on Contracts/Invoices, inline row buttons on Tasks, a dedicated toolbar on Floor Plans) | — |
| **Related Information** | Yes, informally — Invoice shows its Event Order link, Payment Plan shows its linked Invoice, Event Order shows its linked Floor Plan | — |

**Recommendation, not implementation:** Title/Status/Actions are already consistent enough to formalize as always-present. Owner and Shared With should become consistently visible, not just inferrable, everywhere Sharing is a real behavior (§7). Activity should be everywhere BA2 found a real Relationship Impact chain (§7 of BA2) — right now its presence correlates with which screen a developer happened to build it into, not with which assets actually have activity worth showing.

---

## 6. Editing Experience (Step 6)

Who edits, whose turn is it, how does someone know what's next — evaluated per asset, not per technology.

The single best answer to "whose turn is it" found anywhere in the product is the **Messaging inbox's own stat tiles**: "Waiting for Client" / "Waiting for Venue," visible before opening a single thread. No Business Asset detail screen does this as plainly. A Contract in "Sent" status doesn't say "Waiting on {couple name} to sign" — it says "Sent," which requires the reader to already know what Sent implies. A Questionnaire does slightly better ("Sent — waiting for the client to open it.") — real, quoted copy, and exactly the right shape.

**Pattern to generalize, not invent:** the Questionnaire's own status copy ("Not yet sent" / "Sent — waiting for the client to open it" / "Opened and submitted") already answers all three of Step 6's questions in one sentence per state. Contracts and Invoices should read the same way — "Signed" could say "Signed by {name} on {date}" (it already does, on the detail page, just not in the list view); "Sent" could say "Waiting on {client} to sign," matching the Questionnaire's own established pattern rather than inventing a new one.

---

## 7. Sharing Experience (Step 7)

The simplest possible answers to "did they receive it, can they edit it, can they only view it, who's waiting on whom" — checked against what's real:

- **Did they receive it?** Real and visible for Messages (delivery status badges: Sent/Delivered/Opened/Clicked). **Not visible** for a sent Contract or Invoice — there's no read-receipt equivalent shown to the venue for either, even though the underlying `documents`/portal-view infrastructure could support it.
- **Can they edit it?** Never ambiguous in practice — nothing in this product lets a couple co-edit a venue-owned document; they always either view, sign, or submit. This question basically never needs answering because the product never actually offers ambiguous edit rights (BA1/BA2 both confirmed `clientAccess: "edit"` on Floor Plans is a reserved, unused flag — the one place this *could* become ambiguous if it were ever wired up).
- **Am I waiting on them, or are they waiting on me?** Solved well for Messages. Solved adequately for Questionnaires (status copy says it directly). **Not solved** for Contracts/Invoices/Payment Plans as a glanceable fact — a venue owner has to open the item and read a status badge, then mentally translate "Sent" into "I'm waiting on them."

**Recommendation:** generalize the Questionnaire's own "who's waiting on whom" sentence pattern to Contracts and Invoices, rather than inventing a new mechanism — the product has already solved this problem twice (Messages, Questionnaires); it just hasn't applied the solution everywhere the same question exists.

---

## 8. Template Library Experience (Step 8)

Per Step 8's own framing — easy to browse, update, duplicate, organize, reuse — checked against real copy and structure, not redesigned:

- **Browse:** Good. Every template list's own description already reads like toolbox copy, not software copy — "Reusable day-of schedules a venue builds once and applies to any booking," "The planning checklists you've refined over the years." This is genuinely well-written product copy already.
- **Update:** Good — every template type supports Edit in place.
- **Duplicate:** Good everywhere except two confirmed outliers (BA1): Inventory Items and Vendor Task Templates have no Clone action, breaking the otherwise-consistent pattern every other template type follows.
- **Organize:** **The one real structural gap.** There is no `/library` landing page (confirmed this round) — it's a flat set of sibling routes, reachable only by scanning the sidebar's "Resources/Templates" section, which mixes Vendors, five different template types, Inventory, and QR Campaigns into one long list with no grouping or hierarchy. A venue owner's mental model of "my toolbox" implies one drawer with labeled compartments; today it's one long shelf.
- **Reuse:** Good — every template's real "apply to an event" action is one click from inside the Booking workspace, matching §9's philosophy correctly.

---

## 9. Relationship Workspace Integration Review (Step 9)

**The brief's own philosophy — discover assets through the Relationship first, use the Library mainly for administration — is already true in practice, not aspirational.** The Booking workspace (`event-detail.tsx`) is confirmed to contain Planning, Timeline, Floor Plans, Documents, Vendors, Event Order, and Payments as tabs in one place — a venue owner opens one couple's page and finds nearly everything without ever visiting the Library. The Library's own real usage pattern (apply-a-template-to-an-event, confirmed across Playbooks/Timeline/Floor Plan Templates) exists specifically to feed the Relationship Workspace, not to compete with it.

**One place this philosophy is at risk, not yet violated:** the new Global Documents workspace (`/documents`, Work Package D1) is, by design, a cross-relationship browse tool — exactly the "administration and finding things across many events" use case Step 9 describes as the Library's proper role. It should stay positioned that way in any future nav placement (e.g., not promoted to a primary, equally-weighted sidebar item next to "Clients") so it doesn't start competing with the Relationship Workspace as a second way to "find this couple's contract."

---

## 10. White-Label Experience Review (Step 10)

Reusing BA1's confirmed branding audit, read through a customer-experience lens: every real client-facing surface (Contract signing, Invoice print, Floor Plan print, inquiry form, tour booking, questionnaire, portal shell) already pulls the venue's logo and primary color consistently, with the same fallback default — a couple never sees an unbranded venue document today. The one deliberately unbranded surface (Wedding Website) is correctly unbranded on purpose, not a gap.

**The one experience-level consequence worth naming:** because no venue typography field exists (BA1), every branded document uses the same system font regardless of which venue it's from — the one place a venue's brand doesn't fully "show up" the way their logo and colors do. This is the single most invisible-to-the-user gap in this whole certification: nothing looks *broken*, it just never quite looks like *their* venue's own printed materials would.

---

## 11. Language Audit (Step 11)

**Overall verdict: PASS, with one flag and one structural (not linguistic) collision.**

- Zero instances of "entity," "instance," "record," "asset," "representation," or "canonical" found in any user-facing copy across ten audited surfaces (confirmed by direct agent search) — those words live only in code comments and this certification series' own docs, never in the product.
- Status vocabulary is consistently plain and, in the messaging system's case, explicitly and deliberately de-jargoned (a real code comment documents removing carrier/provider language from what users see).
- Playbook status labels never expose the internal `blocked` state as "Blocked" — it reads "Waiting," matching how a venue owner would actually say it.
- **The one flag:** "merge fields" in the Contract Template description. Mildly technical, domain-standard, low stakes — recommend "fill-in details" or "placeholders that auto-fill" if this is ever touched, not urgent.
- **Not a language problem, a structural one, already covered in §3/§7/§12:** "Contracts" and "Event Contracts" as two different sidebar destinations. The words themselves are fine — a venue owner would say "our contracts" for either meaning. The system just uses the same word for two different things in the one place (the sidebar) where that ambiguity is most costly.

---

## 12. Ease-of-Use PASS / FAIL Certification (Step 12)

Each workflow judged only against "What is this? What do I do next? Where do I click?" — no rationalization.

| Workflow | What is this? | What do I do next? | Where do I click? | Verdict |
|---|---|---|---|---|
| Sending a Contract | Clear | Clear | Clear, but two sidebar entry points compete for "where do I start" | **PASS**, noted |
| Signing a Contract (couple side) | Clear | Clear | Clear | **PASS** |
| Sending/completing a Questionnaire | Clear | Clear (status copy answers it directly) | Clear | **PASS** |
| Marking a Floor Plan "Final" | **Fails** — the word promises a lock the product doesn't provide | Unclear what actually changed | Clear (one button) | **FAIL** |
| Editing an Invoice after sending | The UI says "locked," so a user reasonably believes this is answered | N/A — user believes there's nothing more to do | N/A | **FAIL** — not because the workflow is confusing, but because it's confidently wrong |
| Finalizing an Event Order | Clear | Clear | Clear | **PASS** |
| Applying a Planning Template | Clear | Clear | Clear | **PASS** |
| Creating a Payment Plan and recording payments | Clear | Clear (🟢/🟡 badge tells you directly) | Clear | **PASS** |
| Finding "our contract" for one specific wedding | Unclear at the sidebar level (Contracts vs. Event Contracts) | Resolves once inside the Booking's Documents tab | Ambiguous at the entry point | **FAIL** at first click, PASS once inside the Relationship Workspace |
| Browsing the template library as a whole | Clear per-page | Clear per-page | **Unclear overall** — no landing page, just a long flat sidebar list mixing five template types with Vendors and QR Campaigns | **FAIL** (organization only, not content) |
| Sending a Brochure | N/A | N/A | N/A | **Cannot be certified — doesn't exist** |

**4 FAILs, all narrow and named, not systemic.** The product's actual day-to-day workflows (sending a contract, completing a questionnaire, finalizing an Event Order, running a payment plan) pass cleanly. Every failure traces to one of two root causes: a word promising more than the architecture delivers (Floor Plan "Final," Invoice "locked"), or a navigation structure with two names for one thing (Contracts/Event Contracts, the flat Library list).

---

## 13. Prioritized Implementation Roadmap

Sequencing only — nothing here has been built or scheduled.

1. **Fix the two "confident but wrong" labels** (Floor Plan "Final," Invoice "locked") — either make the words true (wire real enforcement, which BA2's Locking Engine candidate already names) or make the words honest ("Marked ready" instead of "Final" until it actually locks). This is the highest-priority item because it's the only place the product actively misleads a venue owner, not just under-serves one.
2. **Resolve the Contracts / Event Contracts naming collision** in the sidebar — likely a rename, not a redesign (e.g., "Contract Templates" and "Contracts," matching how the Packages/Invoices sections already avoid this problem).
3. **Generalize the Questionnaire's "whose turn is it" status-sentence pattern** to Contracts and Invoices — a copy change, not new engineering, and the highest-leverage single improvement to §6/§7's findings.
4. **Add a Library landing page** grouping the five template types, Vendors, and QR Campaigns into labeled sections — matching the "toolbox with drawers" mental model the individual page copy already implies but the navigation doesn't yet deliver.
5. **Decide on Brochures and venue typography** (both already named in BA1's own roadmap) — neither blocks anything above, but both are cheap, well-scoped, and directly serve this phase's white-label and asset-completeness findings.

**Stopping here, as instructed.** No code, no migrations, no redesign was performed for this phase.
