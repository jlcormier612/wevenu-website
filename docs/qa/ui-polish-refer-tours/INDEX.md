# UI polish — Refer headline + Lead Tours actions

Pre-merge visual evidence (fixture renders exact headline classes + scoped tour-action CSS from this branch).

| Shot | Viewport | Surface |
|------|----------|---------|
| `shots/desktop-refer-headline.png` | 1440 | Refer a Venue headline |
| `shots/mobile-refer-headline.png` | 390 | Refer a Venue headline |
| `shots/desktop-tours-actions.png` | 1440 | Lead Tours appointment actions |
| `shots/mobile-tours-actions.png` | 390 | Lead Tours appointment actions |
| `shots/*-full.png` | both | Combined fixture |
| `shots/*-metrics.json` | both | Measured color/size/heights |

Measured (Chrome):

- Headline desktop: `rgb(79, 95, 79)`, weight `400`, `56px`, Cormorant Garamond
- Headline mobile: same color/weight, `32px` via clamp
- Tour buttons desktop: height `36px`, `14px` / medium, padding `15px`, gap `8px`
- Tour buttons mobile: height `44px` (a11y floor), `13px` / medium, padding `14px`
- No horizontal overflow
