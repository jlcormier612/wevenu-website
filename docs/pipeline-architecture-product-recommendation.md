# Pipeline Architecture & Product Model — Recommendation

**Type:** Product/architecture discovery only. No code, schema, routes, navigation, Leads, Library, or Automations were modified to produce this document.
**Method:** Direct tracing of the actual data flow — schema (`\d` against the live local database), service-layer functions read in full, and the real drag-and-drop → server action → database write path followed end to end, not inferred from component or file names. Two prior design documents already in the repo (`docs/booking-journey-design.md`, `docs/sales-booking-journey-walkthrough.md`) were read in full and treated as evidence to verify, not as ground truth — every claim from them cited below was independently re-confirmed against current code.

---

## Executive Summary

**The prior navigation audit's finding needs a correction, and it changes the recommendation.** The Library page's on-screen copy still reads *"Not connected to Leads yet — this is just the editor"* — but tracing the actual data flow shows this is now false. `/leads/pipeline` calls `getActiveTemplate()`, renders the venue's real custom stages on a real drag-and-drop board, and dropping a lead onto a stage calls `updateLeadPipelineStage()`, which maps that stage's fixed `canonical_stage` to a real `leads.status` value, writes it through the same `updateLeadStatus()` every other status change already uses, and that function **already fires a real, live automation trigger** (`triggerSequencesForRelationship(..., "lead_stage_changed", status)`) — Automated Series enrollment on pipeline movement is not a future capability, it exists today. The copy is stale, not the architecture.

