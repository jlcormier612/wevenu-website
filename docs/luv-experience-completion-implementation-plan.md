# Luv Experience Completion — Implementation Plan

**Status:** Plan, pending approval. Built from `docs/luv-experience-completion-assessment.md` (Research + Product Assessment) and four scoping decisions (below), following the established Research → Assessment → Clarifying Questions → **Plan** → Implementation → Live Validation → Final Report discipline.
**Architecture check:** Nothing below introduces a new platform-wide architectural concept. Every work stream either (a) executes a phase already named in the approved `docs/luv-platform-intelligence-architecture.md`/`docs/luv-platform-reconciliation.md` roadmap, or (b) hooks a presentation-layer moment (a celebration, an intro card) onto commitment-transition points that already exist from the Commitment Lifecycle/Timeline work — it does not add a new lifecycle state, ownership model, or publication concept.

---

## Scoping decisions (from clarifying questions)

1. **Full completion** — execute the remaining reconciliation-roadmap phases, not just cosmetic fixes.
2. **Celebrations** — build the framework + 5 milestones: Contract Signed, Final Payment Received, Guest List Submitted, Timeline Submitted, Wedding Website Published. Tied to real Commitment Lifecycle transitions, not polling. Confetti + warm message + optional Luv line + task-complete + progress-update, together, one consistent behavior.
3. **Vendor tone** — "professional hospitality / trusted operations partner." Concise, confident, service-oriented. Not a cheerleader, not cold-SaaS.
4. **Onboarding** — one-time, context-aware, first-appearance moment per audience that transitions into the first meaningful action (concierge-greeting shape), not a tour.

**Explicitly out of scope for this pass, named as follow-on work:**
- **Daily Briefing** (reconciliation §6/Phase 6) — a net-new, venue-wide cross-booking surface. Not a completion of anything existing.
- **Unified `kind`-tagged Observation Model + narration convergence** (reconciliation §4/§7, Phases 4 & 7) — an internal data-shape refactor across 4 Claude integrations with no direct user-visible effect on its own; more implementation-detail than product-experience, per the original instruction to focus this assessment on product experience.
- **Extending Luv into Requests, Floor Plans, and aggregate venue-facing Guests/Seating** (reconciliation §3/Phase 3) — net-new observation sources, not completions of an existing surface. Sizable on their own; a natural "Luv Experience Completion, Phase 2" candidate.
- **Meal/accessibility aggregate observations** — correctly left as an unresolved product decision per the docs; not this pass's call to make.
- **Progressive disclosure controls for the couple/vendor audience** (a "hide Luv" toggle equivalent to the coordinator's Settings) — named as a real gap in the assessment, deferred here since none of the four scoping answers asked for new settings UI. Flagged again in the Final Report as a candidate for Phase 2.

---

## Work Stream 1 — Fork Consolidation

**Wevenu HQ's `LuvInsights`** (`components/hq/venue-detail/luv-insights.tsx`): currently a self-documented v1 rules-pass over data already computed for beta scoring. Replace with a real call into the shared engine (`lib/luv/observations.ts`) for an arbitrary `venue_id` — HQ is staff tooling, not a venue's own session, so this needs an explicit admin-authorized entry point (mirroring the existing pattern used elsewhere in HQ for cross-venue reads: a `SECURITY DEFINER` RPC taking `p_venue_id` + an internal-staff check, not `current_user_venue_id()`). Implementation will confirm the exact shape of `observations.ts`'s public entry function before deciding whether it needs a venue-id-parameterized variant added alongside the session-derived one, or whether one already exists.

**Vendor App's `computeLuvData()`** (`app/vendor/luv/page.tsx`): a genuine, undocumented fork with zero shared code. Build `lib/luv/vendor-observations.ts` (mirroring `portal-observations.ts`'s shape and "states facts, never judges" rule, vendor-scoped instead of client-scoped) that reproduces the exact same "wins"/"observations" output shape the current fork already produces — reusing `lib/vendor-health/service.ts`'s already-computed health-score dimensions as Facts rather than recomputing them a second way (the same discipline §5/§6 of the reconciliation doc establishes for Event Readiness). Wire `app/vendor/luv/page.tsx` and `components/vendor-app/vendor-luv-briefing.tsx` to it. Retire `computeLuvData()` entirely.

