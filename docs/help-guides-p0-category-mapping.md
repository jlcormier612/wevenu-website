# Help & Guides P0 — Category Mapping Decision

**Status:** Category mapping resolved and used for P0 content publish (2026-08-13).
**Decision date:** 2026-08-12
**Implementation:** `docs/help-guides-p0-content-implementation.md`

---

## Decision

**Option B** — Keep the existing **12-area** Help taxonomy unchanged (`lib/help-guides/areas.ts`).

Do **not** create an Automations category.
Do **not** change Help taxonomy.
Do **not** write or publish article bodies in this step.

All four Automation-topic articles are mapped to:

**Finding & Booking Clients**

---

## Final category assignment (18 articles)

| # | Title | Category (`goal_category`) | Notes |
|---|---|---|---|
| 1 | Getting Started: Your First Morning | Getting Started | **Existing** — do not recreate |
| 2 | What should I set up before I start? | Getting Started | New — copy pending |
| 3 | How does my Pipeline work? | Finding & Booking Clients | New — copy pending |
| 4 | Can I customize my Pipeline stages? | Finding & Booking Clients | New — copy pending |
| 5 | What happens when I move a lead into a stage with an Automation? | Finding & Booking Clients | New — copy pending |
| 6 | What's the difference between a Lead and a Client? | Working With Clients | New — copy pending |
| 7 | Who signs a contract first, and what happens after? | Contracts & Payments | New — copy pending |
| 8 | Can more than one person sign a contract? | Contracts & Payments | New — copy pending |
| 9 | Can couples pay online? | Contracts & Payments | New — copy pending |
| 10 | What do Sent, Paid, and Void mean on an invoice? | Contracts & Payments | New — copy pending |
| 11 | What's the difference between a Package, Inventory, and an Inventory Template? | Building the Event | New — copy pending |
| 12 | What do the Floor Plan Studio icons mean? | Building the Event | New — copy pending |
| 13 | How do I move an object that's behind another one? | Building the Event | New — copy pending |
| 14 | What is an Automation? | Finding & Booking Clients | New — copy pending (Automation topic) |
| 15 | Can I pause an Automation for just one person? | Finding & Booking Clients | New — copy pending (Automation topic) |
| 16 | Why did this person get this message? | Finding & Booking Clients | New — copy pending (Automation topic) |
| 17 | What happens to an Automation if someone is marked Lost, Cancelled, or books? | Finding & Booking Clients | New — copy pending (Automation topic) |
| 18 | Where do my venue colors actually show up? | Your Venue | New — copy pending |

---

## Explicitly unchanged

- `lib/help-guides/areas.ts` — still 12 areas
- No Automations category
- No article content written or published
- No migrations for new articles
- No Help UI, search, Luv, taxonomy, or navigation changes

---

## Next step (blocked on you)

Provide approved final article copy for the 17 new articles. Implementation will seed/publish via the existing `success_library_articles` pipeline using the mapping above.