**What this means for the central question this document was asked to resolve:** Pipeline is more strategically important than "connect it eventually" — it's *already* the backbone the product context describes, just under-surfaced and inconsistently honored by two of its own consumers. The real gap isn't "unbuilt." It's that **two places that should speak the venue's customized pipeline language still hardcode a separate, narrower, generic vocabulary instead of reading the real one**: the Automations trigger picker (`SEQUENCE_TRIGGER_STAGES`, a hardcoded 4-value list) and the Dashboard/Reports pipeline visualizations (both read `leads.status` directly, never a venue's actual stage names). This is exactly the "no fake customization" principle stated in the brief, and it's the single most actionable finding in this document.

**Also confirmed, and equally important:** the underlying stage model already implements the canonical/venue-facing split this document was asked to evaluate — `pipeline_stages.canonical_stage` is a fixed, seven-value, system-owned field; `name`/`color`/`sort_order`/`probability` are fully venue-customizable. This is not a proposal to build. It's already correct, already shipped, and should not be redesigned.

**One structural correction to the working hypothesis, found by tracing the data model rather than assuming it:** a Pipeline Template is not consumed the way every other Library asset is. A Contract Template is *copied* into a new Contract at the moment of use — editing the template afterward never touches the contract already sent. A Pipeline Template is *referenced live*, continuously, by every current lead via a foreign key — editing it changes what every lead in that stage displays immediately, and only one template is ever active at a time. This is architecturally identical to how **Automations** already behaves (a standing, continuously-running venue configuration) — and Automations is not filed in Library. This single fact is the basis for this document's navigation recommendation in §16, which does depart from the prior audit's placement, on evidence, not on a re-assessment of importance alone.

**Adoption signal, for calibration:** exactly one venue in the current database has ever created a Pipeline Template. This isn't evidence the feature is unwanted — the blank-editor-with-no-starter experience is a real, known barrier this document recommends closing directly (§13).

---

## Current-State Findings

### What exists, traced end to end

| Layer | What's real | Evidence |
|---|---|---|
| Pipeline definition | `pipeline_templates` (venue-owned, one or more, one `is_active` at a time) + `pipeline_stages` (name, color, sort_order, canonical_stage, probability) | Schema read directly via `\d` |
| Pipeline editor | Full CRUD — create/edit/duplicate/delete/set-active — at `/library/pipeline-templates` | `lib/pipeline-templates/service.ts` read in full |
| Pipeline board | `/leads/pipeline` — real drag-and-drop, renders the venue's **active template's real stages**, falls back to an empty state ("No active Pipeline Template — Set one up to see your leads as a board") if none exists | `app/(app)/leads/pipeline/page.tsx` read in full |
| Stage change → status | `updateLeadPipelineStage(leadId, stageId)` looks up the stage's `canonical_stage`, maps it to a real `leads.status` via the existing `CANONICAL_STAGE_TO_LEAD_STATUS` table, and writes it through the **unchanged, existing** `updateLeadStatus()` | `lib/leads/service.ts` lines 283–301, read in full |
| Automation trigger on stage change | **Real and live.** `updateLeadStatus()` calls `triggerSequencesForRelationship(supabase, venueId, relationshipId, "lead_stage_changed", status)` on every status write, unconditionally | `lib/leads/service.ts` lines 233–239 |
| Automations UI naming | The trigger is already presented to venues in plain language: *"A lead reaches a pipeline stage — Starts when a lead moves to the stage you choose."* | `lib/message-sequences/constants.ts` |
| Activity log on status change | `lead_activities` gets a row, human-readable title ("Status changed to Proposal Sent"), via a DB trigger | `log_lead_status_changed()`, read via `\sf` |
| History / duration tracking | **Does not exist.** No `entered_at`/`exited_at`/duration table. `lead_activities` is a title-string feed, not structured, queryable stage-transition data | Confirmed — no `*stage_history*` table in the schema |
| Reporting / Dashboard | Dashboard's Pipeline Snapshot and every reporting rollup read `leads.status` directly, using a fixed, generic label set — **never the venue's actual custom stage names** | `components/dashboard/pipeline-snapshot.tsx`, `lib/metrics/registry.ts` |
| Automations trigger picker | Hardcoded to four values only (`new`, `contacted`, `qualified`, `proposal_sent`) — **does not include `won`/`lost`/`cancelled`, and is not derived from `canonical_stage` or the venue's real stages at all** | `lib/message-sequences/constants.ts::SEQUENCE_TRIGGER_STAGES` |
| Booking/post-booking pipeline | **Does not exist.** `clients.status` is a flat, four-value field (`planning`/`confirmed`/`complete`/`cancelled`) with no stage or pipeline concept | Confirmed via `\d clients` |
| Client lifecycle ↔ Playbook milestone unification | Proposed in `docs/booking-journey-design.md` §5 as "the single most important recommendation in this document" — **never implemented**; `clients.status` remains its own, separate, disconnected field | Confirmed — no reference to Playbook milestones anywhere near `clients.status` writes |
| Pipeline starters | **None exist.** No starter file, no default pipeline offered on first visit to the empty editor | Confirmed — no `starters.ts` in `lib/pipeline-templates/` |
| Library interaction-model standardization | The 2026-08-11 pass that unified Preview/Edit/Use/••• across every other Library family **did not include Pipeline Templates as a row at all** | `docs/library-interaction-model-standardization.md` |
| Real usage | 1 venue, 1 active template, 9 stages, in the current database | Direct query |

### The design document already on file

`docs/booking-journey-design.md` (status: *"Design only, no code... do not implement until approved"*) is the direct origin of the current implementation — `lib/pipeline-templates/types.ts` cites it by section number. It already specifies, correctly and in detail: the canonical/venue-facing stage split (§2, exactly what's built), a full table of stage-triggered automations (§3, partially built — only the messaging trigger exists; tasks/notifications per-stage do not), the "Booked → Client" transition as a single confirmation screen rather than silent automatic setup (§4, directly matching the brief's "no silent state changes" principle, not yet built), and the Client-lifecycle/Playbook-milestone unification (§5, not built). This document is not proposing a new architecture in most of what follows — it is confirming, correcting, and narrowing a plan that was already designed, largely agreeing with it, and being explicit about which parts of it were actually built versus which remain design-only.

---

## Existing Architecture (verified, not proposed)

```
pipeline_templates (venue, name, is_active)
        │ 1-to-many
        ▼
pipeline_stages (name, color, sort_order, canonical_stage, probability)
        │ referenced live (FK, not copied)
        ▼
leads.pipeline_stage_id  ──┐
                            ├──► canonical_stage lookup ──► CANONICAL_STAGE_TO_LEAD_STATUS ──► leads.status (write)
leads.status (existing) ───┘                                                                        │
                                                                                                       ▼
                                                                                     updateLeadStatus() side effects:
                                                                                       - lead_activities row (audit trail)
                                                                                       - tour_converted signal (on "won")
                                                                                       - triggerSequencesForRelationship("lead_stage_changed", status)
```

This is a genuinely well-designed two-layer model already in production. **It should not be rebuilt.** The gap is entirely downstream: two consumers (Automations picker, Reporting/Dashboard) read `leads.status` through their own separate, narrower hardcoded lists instead of the shared canonical vocabulary that already exists.

---

## Current Gaps

| Gap | Existing / Incomplete / Missing / Nice-to-have |
|---|---|
| Library page copy says "Not connected to Leads yet" — false today | **Existing but incomplete** (a documentation/copy bug, not an architecture gap) |
| Automations trigger picker hardcodes 4 stages, omits `won`/`lost`/`cancelled`, ignores venue's real stage names | **Existing but incomplete** — highest-leverage fix in this document |
| Dashboard/Reports never show the venue's own stage names, only generic canonical labels | **Existing but incomplete** |
| No stage-transition history (`entered_at`/duration) | **Missing but architecturally required** — only if "time in stage" automation or historical-accuracy-after-rename reporting is in scope (it is, per the brief) |
| No Pipeline starters | **Missing but architecturally required** for real adoption — directly explains why only 1 venue has ever used it |
| Client lifecycle / Playbook milestone unification | **Missing but architecturally required** eventually — already fully designed, not part of this document's minimum scope |
| Per-stage task/notification automation (beyond messaging) | **Nice-to-have future enhancement** — designed in §3 of the booking-journey doc, not needed for a genuinely useful first version |
| "Lead remains in stage for X days" trigger | **Nice-to-have**, blocked on the history gap above if ever built |
| Multiple pipeline *types* (Sales / Booking / Client Lifecycle) | **Nice-to-have future enhancement** — not warranted by current evidence; see §"Pipeline Types Recommendation" |
| Pipeline Templates never brought into the standardized Library card grammar | **Existing but incomplete** — moot if §16's navigation recommendation is adopted (it would leave Library's card grid) |

