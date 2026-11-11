# Current state and root cause — guided EO template setup

## Root cause

The category-first builder improved information architecture (section nav, nested branches, category-aware Offering picker, preview) but still required venue owners to understand the **internal model**: sections, choice groups, dependency wiring, and how those map to the client experience.

Concrete gaps:

1. Setup started from **existing categories/groups**, not from “what does this venue offer?”
2. Pattern selection (included vs choose-one vs conditional follow-ups) was implicit in group settings, not a guided plain-language step.
3. Empty dependent branches were flagged as incomplete without guiding the venue to fill **or skip** each parent option’s follow-ups in sequence.
4. The preferred Offering filter **silently fell back to the full catalog** when no category matched — producing mixed Catering/Bar/Rentals lists that looked like undifferentiated inventory.
5. Preview sat on the same long page as editing, so the setup → client-choice relationship was weak.

The choice-tree engine, Offering IDs, freeze, and financial path were not the defect — the **setup workflow** was.

## What we did not change

- Conditional choice runtime (`depends_on_option_ids`)
- Offering identity / snapshot semantics
- Package inclusion seeding
- Invoice / payment-plan contracts
- Bulk rewrite of existing templates
