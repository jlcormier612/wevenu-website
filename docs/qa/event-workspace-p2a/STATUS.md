# P2-A — Event workspace tabs + cards

**STATUS: GREEN / COMPLETE** (Sandbox serving + browser verified)  
**Date:** 2026-10-23  
**Product commit:** `591b2493db49eba1d1806edfbdfd5c3dda66fd68`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40000723214 (success)  
**Serving image:** `htc-sandbox-venue-app:591b2493…`  
**Digest:** `sha256:917f20279daa851d585c167c661c1ce188149826d907ff54f15103ba446ec86e`  
**Production:** untouched  

## Scope (P2-A only)

- Venue tab restructure + Questionnaires card + Inventory & Event Order card  
- Deep links preserved  
- **No** commercial send/finalize/invoice/scheduling changes  
- P2-B–E not started  

## What shipped

| Surface | Result |
| --- | --- |
| Row 1 | Planning Overview · Planning Tasks · Timeline · Floor Plans · Vendors |
| Row 2 | Documents · Payments · Conversation · Activity · Internal notes · Luv |
| Cards | Questionnaires; Inventory & Event Order (Open EO / Open Inventory) |
| TabsContent | questionnaires / inventory / event-order still hash-addressable |
| Couple nav | Inventory & Order hidden until shared; **kept when shared** (this Fancy fixture still shows both with badges) |

## Deferred (not P2-A)

- Full removal of couple Inventory/Order when shared → **P2-D** (Docs-first)  
- Commercial guided spine / send parity → **P2-B/C**  

## Units

```text
25/25 pass (workspace-tab-nav-p2a + constants + c6 cleanup + questionnaire guidance)
```

## Live browser (`EXPECTED_SHA=591b2493…`)

```text
9 pass / 0 fail → browser-results.json
```

| Check | Result |
| --- | --- |
| serving-sha | PASS |
| row1 / row2 labels | PASS |
| questionnaires + inventory-eo cards | PASS |
| card → event-order | PASS |
| `#event-order-choices` / `#questionnaires` | PASS |
| couple nav gating note | PASS (fixture still shared → nav entries retained by design) |

Shots: `docs/qa/event-workspace-p2a/shots/`