---

## Resolving the "Two Pipeline Concepts" Question

The prior audit's premise was correct as evidence goes (the copy really does say that), but the underlying question — *why do two pipeline concepts exist* — has a precise, evidence-backed answer, and it is **none of the options the brief offered as possibilities.** It is not two implementations of the same thing, not deliberately different, not legacy-vs-newer, and not an abandoned migration.

**It is a deliberately staged rollout of one already-designed architecture, and the staging succeeded further than its own documentation was updated to reflect.** `lib/pipeline-templates/types.ts` literally names itself "Phase 1 (editor only, no Leads connection)." That comment, and the Library page copy that quotes it almost verbatim, describe a real, true state — at some earlier point. The connective work (`updateLeadPipelineStage`, the board reading `getActiveTemplate()`, the automation trigger firing through the existing `updateLeadStatus()`) was then built — correctly, safely, exactly per the original design's canonical/venue-facing split — and nobody went back and updated the two sentences of copy describing the old state. This is a narrow, low-risk, high-confidence finding: **fix the copy, don't redesign the system.**

---

## Recommended Product Definition

**"A Pipeline in Hello to Cheers is a venue-defined, ordered sequence of stages that describes how that venue actually moves a relationship through one phase of running their business — today, specifically the sales phase, from first inquiry to booked or lost."**

| Question | Answer |
|---|---|
| What it represents | The venue's own process, in their own words and order — not Hello to Cheers's process imposed on them |
| Who owns it | The venue (one row per venue per template; venue-scoped RLS confirmed) |
| What it controls | Stage names, order, color, probability, and what a lead's current position displays as |
| What it does NOT control | The underlying canonical meaning of a stage (fixed, system-owned, seven values); `leads.status`'s own validity; today, the vocabulary shown in Automations or Reports (a gap, not a design choice — see above) |
| Reusable | Not in the copy-once sense every other Library item uses — see the structural note below |
| Venue-wide | Yes |
| Applies to | Today: Leads only. Architecturally extensible to Clients/Events, not built (see Pipeline Types, below) |
| Has stages | Yes, one-to-many, ordered |
| Stages configurable | Name/color/order/probability: fully. Canonical meaning: chosen from a fixed list at creation time, not free-form |
| Stages: definitions or operational records | Definitions — `pipeline_stages` rows are referenced by leads, never copied into them |

**The one correction to the working hypothesis, stated precisely:** *Pipeline Definition → Pipeline Execution → Automation* is the right flow, but "Pipeline Definition" does not behave like the rest of Library's definitions. Every other Library asset is **copied at the moment of use** (a Contract Template becomes a new, independent Contract; a Package becomes an independent invoice line item). A Pipeline Template is **referenced continuously** — editing it changes what's true for every lead in that stage right now, and exactly one template governs the whole venue at any moment. This is the same shape as **Settings** or **Automations**, not the same shape as **Contract Templates** or **Packages**. This distinction is the load-bearing fact behind the navigation recommendation in §16.

