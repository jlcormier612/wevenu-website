# Future Initiative: Commercial Proposal Architecture

**Status: Deferred future initiative. Not scheduled. Not part of the Commitment Alignment Sprint.**

Design a formal Proposal artifact that bridges Sales CRM and Booking, allowing pricing, packages, revisions, and client acceptance prior to Event Order creation.

## Why this is documented separately, not folded into the Commitment Alignment Sprint

Raised during the Commitment Alignment Sprint's Booking Financial alignment item (`docs/commitment-lifecycle-architecture.md` §9) as one of two judgment calls needing an explicit decision, alongside the guest count / event type / event date triplication fix. The direction, decided 2026-07-17:

**A Proposal is not a Commitment Lifecycle artifact.** It is a pre-commitment commercial artifact that precedes Booking and Event Order entirely — pricing, packages, and revisions happening before there is anything to commit to yet. It should not be forced into the Commitment Lifecycle's Draft → Submitted → Committed → Superseded → Archived shape simply because it happens to come before commitment; that shape is for artifacts that get committed, and a Proposal's job is to be accepted or revised *before* a Booking/Event Order is ever created; committing then belongs to what it produces, not to itself.

**It should not be introduced during the Commitment Alignment Sprint.** That sprint's purpose is aligning *existing* domains (Guest List, Seating, Vendor Selection, Booking Financial) to the already-approved Commitment Lifecycle Architecture — not introducing new commercial capabilities. A Proposal artifact would be new product surface, not an alignment of something that already exists.

**This is not a decision to leave it as "just a label."** Today, a Lead's `proposal_sent` pipeline stage is a status value with no artifact behind it — no pricing, no packages, no revision history, no client acceptance flow. That current state is an honest limitation of the product today, not the intended long-term design, and should not be characterized or documented as a deliberate simplification. The gap is real and worth closing — just not inside this sprint.

## What the eventual design needs to account for

Not designed yet — this section names the shape of the problem, not the solution:

- **Where it sits:** between the Sales CRM (Lead) and Booking (Client/Event/Event Order) — the platform's other major artifact-precedes-commitment sequence Booking Financial alignment work touched (Event Order → Invoice) is a useful reference point for how a "produces a real object once accepted" flow can work, without implying the same Commitment Lifecycle machinery applies here.
- **Pricing and packages:** needs its own versioned pricing/package selection, most likely reusing or extending the Package/Package-pricing concepts Booking Financial's Event Order work already established, rather than inventing a second, parallel pricing model.
- **Revisions:** a Proposal needs to be revisable before acceptance in a way that's honest about what changed — echoing (not necessarily reusing verbatim) the append-only submission/version pattern used elsewhere on this platform, adapted for a pre-commitment artifact rather than a post-commitment one.
- **Client acceptance:** the actual trigger that turns an accepted Proposal into the start of a real Booking/Event Order — this is the one place a Proposal-specific "commit" moment does matter, even though the Proposal itself isn't a Commitment Lifecycle artifact; worth explicit design attention on whether that acceptance moment reuses any Commitment Event vocabulary or is deliberately its own thing.
- **Relationship to the Lead pipeline's `proposal_sent` stage:** today's stage becomes a real signal ("a Proposal object exists and was sent") instead of a bare status value with nothing behind it.

## Scope note

This document exists to preserve the decision and its reasoning, not to commit to a timeline. No implementation, schema, or UI work has been done for this initiative. When it is picked up, start from a design pass and explicit scope approval, the same process every other domain in this sprint went through, rather than treating this document as a spec.
