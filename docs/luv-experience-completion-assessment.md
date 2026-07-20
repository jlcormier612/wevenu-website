# Luv Experience Completion — Research & Product Assessment

**Status:** Research + Product Assessment complete. Awaiting clarifying-question answers before an implementation plan is written.
**Initiative:** First capability under the new **Capability Completion** phase (per direction, 2026-07-17): review each major product capability end-to-end for completeness, cohesion, and release-worthiness — not new architecture.
**Scope of this document:** Product experience only, per explicit instruction — where Luv appears, timing, tone, empty states, onboarding, progressive disclosure, celebration, cognitive load, cross-product consistency. No AI/model/prompt detail below.
**Governing docs read:** `docs/luv-platform-intelligence-architecture.md`, `docs/luv-platform-reconciliation.md` — both already-approved architecture/analysis documents (no code proposed by either). This assessment treats their target model as settled and does not re-litigate it; it instead reports **how much of that already-approved model is actually built today**, which is itself the substance of "Capability Completion."

---

## 1. Research — what actually exists today (verified against live code, not assumed from docs)

### 1.1 The two architecture docs made claims; some are now stale — verified directly

- **Phase 1(a) (schema repair) is done.** `supabase/migrations/20260829000000_luv_infrastructure_repair.sql` already shipped, and — in the same "discover, validate, correct, document" discipline used throughout this project — found the original docs' diagnosis was imprecise: the learned-layer functions (`compute_venue_insights`, `compute_venue_memories`, `generate_venue_recommendations`, `compute_venue_health_score`) were never broken by a missing `venue_users` table. The actual bug was three narrow, unrelated defects in `get_venue_trends()` (Story Mode's data source: wrong column name, two nonexistent tables). Fixed. **Story Mode should render correctly today**, contrary to what both docs still say.
- **Phase 1(b) (retire the two forks + dead code) is partially done.** Confirmed live: the dead `client-detail.tsx` → `LuvClientPanel` → `LuvEventBriefing` chain and `lib/luv/event-readiness.ts` are **already deleted** — gone from the repo entirely. But the two genuine forks are **still live, unchanged**: Wevenu HQ's `LuvInsights` still carries its own "v1... deliberate future hook, not built in this pass" comment verbatim, and the Vendor App's `computeLuvData()` still has zero imports from `lib/luv/*` — confirmed by grep, not carried forward from the docs.
- **Reconciliation Phase 2 (wire Event Readiness as Luv's primary input) is ~1/6 done.** `lib/luv/observations.ts` now imports `computePlanningReadiness` — Planning is wired. Timeline, Contracts, Payments, Documents, and Communication (the other five capabilities named in that phase) are not — confirmed no corresponding imports exist.
- **The Website ad hoc completeness heuristic both docs flagged as "actively wrong placement" is still embedded directly in `lib/luv/observations.ts`** (`hasTravelContent: !!site.content?.travel`), not extracted to a Website-owned function. Unchanged.
- **The "last observed state" mechanism — required for every Celebration and for "what got resolved since I last looked" — does not exist anywhere.** No table, no service, confirmed by search. This means **the entire Celebration observation kind and the 11-event Operational Events vocabulary both docs designed in detail are 0% built**, not partially built. This is the single largest gap between "designed" and "shipped" found in this research, and it's a product-experience gap, not an engineering one — the user-facing consequence is that Wevenu never tells a coordinator or couple "you just finished X" for any of the platform's real milestones, anywhere.

### 1.2 Full inventory of where Luv appears today

**Coordinator-facing (19 surfaces):** Dashboard "What Luv noticed today" widget (7 stacked sections + recommendations), the Momentum ("Heating Up / Cooling Off") widget, a Getting Started coaching nudge, the Recommendations panel + draft sheet, a dedicated Luv tab on every Lead record (3-stage confidence narrative + draft generation), a Settings section with real on/off/autonomy/tone controls (default-on), the Analytics page's "Luv's Roll-Up" (manual-trigger, 4-quadrant), a self-flagged incomplete Analytics card ("the raw signals Sprint 88 will let Luv summarize"), Venue Guide completion nudges, Wedding Day Dashboard live observations, a Post-Wedding Feedback empty-state cross-reference, three separate "propose with Luv" content-import assistants (templates, playbooks, timeline templates), a lead-import assist, a deliberate exclusion in Floor Plan Templates' otherwise-parallel import flow, a dormant Daily Digest email block, and two internal Wevenu HQ surfaces (a venue-detail insights card, activity-log labels).

**Couple portal & guest-facing (6 surfaces):** An always-available "Ask Luv" open chat tab, a "From Luv" hero message on the portal home (12-branch, date/readiness-driven, always non-empty), section-embedded fact-only observations on Budget/Guests/Payments (explicitly designed to "state facts and ask questions, never judge"), countdown/anniversary reassurance panels, Venue Guide nudges, and a public guest-facing concierge widget on the wedding website — deliberately the most restrained surface in the whole platform (collapsed by default, no growing thread, explicitly designed and documented as "a hospitality concierge, not a conversational interface").

**Vendor-facing (5 items):** A dedicated `/vendor/luv` page and matching dashboard card (wins/observations, computed, not narrated), a Business Health Score with a single rules-based tip line, and a small task-source badge. All five are the one genuine, undocumented fork noted above.

### 1.3 Explicit, already-approved design principles found in docs (treated as settled, not re-derived here)
- "Luv states facts and asks questions — she never judges." (`lib/luv/portal-observations.ts`)
- "The tone is hospitality, not a dashboard... never like a system reporting status back at the guest." (Hosted Experience Platform spec §6)
- The guest concierge must stay "a hospitality concierge rather than a conversational interface" — deliberately more restrained than the couple portal's open chat (Phase 5 report, echoed verbatim in the concierge's own system prompt).
- Payments is explicitly "fact-reporting, not recommendation-shaped" — Luv should never nudge a couple to pay (intelligence architecture doc, §1).
- Venue-facing Guest observations are aggregate-only, by explicit, deliberate design — no meal or accessibility data surfaced to a coordinator without a separate product decision (reconciliation doc §8). This is a hard privacy boundary, not a completeness gap.
- Legacy (pre-Conversation) messaging has no read-state and Luv should not invent one (reconciliation doc §3).