---

## Work Stream 2 — Remaining Event Readiness Wiring

Per reconciliation §2/Phase 2, `lib/luv/observations.ts` is wired to `computePlanningReadiness` only. Extend the same substitution (replace whatever raw-table read currently backs each section with a call to the capability's own `compute*Readiness` function from `lib/readiness/compute.ts`) to:
- Timeline → `computeTimelineReadiness`
- Contracts → `computeContractsReadiness`
- Payments → `computePaymentsReadiness`
- Documents → `computeDocumentsReadiness`
- Communication → `computeCommunicationReadiness`

Also extract Website's ad hoc completeness heuristic (`!site.is_published && daysUntil <= 120`, `!site.content?.travel`, both currently embedded in `observations.ts`) into a new, small, Website-owned `computeWebsiteReadiness`-shaped function (mirroring `computeFloorPlansReadiness`'s shape, per both docs' explicit recommendation), and have `observations.ts` call it instead.

Each substitution is a pure re-source of an existing observation, not a new one — no new UI change expected from this work stream on its own, only more accurate/consistent underlying data (and removal of the last duplicated-readiness-logic instance the docs found).

---

## Work Stream 3 — Celebration Framework + 5 Milestones

**New, small persistence** (the "last observed state" piece both docs named as required and confirmed doesn't exist): one migration adding a `luv_celebrations` table — `id, venue_id, client_id, event_id (nullable), celebration_type, fired_at` — logging each celebration exactly once per entity (idempotency + audit, and the seed for the six remaining events later becoming configuration, not new infrastructure, per the framework's explicit design goal).

**One shared trigger point, not a poller.** Each of the 5 milestones already has a single, well-defined transition point in existing code (the same discipline the Commitment Lifecycle work established — fire at the transition, never infer from polling):

| Milestone | Trigger point | Celebrating audience |
|---|---|---|
| Contract Signed | `sign_contract()` RPC success (`lib/contracts/service.ts`'s `signContractByToken`) | The couple, on the sign page itself; the coordinator via the existing "contract signed" task auto-complete, now paired with a dashboard celebration |
| Final Payment Received | `markLineItemPaid` (`lib/payments/service.ts`), the exact moment `reconcileInvoiceBalance` brings the event-date invoice's `balanceDue` to `0` for the first time | The coordinator, in the payments UI at the moment of marking paid |
| Guest List Submitted | The Commitment Alignment Sprint's guest-list submission RPC | The couple, in the portal, at the moment of submission |
| Timeline Submitted | `submit_timeline` RPC (already fires `timeline_submitted`'s task auto-complete — the celebration hooks the same point) | The couple, in the portal, at the moment of submission |
| Wedding Website Published | The website publish action (Hosted Experience Platform) | Confirmed during implementation whether this is coordinator- or couple-triggered before wiring the celebrating audience |

A small `fireCelebration(type, ids, entity)` service function: checks `luv_celebrations` for an existing row (idempotent no-op if already fired), inserts if not, and returns a celebration payload `{type, message}` that the calling server action includes in its own return value — so the UI that already handles that action's result (sign page, payments UI, portal submit buttons) can trigger the presentation layer directly, with no new polling mechanism.

**Presentation, exactly as specified**: tasteful confetti (brief, not fireworks), a warm success message (tone matched to the audience — couple-companion register for the 4 couple-facing events, coordinator-analytical-warm for Final Payment Received), an optional one-line Luv congratulation reusing the existing persona-voice conventions per surface, and confirmation that task-completion + progress-update already fire from the existing playbook triggers (`timeline_submitted`, the guest-list equivalent, `contract_signed` via TR-L4's fix) — this work stream adds the emotional/visual layer on top of plumbing that already works, it does not rebuild the plumbing.

---

## Work Stream 4 — Vendor Tone Rewrite

Copy-only pass across the vendor app's Luv surfaces, per the exact register specified: professional, warm, service-oriented, never a cheerleader, never cold-status-text. Files: `app/vendor/luv/page.tsx`, `components/vendor-app/vendor-luv-briefing.tsx`, `components/vendor-app/vendor-health-score-widget.tsx`, and the `luvTip`-generating logic in `lib/vendor-health/service.ts`. Every string rewritten to the "your certificate of insurance is ready to upload" / "this item is due before the event — completing it now helps the venue stay on schedule" register the example pairs establish, not a blanket tone-neutral pass.

---

## Work Stream 5 — Onboarding (Minimal, Context-Aware)

One-time, dismissible, first-appearance introduction per audience, each transitioning directly into that audience's first meaningful action rather than stopping at a generic welcome:
- **Coordinator**: first Dashboard load with incomplete Getting Started → a short Luv introduction card that leads into the Getting Started checklist's own next-priority step (reuses the existing single-highest-priority-nudge selection already built for Getting Started, per the assessment's note that this pattern is already correct).
- **Couple**: first Portal Home visit → a short Luv introduction near the existing "From Luv" hero, leading into the first pending Planning task.
- **Vendor**: first Vendor Dashboard visit → a short Luv introduction leading into profile completion (the vendor equivalent of "first task," already the top gap in the Business Health Score).

Each needs one small persisted "seen" flag (venue-level, client-level, vendor-level respectively) — reusing the existing `onboardingDismissed`-style boolean pattern already established for the Getting Started card, not a new mechanism.

---

## Work Stream 6 — Empty-State Consistency

One deliberate rule, applied consistently: **a primary/anchor Luv surface** (the main per-audience card — coordinator Dashboard widget, the Vendor `/vendor/luv` page) **always shows a light reassurance empty state**; **a secondary Luv fragment embedded inside another feature's own UI** (Momentum widget, Wedding Day Ops panel, couple-portal section observations) **may omit itself entirely**, since the parent surface already has its own content and won't read as broken. Concretely: add a light reassurance empty state to the Momentum widget (currently hard-vanishes despite being dashboard-primary) and confirm the Vendor `/vendor/luv` page has one too (currently the embedded briefing card hard-vanishes with no page-level fallback). Wedding Day Ops and portal section observations keep their current (correct, per this rule) omission behavior.

---

## Work Stream 7 — Small Named Fixes

- **Digest email's dormant `luvObservation` block**: wire `lib/notifications/digest-engine.ts` to pull the top-priority real observation for that venue from the now-more-complete `observations.ts`, replacing the hardcoded `null`. Turns a shipped-but-dead feature on.
- **Roll-Up's "weekly" copy mismatch**: correct the copy to not imply an automatic cadence the product doesn't deliver (e.g. "Generate a fresh synthesis anytime" rather than "Your weekly synthesis") — the safer, smaller fix. A real cron-scheduled auto-generation is new infrastructure beyond this pass's bounds and is named here as the deferred alternative if wanted later.
- **Floor Plan Templates' Luv exclusion**: align it with the parallel Playbook/Timeline-Template import flows if the "paste and structure" pattern is technically applicable to floor-plan layout data; if implementation finds a real structural reason it isn't (spatial data vs. free text), document that reason explicitly rather than leaving the inconsistency unexplained, which is the actual problem today.

---

## Validation Plan

- `tsc --noEmit` + `next build` clean, matching this project's standing discipline.
- Live-tested (real authenticated sessions, not service-role bypass) for: each of the 5 celebration trigger points firing exactly once and being idempotent on retry; the HQ and Vendor App fork replacements returning real data for a real venue/vendor; the three onboarding cards appearing once and not reappearing after dismissal; the digest email's `luvObservation` now populating for a venue with a real observation.
- Manual/visual check (this environment's standing limitation, same as noted in the Engineering Cleanup report) for the confetti/celebration presentation layer's look and feel, and the vendor tone rewrite's actual voice — these are judged by reading the rendered copy/component, not just by an automated pass.

---

## Final Report will include

Everything the prior initiatives' final reports have included, plus: an explicit list of what was found already-more-complete-than-documented (as happened with the schema-repair migration), and a named Phase 2 candidate list (Daily Briefing, Observation Model unification/narration convergence, Requests/Floor-Plans/aggregate-Guests-Seating extension, couple/vendor progressive-disclosure controls) for whenever Capability Completion returns to Luv.
