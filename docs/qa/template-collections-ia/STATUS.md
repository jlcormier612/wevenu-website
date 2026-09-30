# Template Collections — Forensic Matrix (pre-implementation)

Date: 2026-09-30
Reference pattern: Contract Templates (`/library/contracts` + `ContractTemplateList`)

## Shared building blocks already in use

| Piece | Location | Notes |
|---|---|---|
| PageHeader | `components/shell/module-placeholder.tsx` | title + description + optional `actions` (Contract puts `+ New Template` here) |
| LibraryAssetCard | `components/library/library-asset-card.tsx` | Preview / Edit / Use primary row + overflow |
| LIBRARY_LABELS | `components/library/labels.ts` | Shared action language |
| CollectionBackLink | `components/library/collection-back-link.tsx` | Destination-named back (used on editors/previews, not all collection pages) |
| Starter provision | `ensure*StartersForCurrentVenue` | Awaited on collection pages; soft-fail hardened this pass |

## Collection matrix

| Collection | Route | Header New | Import? | Row primary | Overflow | Notes / gaps |
|---|---|---|---|---|---|---|
| Contract | `/library/contracts` | `+ New Template` in PageHeader ✅ | No (correct) | Preview / Edit / Use Template | Duplicate, Archive, Delete | **REFERENCE** |
| Planning | `/library/playbooks` (`/library/planning-templates` → redirect) | `New template` at **bottom** ❌ | `Import a checklist` bottom ❌ (real) | Preview / Edit / Use Template | Dup, Archive, Delete, Set Default | Capabilities moved to Settings; must not return. Move New+Import to header; labels. |
| Timeline | `/library/timeline-templates` | `New Template` in list toolbar (not PageHeader) | Import via New dropdown upload/paste (real) — keep inside New (no fake separate Import unless split) | Preview / Edit / Use Timeline | Dup, Archive, Delete, Rename, Default | Soft-fail ensure*; label `+ New Template`; move to PageHeader |
| Floor Plan | `/library/floor-plan-templates` | `+ New Floor Plan Template` in toolbar ❌ | Upload/paste are create paths inside New (not a separate Import product action) | Preview / Edit / Use Floor Plan | Dup, Archive, Delete | Rename to `+ New Template`; move to PageHeader |
| Event Order | `/library/event-order-templates` | `+ New Template` in list toolbar | No | Preview / Edit / Use + **Send** | Dup, Archive, Delete | Move New to PageHeader; keep Send |
| Inventory | `/library/inventory-templates` | `+ New Template` in list toolbar | No | Preview / Edit / Use + **Send** | Dup, Archive, Delete | Move New to PageHeader; keep Send |
| Message | `/communication/templates` | New in PageHeader; Import Messages | Yes (real) | Preview / Edit (Use via compose) | Dup, Archive, Delete | Label Import → `Import`; order New then Import; `+ New Template` |
| Pipeline | `/library/pipeline-templates` | `+ New Pipeline Template` | No | (different IA) | — | Out of Templates hub commercial set; leave unless exposed on Templates landing as template collection |
| Choices | `/library/choices-templates` | MUST STAY ABSENT from landing | — | — | — | Locked commercial model — do not re-surface |

## Import capability truth

| Type | Genuine import? | Placement after fix |
|---|---|---|
| Planning | Yes — checklist text/file | `[+ New Template] [Import]` header |
| Message | Yes — paste messages | `[+ New Template] [Import]` header |
| Timeline | Yes — upload/paste inside New menu | Keep as New submenu (same as today); no fake extra Import button |
| Floor Plan | Upload image / paste layout = create paths | Keep inside New; **no** separate Import |
| Contract / EO / Inventory | No | No Import |

## Regression / load safety

| Issue | Finding |
|---|---|
| `/library/timeline-templates` GlobalError | Page **loads** on running Sandbox `95cf65b7` / TD `:468` (digest `sha256:00e2dccd…`). Hypothesized cause: uncaught throw from `ensureTimelineStartersForCurrentVenue` / sibling ensure helpers on provision race. Soft-fail catch added; regression test added. Alias `/library/planning-templates` → playbooks. |
| Planning capabilities on Planning Templates | Removed from playbooks page in `95cf65b7`; Settings `#planning` owns them. |

## Implementation plan (this pass)

1. Soft-fail all collection `ensure*` helpers + regression test (done).
2. Standardize create labels to exactly `+ New Template`.
3. Move create (+ Import where real) into PageHeader `actions`.
4. Standardize primary row label `Use` (Preview / Edit / Use).
5. Preserve Send only on EO + Inventory.
6. Planning Import label → `Import`; remove bottom create strip.
7. Tests for labels / no Planning capabilities / no Choices on landing.
8. Deploy Sandbox; browser-prove every collection on exact image.