---

## Pipeline Types Recommendation

**Recommendation: one pipeline type — Sales — for now. Do not build Booking or Client Lifecycle as pipeline types.**

The brief is explicit not to assume all three are needed, and the evidence agrees. Two independent facts point the same direction:

1. **Nothing in the current product needs a second Pipeline Template mechanism.** `clients.status` is flat and simple; there is no post-booking stage concept anywhere to connect one to.
2. **A better mechanism for post-booking progress already exists and is already designed, just not built:** `docs/booking-journey-design.md` §5 proposes making a Client's lifecycle phase *be* whichever milestone its applied Planning Playbook is currently in — reusing Playbooks (already real, already Library-shaped, already applied per-event) rather than inventing a second, structurally-identical-but-separate "Booking Pipeline." Building a second pipeline type before this exists would create exactly the "two state machines that can silently disagree" problem that design doc calls out by name as the thing to avoid.

**So: Sales (Inquiry → Booked/Lost) and post-booking progress (via Playbook milestones) are linked, not merged and not duplicated** — the Sales Pipeline's terminal "Booked" stage is the handoff point; everything after that is a different, already-existing mechanism, not a second pipeline.

For the one pipeline type that does exist: a venue can already create multiple Pipeline Templates and switch which is active (`duplicateTemplate_`, `setTemplateActive_` both real, both working) — this already satisfies "can a venue try a different structure without losing their old one," and needs no new capability.

---

## Stage Model

The current model is correct; this section confirms it precisely rather than proposing changes.

| Question | Answer |
|---|---|
| Custom name | Yes, free text, required non-empty |
| Order | Yes, `sort_order`, freely reorderable |
| Active/inactive per stage | **Not implemented at the stage level** — only the whole template has `is_active`. Not recommended as a gap to close: a venue not using a stage simply doesn't put leads there; adding stage-level activation would be complexity with no evidenced need |
| Stage identity | The row `id` (uuid) — stable, independent of display name |
| Color | Yes, hex, validated by a CHECK constraint |
| Description | Not present on a stage today. Not recommended as a priority — the name plus canonical badge already carries the necessary meaning |
| System meaning | Yes — `canonical_stage`, exactly the "optional system meaning" the brief asks about, already required (not optional) at creation |
| Can a stage be deleted | Yes, hard delete, cascades `leads.pipeline_stage_id` to `NULL` via `ON DELETE SET NULL` — confirmed in the schema |
| Can a stage be archived | No archive concept exists — only delete |
| What happens to a lead in a renamed stage | **Correct today, no fix needed** — because the reference is a live FK, not a copied string, the lead's display updates automatically. This is the single strongest piece of evidence that the "stable identity, changeable label" principle is already honored where it matters most |
| What happens to a lead in a deleted stage | `pipeline_stage_id` silently becomes `NULL` — the lead keeps its already-written `leads.status` (unaffected, since that was written separately at the time of the transition) but loses "which exact stage" display fidelity going forward, with no warning shown to the coordinator at delete time |
| Does reordering change historical data | No historical data exists to change (see the History gap above) — moot today, but the reason a history table matters before this becomes a real question |

**The one real risk found here, worth naming precisely for the minimum-scope build:** deleting a stage that leads currently occupy today happens silently, with no confirmation step naming which leads will be affected. This is a small, concrete, safe fix — a confirmation listing affected leads before a stage delete — consistent with "no silent state changes," and inexpensive relative to everything else in this document.

---

## Pipeline/Lead Relationship

Already built, already correct: a venue's single active template supplies the stages `/leads/pipeline` renders; dragging a lead calls `updateLeadPipelineStage`, which writes both the mapped `leads.status` and the exact `pipeline_stage_id`. No default-pipeline ambiguity exists because there's exactly one `is_active` template read at a time; if none exists, the board shows an honest empty state rather than fabricating stages.

