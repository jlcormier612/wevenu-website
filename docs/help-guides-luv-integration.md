# Help & Guides — Luv Integration

**Type:** Architecture specification only. Nothing here has been implemented; no Luv behavior has been changed.
**Companions:** `docs/help-guides-product-education-audit.md` (the current Success Library / Luv naming conflict finding), `docs/help-guides-information-architecture.md` (Part 7's per-surface contextual-help map, referenced below).

---

## The naming conflict, resolved

The current product genuinely, actively brands the Success Library as **"Luv's Success Library"** — the page title, the route, and Luv's own established persona all already claim ownership of this content today. The direction for this initiative is the opposite: Help & Guides should be the canonical, product-owned knowledge; Luv should be the concierge that *points to* it, never a second knowledge base.

**Recommendation: rename and re-scope, don't just re-theme.** "Luv's Success Library" becomes **"Help & Guides"** — a product-owned surface with its own real navigation entry point (the audit doc's single highest-leverage finding: it currently has none at all). Luv keeps her voice *when she surfaces a link into it* ("♡ Need a hand with floor plans? See the 30-second guide") but stops being the thing the content is filed under. This is not a cosmetic rename — it's the one decision that prevents the exact outcome the brief explicitly warns against: **teaching Luv things independently, and eventually having two competing sources of truth.** The infrastructure question is separate and answered in Part 13 of the companion architecture doc: reuse `success_library_articles`' real, working, HQ-authored content pipeline as the store for *all* Help & Guides content, not just the current 5 Best Practice pieces.

---

## What Luv already has, and should reuse (not duplicate)

Confirmed via direct inspection of `lib/luv/`: a real, mature Decision Engine — `recommendation-service.ts`, `insights-service.ts`, `health-service.ts`, `observations.ts` (plus domain-specific observation modules for setup, vendor, portal, and communication), `briefing-service.ts`, `action-service.ts`, `celebrations.ts`, `memory-service.ts`. This is exactly the "notices something, suggests something" machinery Luv needs to point at Help & Guides — **the recommendation should be a new *output type* from this existing engine, not a new engine.** Concretely: when an existing observation fires (e.g., a setup-observation detects a venue hasn't touched their brand colors, or a communication-observation detects a first-time Conversation send), the recommendation service's existing "what should Luv say" logic gains one more possible action shape: *link to a specific Help & Guides article*, alongside its existing repertoire of suggested actions.

**The dormant `linked_gap_keys` field on `success_library_articles` is the connective tissue that already exists for this and isn't wired to anything today** (confirmed — zero consumers found outside the success-library module itself). This is very likely the intended original mechanism for exactly this pairing (a "gap" Luv's health/observation system detects, linked to the article that addresses it) — recommend reusing and finally wiring this field rather than inventing a parallel tagging system.

---

## Where Luv should surface

Matched against the per-surface map in the companion IA doc's Part 7, kept deliberately short per the brief's own "never overdo it" instruction — Luv only speaks where a real, specific trigger exists, not everywhere help theoretically could apply:

1. **First time entering Floor Plan Studio** — "♡ Need a hand with floor plans? See the 30-second guide" → the Lock/Icon Quick Answer. One-time, dismissible, never repeats once seen.
2. **Before sending a contract for the first time** — "♡ Luv noticed something you may want to review before sending" → the "Who signs first" What-Is-This, *only* while venue-first signing is mid-rollout (per the audit doc's flag that this behavior is actively changing) — this specific nudge should be retired once the new signer model is fully shipped and self-explanatory in the UI itself.
3. **After a booking is confirmed** — "♡ You're ready for the next step" → the New Booking Guided Journey. This is the single strongest, already-proven-pattern candidate (Luv's existing `celebrations.ts` already fires a real celebration at this exact moment for `contract_signed` — the help-journey link is a natural, low-risk addition to an event Luv already reacts to).
4. **First invoice/payment-plan creation** — a light nudge toward the "sent/paid/void" Quick Answer, tied to the existing communication/financial observation surface.
5. **On save of a first-ever brand color change** — a single, one-time nudge toward "Where do my colors show up," specifically because the audit confirmed this answer is genuinely non-obvious even by design, not just under-documented.

## Where Luv should explicitly stay silent

- **Every Quick Answer and How-To reachable via normal search or a visible Help link** — Luv should not proactively narrate content a venue can already find in two clicks; her value is catching the moments a venue wouldn't think to look.
- **Routine, repeated actions** (a tenth floor plan, a fiftieth invoice) — a nudge fires once per genuinely first-time moment, never as a recurring reminder for something the venue has clearly already learned.
- **Anything already covered by the product's own established "Luv never talks just because she can" philosophy** — this initiative adds one new *type* of thing Luv can point to; it does not loosen when she's allowed to speak.
- **The known, honest limitations** (Stripe not yet live, Conversations emails currently unbranded) — Luv should never proactively surface these as if they were help opportunities; a venue asking directly gets the honest Why answer, but Luv volunteering "did you know your emails aren't branded" would read as the product criticizing itself unprompted, which is a tone mismatch with her established persona.

---

## The guardrail, restated as an architectural constraint, not just a policy

No Luv-facing code should ever contain hardcoded help copy. Every Luv → Help & Guides pointer is a **slug reference** into the same `success_library_articles` (renamed Help & Guides) table every other surface reads from — if the article changes, every Luv nudge pointing to it updates automatically, with nothing to keep in sync by hand. This is the concrete, checkable version of "Luv should not become a second knowledge base": if a future code review ever finds a string of actual help *content* inside `lib/luv/`, that's the signal this constraint has been violated, not a matter of degree.
