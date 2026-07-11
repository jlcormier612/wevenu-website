# ADR-0005: System Proposes. Human Confirms.

**Date adopted:** 2026-07-08 (stated as Charter Principle 1; the general pattern predates the Charter and is confirmed throughout Program 2 — vendor enrichment, import reconciliation, timeline recommendations).

## Decision

The system never performs a meaningful business action without explicit human approval. AI suggestions, imports, merges, automated task generation, and any automatically-created record are always presented for confirmation before they become real, never applied silently.

## Reasoning

Trust is the platform's foundational currency for a venue owner handing over parts of their business operation to software. An AI or automation that quietly acts on a venue's behalf — even correctly — erodes the sense of control the Charter's own Principle 9 names directly ("every feature must make the venue feel more in control than before they used Wevenu"). A wrong suggestion the venue can reject costs nothing; a wrong silent action costs trust that's expensive to rebuild.

## Alternatives considered

- **Fully automatic execution with an undo option** — considered and rejected for anything non-trivial; an undo model still requires the venue to notice something happened before they can undo it, which fails the same trust test a confirmation step doesn't.
- **Confirmation only for "risky" actions, automatic for the rest** — rejected as a slippery categorization; the Charter treats this as universal rather than judgment-call-by-judgment-call, which is also easier for a venue to reason about ("the system always asks") than a partial rule they'd have to learn the exceptions to.

## Where it applies

Universally — named explicitly in every Charter-era design document produced this program: vendor enrichment/auto-discovery (`docs/vendor-onboarding-and-assets-design.md`), the Booked→Client transition's single confirmation screen (`docs/booking-journey-design.md`), Luv's task nudges (`docs/planning-playbook-experience-design.md`), Playbook-template edits offering future/upcoming/this-event scoping rather than applying silently (`docs/planning-playbooks-design.md`).