**On automatic transitions — directly addressing the brief's "no silent state changes" concern:** today, **nothing moves a lead automatically.** Tours, proposals, and contracts do not silently advance a lead's stage — every transition traced in this audit is either a direct drag-and-drop action or an explicit status change a coordinator makes. This is already correct and should stay this way. The one place `docs/booking-journey-design.md` proposes something closer to automatic — the "Booked → Client" transition — is explicitly designed as **"System proposes. Human confirms"**, a single confirmation screen naming everything about to happen, not a silent cascade. That design should be the model for any future stage-triggered automation this product adds: propose, name it, let the venue confirm — never move a lead's business-process state without them seeing it happen.

---

## Pipeline/Automation Relationship

**Real today, correctly architected, incompletely surfaced.** The trigger already exists (`lead_stage_changed`), already fires off every stage change via the unchanged `updateLeadStatus()`, and is already presented to venues in plain language ("A lead reaches a pipeline stage"). The two things to fix are narrow:

1. **`SEQUENCE_TRIGGER_STAGES` should be derived from the same canonical vocabulary the pipeline system already uses** (the seven `canonical_stage` values, or at minimum the seven `leads.status` values), not a separate, hand-maintained four-value list that's already missing `won`, `lost`, and `cancelled` — states a venue would very plausibly want to build an automation around ("when a lead is marked Lost, send a graceful follow-up").
2. **The picker should show the venue's own current stage names** (from their active template) next to the canonical meaning, not a generic label — e.g., "Proposal Sent (your stage: *Let's Talk Numbers*)" — so a venue configuring an automation recognizes their own process rather than a stranger's vocabulary.

**Automation references should point to canonical stage, confirmed as already how it's built** — `trigger_stage` stores a `leads.status`-shaped value, which is itself the stable, system-owned layer. This is the correct answer among the brief's four options (stage ID / stage name / canonical stage type / pipeline+stage combination) precisely because it survives a stage rename, a stage deletion, and even a venue swapping which template is active — none of which should ever silently break an automation a venue built.

**On the other trigger shapes the brief asks to evaluate:** "enters stage" is the only one worth having — "leaves stage" is redundant with the next stage's "enters," and "stays in stage for X days" is real, valuable, and explicitly designed already (Decision Pending escalation), but depends on the history table this document does not consider minimum-scope (see Minimum Complete Implementation). Recommend building it in a second pass, not the first.

---

## Pipeline/Client/Event Relationship

Given the Pipeline/Types recommendation above (Sales-only for now), this is narrow: **a lead's current stage should appear on the Lead workspace itself** (already true — the lead's status/stage is visible there) and **the Dashboard's Pipeline Snapshot should read the venue's real stage names**, once the vocabulary gap is closed. No pipeline display belongs inside the Client or Event workspace today, because — correctly, per this document's recommendation — nothing pipeline-shaped exists post-booking; a Client's progress should eventually show its Playbook milestone (a separate, already-existing mechanism), not a second pipeline concept.

---

## Reporting/History Requirements

**Minimum data model to make customizable pipelines trustworthy and reportable — not over-engineered, stated precisely:**

- **Stable stage IDs** — already exist (`pipeline_stages.id`).
- **Canonical stage categories** — already exist (`canonical_stage`).
- **Pipeline IDs** — already exist (`pipeline_template_id`).
- **Historical stage transitions, `entered_at`** — **does not exist, and is the one real gap.** A single append-only table (lead id, canonical stage, entered_at) would be sufficient — not a full audit log of every field change, just stage transitions. This is what "time in stage" automations and any future "average days from Inquiry to Booked" report both need, and neither can be honestly built without it.
- **`exited_at` / duration in stage** — derivable from consecutive rows in the same table above (each row's `entered_at` implies the previous row's exit); a separate `exited_at` column is redundant, not needed.
- **Full stage history displayed to the venue** — not required for the minimum build; the activity log (`lead_activities`) already gives a human-readable trail adequate for a coordinator glancing at one lead's story. A structured version only matters once real cross-lead reporting is being built on top of it.

**Do not build:** per-field change auditing, stage-level analytics before any venue has meaningfully adopted custom pipelines, or a generalized event-sourcing layer. The brief's own instruction — minimum, not infinitely configurable — is being honored here deliberately.

---

## Pipeline History

**Yes, a lightweight, append-only stage-transition table is needed, and the reasoning is exactly the scenario the brief poses:** if a venue renames "Proposal Sent" to "Proposal Out," a history table keyed to `canonical_stage` (not to the venue-facing `name`) never breaks — a report reading "how many leads reached the Proposal canonical stage last quarter" stays correct regardless of what the venue calls it today or called it then. This is the same stable-identity principle already correctly applied to the live `pipeline_stage_id` reference; a history table needs the identical discipline (store the canonical stage, or the stage id plus its canonical stage at time of transition — not a copy of the display name).

