# Before / after — default Ceremony + Reception (`EO-D-02`)

Configured prices below are the **starter master** values (venues may reprice). Illustrative brief numbers matched these masters.

## Before (legacy flat)

| Section | Lines (all fixed; 0 choice groups) |
| --- | --- |
| Ceremony | Ceremony Coordination $500 flat; Arbor $350 flat |
| Catering | Plated Dinner $85/pp; Buffet Dinner $72/pp |
| Bar | Beer & Wine $28/pp |
| Rentals | Chiavari Chair $8/chair |
| Services | Day-of Coordination $1200 flat (not marked included on EO-D-02) |

Semantics: every row was a template line. Package apply could materialize dinners + Arbor as Additional charges without couple picks.

## After (corrected)

| Section | Included / fixed lines | Choice groups |
| --- | --- | --- |
| Ceremony | Ceremony Coordination $500 flat (**included**) | **Ceremony enhancements** — multi, optional (min 0): Arbor $350 flat |
| Catering | — | **Dinner service** — single, **required** (min 1, max 1): Plated $85/pp, Buffet $72/pp |
| Bar and beverages | — | **Bar package** — single, **optional** (min 0, max 1): Beer & Wine $28/pp |
| Rentals | — | **Optional rentals** — multi, optional, allow quantity: Chiavari Chair $8/chair |
| Services | Day-of Coordination $1200 flat (**included**) | — |

### Wedding Reception (`EO-D-01`) — same rules

- Dinner service: required pick-one (Plated / Buffet)
- Bar package: required pick-one (Beer & Wine / Full Bar $42/pp)
- Optional rentals: Chiavari + Farm Table (multi, qty)
- Day-of Coordination: included fixed line

### Unresolved venue policy (documented, not invented)

Default `EO-D-02` catalog does **not** include Premium open bar, Signature cocktail, or Champagne toast. Those example brief items were not added. Bar service on EO-D-02 is optional (couple may decline). EO-D-01 treats bar package as required pick-one because the starter defines two mutually exclusive packages for a reception.
