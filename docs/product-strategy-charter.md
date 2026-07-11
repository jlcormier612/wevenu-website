# Wevenu Product Strategy Operating Charter

**Status:** Adopted 2026-07-08 (per the venue owner). This is the governing framework for every recommendation from here forward — it sits above the Program 2 North Star in `docs/program-2-implementation-plan.md` and every other principle document this project has produced, not alongside them. Where any of those documents' specific language and this Charter appear to differ, this Charter wins; in practice they were written in the same spirit and should agree.
**Framing, stated directly:** We are no longer inventing Wevenu. We are designing, refining, and completing it. The core philosophy is already established.

---

## Governing Product Principles

These override feature ideas and implementation convenience.

**1. Trust First.** Every decision should increase trust between the venue and the platform. The system never performs meaningful business actions without approval. **System proposes. Human confirms.** — across the entire platform: AI suggestions, vendor enrichment, timeline recommendations, import reconciliation, contact merging, package recommendations, pricing suggestions, calendar conflict resolution, notification drafts. AI assists. The venue decides.

**2. Reduce Cognitive Load.** Venue owners should never feel overwhelmed. Hide complexity, reveal only what is needed, minimize decision fatigue, eliminate duplicate work.

**3. Relationship Workspace.** Everything revolves around relationships. The venue is not managing records — the venue is managing people: clients, guests, vendors, staff, partners. Every workflow should strengthen that model.

**4. System of Record.** Every piece of information has one authoritative home. Avoid duplicate data, conflicting edits, multiple sources of truth.

**5. Intentional Information Flow.** Information moves through ownership rules, visibility rules, notification rules, permissions, tasks, history. Nothing appears or changes without a reason.

**6. Progressive Disclosure.** Advanced functionality appears only when needed. Approachable for first-time venue owners; still supports experienced operators.

**7. Hospitality over Software.** The venue experiences customers — not architecture, not databases, not workflows. Technology should disappear into hospitality.

**8. Long-Term Maintainability.** Optimize for systems easier to understand a year from now than today. Prefer simple, composable models over clever implementations.

**9. Control.** Every feature must make the venue feel more in control than before they used Wevenu. *(Added 2026-07-08, alongside the Vendor Network review — stated as an addition to, not a replacement of, principles 1–8.)*

## Product Goal

Intentionally beyond MVP. Optimizing for confidence, clarity, trust, elegance, scalability, maintainability — not speed of launch. Completeness and customer confidence are the priority.

## Recommendation Guidelines

When proposing features: simplify before expanding, remove before adding, unify before separating, reuse before creating, ask whether this increases confidence. Do not recommend features because competitors have them — only because they reinforce the governing principles above.

## AI Behavior

Challenge unnecessary complexity. Identify hidden duplication. Recommend simplification whenever possible. When multiple solutions exist, prefer the one that creates the clearest mental model for venue owners. Always explain trade-offs. Never optimize for engineering convenience at the expense of user understanding.

---

## How this document should be used

Every design document and review from here forward should be checkable against this Charter directly — not just against whichever narrower principle set (Program 2's North Star, the Engineering Standards) happens to be in scope for that piece of work. `docs/vendor-network-charter-review.md` is the first review conducted explicitly against it; future reviews of other subsystems (Assets, Calendar, Luv, HQ) should follow the same shape: verified findings, not inferred ones, organized by which principle each finding actually violates, with trade-offs named rather than assumed away.
