# NAV-PERF discovery — Sandbox baseline

**Measured:** 2026-11-19  
**Serving SHA:** `4787fbaba2b4da14d447e4e220f8a16923fab5a2`  
**Venue:** Jen’s Fancy Venue  
**Method:** Playwright wall-clock to useful selector; request waterfall. No OpenAI, no mutations.

## Cold useful-visible (ms)

| Route | Useful | DCL | Notes |
|-------|-------:|----:|-------|
| leads_list | 7243 | 7175 | Slowest |
| dashboard | 5574 | 5550 | |
| events_list | 3012 | 661 | Useful after list rows; DCL early |
| event_workspace | 3001 | 2444 | Redirects `/events/[id]` → `/clients/[id]?eventId=` |
| settings | 1340 | 1266 | |
| lead_workspace | 1241 | 1174 | Already fast (C1 deferral) |
| setup_hub | 620 | 533 | Fastest |

Warm repeats remain multi-second for Leads/Dashboard (≈3–4s), so this is not only cold-cache.

## Dominant request classes

1. **Sidebar Link prefetch RSC** — parallel `?_rsc=` fetches for `/contracts`, `/library`, `/library/documents`, `/settings/referrals`, `/calendar`, `/communication/series`, etc. (Next.js `<Link>` default prefetch). Competes with the route document.
2. **`GET /api/navigation/attention`** — up to ~3.1s; loads venue contracts (+ signers) for badge counts on every pathname change.
3. **`GET /api/notifications`** — ~1–2.5s shell companion.
4. **Route document SSR** — `/leads` and `/dashboard` documents themselves ~2.4–7s when contended.

**Not observed on navigation:** OpenAI / `luv-ask` POSTs (0 across samples).

## Ranked root causes → first slice

See founder chat deliverable §B. Preferred first slice: **scope/disable idle sidebar prefetch** + **cache/slim attention** without changing badge semantics.
