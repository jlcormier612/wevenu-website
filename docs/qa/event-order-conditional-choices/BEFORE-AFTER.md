# Conditional choices — before / after

## Before

- Dinner (Plated / Buffet) and Bar were flat sibling choice groups.
- No persisted dependency: every group rendered and validated regardless of parent.
- Switching Plated → Buffet left any later “detail” answers intact if they existed as separate groups.
- Couples saw every package’s follow-ups at once (or none at all, with details far down the sheet).
- Catalog had no plated/buffet child menu items; nothing honest to nest.

## After

### Starters (EO-D-01 Wedding Reception, EO-D-02 Ceremony + Reception)

| Parent | Dependent (honest empty until venue configures) |
|--------|--------------------------------------------------|
| Dinner service → Plated Dinner | Plated dinner details |
| Dinner service → Buffet Dinner | Buffet dinner details |
| Bar package → Beer & Wine | Beer & Wine details |
| Bar package → Full Bar (EO-D-01 only) | Full Bar details |

Commercial prices unchanged: Plated $85, Buffet $72, Beer & Wine $28, Full Bar $42, Arbor $350, Chiavari $8, included coordination intact.

### Client flow

1. Couple picks parent (e.g. Plated).
2. Only that parent’s dependent group appears immediately beneath it.
3. Switching parent clears inactive child answers and recalculates billable lines on finalize.
4. Required active children block submit; inactive required children do not.
5. Server RPC rejects orphans and missing required active groups even if the UI is bypassed.

### Fixture vs catalog

Harness may inject **QA Fixture** options into a disposable frozen definition to prove reveal/switch/billable behavior. Those options are not starter catalog items and are not written onto venue templates.
