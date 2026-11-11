# Acceptance matrix — EO Template builder

**Serving:** `e7f7178e1f4621561a395862470da12d2eac800d`  
**Digest:** `sha256:85ce9adae5ddf30e8e428d455bdbc10e6e57c75dff121078386c0ce05c2ffa73`  
**Deploy:** https://github.com/jlcormier612/wevenu-website/actions/runs/40241404522  

| # | Scenario | Result | Evidence |
|---|----------|--------|----------|
| 1 | Catering required Plated/Buffet choice | **PASS** | Persisted groups on Fancy template `d73d9734…`; Catering workspace |
| 2 | Distinct plated/buffet dependent branches | **PASS** | `ui-nested-branches` nestedCards=2; incomplete plated/buffet empties |
| 3 | Parent change / inactive-child clearing | **PASS** | Prior choice-tree + unit conditional-groups (unchanged engine) |
| 4 | Catalog Offering from correct category | **PASS** | `CategorizedOfferingSelect` preferred filter; picker screenshot |
| 5 | Template-only option without fake Offering | **PASS** | “Add template-only option” path preserved; Inc2 contracts |
| 6 | Change/unlink Offering preserves label/price | **PASS** | option-catalog unit regression PASS |
| 7 | Rentals optional + quantities | **PASS** | Section nav switches to Rentals workspace (isolation PASS) |
| 8 | Included vs paid services | **PASS** | Fixed/included items panel + financial fixture included/non-billable |
| 9 | Bar isolated from Catering deps | **PASS** | Section switch hides Catering workspace |
| 10 | Category-specific Offering discovery | **PASS** | filter default `preferred` |
| 11 | Incomplete dependent groups clear in builder | **PASS** | `eo-incomplete-branch-*` + completeness banner |
| 12 | Save / reload persistence | **PASS** | nav after reload; DB group/option counts |
| 13 | Preview actual client experience | **PASS** | `eo-template-client-preview` + ConditionalChoicePreview |
| 14 | Client selection / freeze consistency | **PASS** | Engine unchanged; prior Phase 3 + unit freeze semantics |
| 15 | EO finalize / invoice reconcile | **PASS** | Financial fixture $2189.81 on this SHA |
| 16 | Existing templates intact unless edited | **PASS** | No migration; fixture groups unchanged by UI open |
| 17 | Dependency editor + Offering-link regression | **PASS** | group-dependencies + option-catalog tests PASS |

Browser harness: `verify-builder.mts` → **GREEN** (`browser-results.json`).