---

## Library vs. Operational Boundary

*(Superseded in placement by §"Navigation Recommendation" below — this section defines the conceptual boundary regardless of where it's surfaced in the sidebar.)*

| Concept | Belongs to |
|---|---|
| Pipeline Template definition (stages, names, order) | The venue's process configuration — conceptually adjacent to Settings/Automations, not a copy-once Library asset |
| Pipeline execution (a lead's current stage) | Leads — fully operational, already correctly placed |
| Automation trigger definitions | Automations — already correctly placed, needs the vocabulary fix above |
| Client Workspace | No pipeline display until Client Lifecycle/Playbook unification is built |
| Event Workspace | No pipeline concept applies here at all |

---

## Migration Recommendation — the Current Fixed Seven-Stage Model

**Nothing needs to migrate. This is the most reassuring finding in this document.** The seven-value `canonical_stage`/`leads.status` vocabulary is not a legacy system being replaced by customizable Pipelines — it is the permanent, stable foundation customizable Pipelines are already built on top of. Specifically:

- **Existing leads:** unaffected. `leads.status` keeps working exactly as it does today whether or not a venue ever creates a Pipeline Template.
- **Existing stage values:** unchanged, remain the canonical layer permanently — this document does not recommend touching them.
- **Reporting:** already keyed to the stable layer; once the vocabulary-display gap is closed, reporting gets more legible, not restructured.
- **Automations:** same — the fix is presentation, not the underlying trigger mechanism.
- **Historical stage changes:** nothing retroactive is possible (no history existed before), but nothing existing is invalidated either.
- **Venues that never customize anything:** **already fully supported today** — `/leads/pipeline` shows a clean empty state and `/leads` (list view) works exactly as it always has. No venue is forced into the pipeline concept.

---

## Minimum Complete Implementation

The smallest version of customizable Pipelines that is genuinely useful and safe — not an infinitely configurable workflow engine:

1. **Fix the two vocabulary gaps** — Automations trigger picker and Dashboard/Reports both read the real canonical + venue-label layer instead of their own hardcoded lists. (Smallest, highest-leverage item in this document.)
2. **Correct the stale Library page copy** — remove "Not connected to Leads yet," since it's actively misleading a venue away from a feature that already works.
3. **Ship 1–2 Pipeline starters** — a default Sales pipeline matching the canonical stages 1:1 (Inquiry → Tour → Proposal → Decision → Booked/Lost), so the editor is never a blank screen. Directly answers "Beautiful by Default" and "Spoon-fed."
4. **Add the stage-delete confirmation** naming which leads will be affected, closing the one real silent-state-change risk found in the current model.
5. **Add the minimal stage-transition history table** (`entered_at` keyed to canonical stage) — small, append-only, unlocks "time in stage" automation and rename-proof reporting without over-building.

Everything else in this document (multiple pipeline types, per-stage task/notification automation beyond messaging, Client Lifecycle/Playbook unification, "remains in stage for X days" triggers) is real, valuable, and explicitly **not** part of the minimum — each is either blocked on item 5 above, blocked on a separate already-designed initiative (Client Lifecycle), or not yet evidenced as needed by real usage.

---

## Explicit Out-of-Scope Items

- Multiple pipeline types (Booking, Client Lifecycle) — not warranted by current evidence; revisit once Client Lifecycle/Playbook unification ships.
- Per-stage task and notification automation beyond messaging (§3 of the booking-journey design) — real, designed, not needed for a first genuinely useful version.
- "Lead remains in stage for X days" automation — depends on the history table; second pass, not first.
- Stage-level active/inactive flags, stage descriptions — no evidenced need.
- A generalized workflow/automation engine of any kind — explicitly rejected per the brief's own instruction; everything recommended here reuses the existing Automated Series infrastructure.
- Bringing Pipeline Templates into the standardized Library card grammar — moot if the navigation recommendation below is adopted.

---

## Navigation Recommendation

**This document reaches a different conclusion than the prior audit's placement, on evidence, as instructed — not to preserve the earlier answer.**

The earlier recommendation (Pipelines demoted, filed inside Library) was reasoned correctly *given what was true at the time*: a disconnected editor with no live effect doesn't deserve promotion anywhere. That premise is no longer accurate. But the correct conclusion isn't "promote it back into Library's main grid" either — it's that **Pipeline Definition was never really a Library-shaped thing to begin with**, once the copy-vs-live-reference distinction (§"Recommended Product Definition") is accounted for. A Pipeline Template behaves like **Automations**: a single, continuously-active, venue-wide configuration that everything else quietly depends on — not like a Contract Template, copied once and forgotten.

**Recommendation: Pipeline configuration should not live in Library's main card grid, and should not become its own top-level sidebar destination either.** It should be reached the way it already technically is — as a clearly-labeled configuration entry point from within **Sales/Leads**, specifically from the Pipeline board itself (the "Pipeline Templates" button already present in `/leads/pipeline`'s header is the right pattern; it should become the primary and effectively only discovery path, not a parallel Library card). This satisfies the brief's own instruction not to add navigation merely because a feature is important, while correcting the deeper problem: a venue configuring "how we sell" should find that action next to the place where selling actually happens, the same way a venue configuring "how we automate" finds Automations next to Inbox — not in a general-purpose asset library alongside Floor Plan Templates.

This is a genuine, evidence-driven departure from the prior recommendation's placement, made because the architecture actually is different from the rest of Library, not because Pipeline is "more important."

---

## Final Product Model

```
VENUE
  ↓
Pipeline Definition (venue-wide, live-referenced — not copy-once)
  stages: name · color · order · probability · canonical_stage (fixed, system-owned)
  ↓
Live Lead Stage  ──────────────────────────────┐
  (leads.pipeline_stage_id, leads.status)       │
  ↓                                              │
Stage History (minimal: entered_at per           │
  canonical stage — the one real gap to close)   │
  ↓                                              │
Automation / Sequence Triggers ◄──────────────────┘
  (already real — lead_stage_changed; needs the
   vocabulary fix, not a new mechanism)
  ↓
Messages (real today) · Tasks/Notifications (designed, not built) · future client journey handoff
  ↓
[Booked] ──► Client record (existing mechanism) ──► Playbook milestones
                                                       (the correct post-booking "pipeline,"
                                                        already designed, not yet unified)
```

The one change from the working hypothesis given in the brief: **Automation/Workflow is not a downstream layer bolted onto Pipeline Execution — it already reuses the exact same status-change pipe every other part of Leads uses.** There is no new automation engine to design; there's a vocabulary gap to close between what that pipe already carries and what two of its consumers choose to display.

---

## Final Recommendation

1. **What Pipelines should mean:** a venue-defined, ordered sequence of stages describing their real sales process — already correctly modeled with a fixed canonical layer underneath fully venue-customizable labels.
2. **One or multiple pipeline types:** one (Sales) for now. Do not build Booking or Client Lifecycle as pipeline types — reuse Playbook milestones for post-booking progress instead, once that unification is built.
3. **Customizable stages:** the current model (name/color/order/probability, stable ID, live-referenced not copied) is correct and should not be redesigned; add only a stage-delete confirmation.
4. **Canonical/internal stage meanings:** needed, and already built (`canonical_stage`) — no change required.
5. **Pipeline Definition ↔ Leads:** already fully connected; the remaining work is fixing the copy that says otherwise.
6. **Stages ↔ Automations:** already wired at the trigger-firing level; needs its vocabulary picker fixed to read the real canonical/venue-label layer instead of a stale hardcoded list.
7. **What belongs in Library:** nothing pipeline-related, per the navigation recommendation above.
8. **What belongs in Leads:** pipeline execution (already there) and, per the navigation recommendation, the pipeline configuration entry point itself.
9. **What belongs in Client/Event workspaces:** no pipeline concept, today or in the recommended near-term scope.
10. **The current fixed seven-stage model:** keep it exactly as-is — it's the permanent foundation, not legacy debt.
11. **Minimum complete implementation:** the five items listed above — two vocabulary fixes, one copy fix, starters, a delete confirmation, and a minimal history table.
12. **Explicitly out of scope for now:** multiple pipeline types, per-stage task/notification automation, duration-based triggers, Client Lifecycle unification (a separate, already-designed initiative worth resuming on its own timeline, not folded into this one).
13. **Navigation placement:** neither Library nor a new top-level destination — reached from within Sales/Leads, where it's actually used.

This document ends here. No code, schema, routes, navigation, Leads, Library, or Automations were changed in producing it.