---

## 2. Product Assessment

### Where Luv currently appears
Broad and largely earned — every major coordinator workflow (dashboard, leads, settings, analytics, guide, wedding-day ops) and every couple-portal section with a "how am I doing" shape already has a Luv presence. The couple portal and guest concierge surfaces are genuinely well-designed and internally consistent with their own documented intent. The coordinator dashboard is the most feature-rich but also the most fragmented — up to 7 stacked Luv sections on one widget is a lot of surface for one card.

### Where it should appear (but doesn't yet)
1. **Celebrations, anywhere.** Nowhere in the product does completing a real milestone (contract signed, final payment received, guest list finalized, seating approved, timeline completed) produce a moment — no banner, no toast, no "Luv noticed" callout. Both governing docs designed this in detail (§2/§4 of the reconciliation doc); it was never built. This is the most visible gap relative to what "hospitality" and "celebration" should mean for this product.
2. **The Daily Digest email's "Luv noticed" block** — fully templated (HTML + plain-text), wired into the send pipeline, and permanently dead: `lib/notifications/digest-engine.ts` hardcodes `luvObservation: null` on every send. A shipped feature that silently never fires.
3. **The Analytics "Client Health" card** — ships today with copy that tells the coordinator, in-product, that it isn't finished ("the raw signals Sprint 88 will let Luv summarize"). Honest, per the platform's own "honestly absent, not misleading" principle — but it's been sitting in that state without a resolution date.
4. **Floor Plan Templates' "Paste Existing Layout" import** explicitly skips Luv while the near-identical Playbook and Timeline Template imports use it — an unexplained inconsistency in an otherwise-parallel set of three flows, not a documented product decision.

### Where it should remain intentionally silent
This is already well-drawn and should stay exactly where it is: Payments (fact-only, no nudging), guest-level meal/accessibility data on the venue side (hard privacy boundary), legacy messaging read-state (no invented data), and anything resembling Luv acting autonomously — every surface, without exception, repeats "you review, edit, send" / "Luv never sends anything." This restraint is a real strength and a consistent thread across all three portals; nothing here needs to change.

### Suggestion timing
Inconsistent across the three surfaces that have suggestions at all:
- **Dashboard observations**: computed fresh on every load — correct, no timing gap.
- **Luv's Roll-Up**: copy says "weekly synthesis," but the trigger is 100% manual (a coordinator has to remember to click "Generate"). Nothing schedules it, nothing reminds a coordinator it's due. The copy over-promises a cadence the product doesn't deliver.
- **Digest email**: designed to deliver a daily Luv nudge passively (no coordinator action needed) — the single best-timed surface in the whole product, and it's the one that's dead.

