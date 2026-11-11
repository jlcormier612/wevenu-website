# Phase 11A Final Verification — Documents

## Correct surface

Prior 11A capture used `/library/documents` (venue library files — empty/low for Fancy).  
Staff **Documents workspace** is **`/documents`** (`DocumentWorkspace` + `WorkspaceDocumentCard`).

Populated Fancy Venue: **290** document titles with `.htc-record-link`.

**No Sandbox writes** — read-only auth + existing records.

## Desktop

| Check | Result |
|---|---|
| Charcoal title (`rgb(36, 51, 43)`) | Pass |
| Default decoration none | Pass |
| Hover underline, stays charcoal | Pass (computed style) |
| Focus-visible inset 2px ring | Pass |
| Title is `BUTTON` `data-testid="workspace-doc-title"` | Pass |
| No page overflow-X | Pass |
| Desktop action strip present | Pass (`data-htc-doc-actions="desktop"` × 290) |

Screenshots:
- `evidence/documents-desktop.png`
- `evidence/documents-desktop-hover.png`
- `evidence/documents-desktop-focus.png`

## Mobile — Phase 10 regression

| Check | Result |
|---|---|
| Titles present / charcoal | Pass |
| Pin + Open visible beside title | Pass (screenshot) |
| Overflow menu opens (View / Details / Version History) | Pass |
| No horizontal overflow | Pass |
| Title interaction does not block Pin/Open/More | Pass |

Screenshots:
- `evidence/documents-mobile.png`
- `evidence/documents-mobile-hover.png`
- `evidence/documents-mobile-focus.png`
- `evidence/documents-mobile-overflow-open.png`

## Probes (`browser-results.json`)

Desktop & mobile: `charcoalOk`, `hoverUnderline`, `hoverStaysCharcoal`, `focusHasOutline` all **true**; mobile `overflowMenuVisible` **true**.