### Empty states
Three different patterns exist for "Luv has nothing to say," inconsistently:
- **Explicit reassurance** (Dashboard widget: "Everything looks good today"; Roll-Up: "Luv is ready to synthesize") — tells the coordinator Luv is present and watching even when quiet.
- **Hard vanish** (Momentum widget, Wedding Day Ops panel, Vendor `/vendor/luv` briefing — all `return null` with zero placeholder) — Luv simply isn't there. A coordinator with a genuinely quiet pipeline sees no evidence the Momentum widget exists at all, which is indistinguishable from it being broken.
- **Omitted node** (couple-portal section observations) — correct for this surface, since these are single supplementary lines inside a section that has its own content regardless.
No single principle currently decides which pattern a given surface uses; it reads as three separate authors' defaults, not a deliberate design choice.

### Onboarding
**No dedicated introduction to Luv exists anywhere in the product**, for any of the three audiences (coordinator, couple, vendor). Luv is default-on (`observationsEnabled`/`draftingEnabled` both `true` for every new venue) and simply present from the first login/portal visit/vendor signup. The closest thing to an onboarding moment is a single coaching-tip line inside the Getting Started checklist — but that's a byproduct of onboarding *the platform*, not an introduction to Luv specifically. A coordinator can go their entire tenure without ever discovering the Settings tone/autonomy controls exist.

### Progressive disclosure
Real and working on exactly one surface: coordinator Settings (`observationsEnabled`/`draftingEnabled`/`autonomyLevel`/`preferredTone`), plus a per-recommendation "Why is Luv recommending this?" disclosure link on the dashboard. **The couple portal and vendor app have zero equivalent controls** — no way for a couple to reduce Luv's presence, no tone setting, nothing. Given "Ask Luv" is a permanent, un-dismissible nav item in the couple portal, this is the one surface where the platform's own "progressive disclosure" principle (Program 2, adopted 2026-07-07/21) isn't being applied at all.

### Hospitality tone
Three genuinely distinct, well-differentiated registers by design (companion/narrative for the couple, restrained concierge for guests, analytical-but-warm for the coordinator) — and a fourth, **the vendor app, that has no persona voice at all**. Vendor-facing Luv copy ("2 upcoming events confirmed," "Profile is incomplete — finish it to improve your business health score") reads as generic SaaS status text that happens to sit under a pink heart icon and the word "Luv." This is the one clear tone gap in the whole inventory — not wrong, necessarily (a vendor's relationship to the product is more transactional than a couple's), but currently undecided rather than designed.

### Celebration moments
**Fully designed, 0% built** (see §1.1 and "Where it should appear," above). This is the single most consequential finding in this assessment, directly against the dimension the user asked about by name.

### Opportunities to reduce cognitive load
- The dashboard's "What Luv noticed today" widget, at up to 7 stacked sections, is the one surface most at risk of becoming noise rather than signal — worth deciding whether all 7 belong at equal weight or whether a smaller number should lead, with the rest available on demand (mirrors the Getting Started checklist's own, already-correct pattern of surfacing exactly one nudge at a time rather than all eight).
- The Momentum widget's hard-vanish-when-empty is arguably the *right* pattern (don't show a coordinator an empty box) — but it directly contradicts the main Luv widget's own choice to always show a reassuring empty state one card above it. Two adjacent widgets on the same dashboard disagree about whether "nothing to report" should be silent or announced.
- The Roll-Up's manual-only trigger, given its own "weekly" framing, is a place where a coordinator has to remember to ask for something the product could just deliver — the opposite of reducing cognitive load.

### Cross-product consistency
The central finding of this whole assessment: Luv is **four separate implementations wearing one shared name and icon**, not one system with four faces. The couple portal and guest concierge are each internally coherent and correctly differentiated from each other by deliberate design. The coordinator dashboard is the richest and most real (backed by an actual multi-table "learned" layer). The vendor app is a structurally disconnected, undocumented fork with a flat, non-differentiated voice. Wevenu HQ's internal view is a self-documented, honest placeholder. None of this is new — both governing docs already named exactly this problem and already designed the fix (a single unified engine, a `kind`-tagged observation envelope, consolidation of both forks) — it just hasn't been executed past the schema-repair step.

---

## 3. What this means for scope

Given the above, "Luv Experience Completion" could mean any of several genuinely different bodies of work, ranging from a pure copy/timing/consistency pass (small) to executing the already-approved reconciliation roadmap's remaining phases (large — fork consolidation, five more Event-Readiness wirings, a net-new Celebration mechanism, a net-new Daily Briefing). Rather than assume, four scope questions follow.
