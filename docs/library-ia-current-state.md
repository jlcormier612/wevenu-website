# Library Information Architecture — Current State

**Date:** 2026-08-12  
**Type:** Inventory only. No recommendations in this document.  
**Sources:** Live working tree (`app/(app)/library/page.tsx`, Library routes, related list pages, `lib/navigation.ts`), plus recent left-nav / Pipeline / interaction-model docs for context — not as a substitute for code inspection.

**Sidebar context (already shipped):** Global nav exposes a single **Library** item under section LIBRARY. Former Resources/Templates sidebar shortcuts are retired. Your Venue → Venue Guide and Sales → Leads remain operational destinations outside Library.

---

## 1. Library home

| Field | Current value |
|---|---|
| Route | `/library` |
| Title | Library |
| Description | “Your venue's toolbox — everything reusable, in one place. Templates you build once and use for every wedding.” |
| Layout | Grouped sections; each group is a 2-column card grid (`ToolboxCard`) |
| Search / filters on home | None |
| Pipeline Templates card | **Absent** (removed in left-nav implementation; deep link remains) |
| Help & Guides entry on home | None |

On load, Library also ensures FAQ / Brochure / Saved Report starters for the current venue (provision side effects), then loads counts for active (non-archived) assets where the page filters archived client-side.

---

## 2. Current category map

For each category → asset types → route → what for → genuinely reusable? → belongs in Library?

### Agreements

| Asset | Card label | Route | What for (from UI copy / role) | Genuinely reusable? | Belongs in Library? |
|---|---|---|---|---|---|
| Contract templates | Contract Templates | `/library/contracts` | Reusable contract wording with fill-in details, ready to send as live contracts | Yes — define once, Use Template → live contract | Yes |
| Questionnaire templates | Questionnaires & Feedback | `/library/questionnaire-templates` (+ `/[id]`, `/[id]/preview`) | Client Planning Questionnaire, Final Details, Post-Event Feedback starters; full-page authoring | Yes — Use creates draft questionnaire on an event (Create ≠ Send) | Yes |

### Pricing & Packages

| Asset | Card label | Route | What for | Genuinely reusable? | Belongs in Library? |
|---|---|---|---|---|---|
| Packages | Packages | **`/packages`** (canonical); `/library/packages` **redirects** to `/packages` | Venue offerings: inclusions + price; used on invoices / Event Orders | Yes | Yes |
| Inventory catalog | Inventory | `/library/inventory` (+ `/new`, `/[id]/edit`) | Items/amenities the venue provides; used to build event inventory | Yes (catalog) | Yes |
| Inventory templates | Inventory Templates | `/library/inventory-templates` (+ `/[id]`) | Typical wedding inventory sets (Ceremony + Reception, Reception Only starters); apply → working inventory | Yes | Yes |
| Payment plan starters | Payment Schedules | `/library/payment-schedules` | Code-level starter payment plans (not DB templates); Use opens invoice-tied schedule flow | Yes as presets; not venue-editable DB assets | Yes (definition/preset side) |

### Planning

| Asset | Card label | Route | What for | Genuinely reusable? | Belongs in Library? |
|---|---|---|---|---|---|
| Playbook / planning templates | Planning Templates | `/library/playbooks` (+ `/[id]`) | Task checklists applied to events / feed Task Center | Yes | Yes |
| Timeline templates | Timeline Templates | `/library/timeline-templates` (+ `/[id]`) | Reusable day-of schedules applied per booking | Yes | Yes |
| Floor plan templates | Floor Plan Templates | `/library/floor-plan-templates` (+ `/[id]`) | Reusable room layouts applied per booking | Yes | Yes |
| Event order templates | Event Order Templates | `/library/event-order-templates` (+ `/[id]`) | Starting points for Event Orders created on events | Yes | Yes |

### Communication

| Asset | Card label | Route | What for | Genuinely reusable? | Belongs in Library? |
|---|---|---|---|---|---|
| Message templates | Message Templates | `/communication/templates` (+ `/new`, `/[id]`) | Reusable emails/texts; not Automations / Series | Yes | Yes |
| Venue Guide (+ FAQs) | Venue Guide | `/guide` | Parking, policies, FAQs for clients in portal; Luv can answer from it | Venue-owned content, continuously maintained — not copy-once apply-to-booking | **Operational home is Your Venue → Venue Guide**; Library card is a **duplicate entry** to the same route |

### Marketing

| Asset | Card label | Route | What for | Genuinely reusable? | Belongs in Library? |
|---|---|---|---|---|---|
| QR campaigns | QR Campaigns | `/library/qr-campaigns` | Trackable QR codes (print/signage); scans can become leads; has analytics | Campaign definitions with live tracking | Filed as Library today |
| Brochures | Brochures | `/library/brochures` (+ `/[id]`) | Brandable venue overviews to share with prospects | Yes | Yes |

### Reports

| Asset | Card label | Route | What for | Genuinely reusable? | Belongs in Library? |
|---|---|---|---|---|---|
| Saved reports | Saved Reports | `/reporting/saved` | Bookmarks / scheduled delivery of reports | Saved views (bookmark semantics), not apply-to-event templates | Filed as Library today; Overview → Reports is the live reporting home |

---

## 3. Present in codebase but not promoted on Library home

| Asset | Route | How discovered today | Notes |
|---|---|---|---|
| Pipeline Templates | `/library/pipeline-templates` (+ `/new`, `/[id]/edit`) | Sales → Leads → “Pipeline Templates”; `/leads/pipeline` header links | Not a Library home card. Page copy still says “Not connected to Leads yet” (stale relative to current Pipeline architecture). Live-referenced venue configuration, not copy-once Library shape. |

---

## 4. Interaction / list behavior (as shipped — not redesigned here)

Governing doc: `docs/library-interaction-model-standardization.md`.

| Pattern | Current state |
|---|---|
| Card grammar | Shared `LibraryAssetCard` / overflow on most family lists |
| Primary actions | Preview / Edit / Use where domain supports |
| Archive | Primary lists show **active**; collapsible **Archived** (`LibraryArchivedSection`); archived View = Preview + Restore, not Use |
| Starters | **Starter** badge; Add again / Restore starters menus vary by family |
| Empty states | Per-list dashed empty panels with create / starter CTAs (examples: “No packages yet”, “No questionnaires yet”, “No templates yet”) |
| Help links from Library lists | No in-list links to `/help` observed in Library family list components |
| Global Library search | None |

---

## 5. Terminology still visible in Library surfaces

| Term | Where |
|---|---|
| “toolbox” | Library home description |
| “Templates” | Many card titles and page titles (Contract Templates, Planning Templates, etc.) — domain names, not a sidebar “Resources/Templates” section |
| “Resources/Templates” | **Not** in current venue sidebar (`lib/navigation.ts`) |
| “Packages & Inventory” | Canonical `/packages` page title (card on Library still labeled “Packages”) |
| “Questionnaires & Feedback” | Library card + questionnaire library page |
| “Not connected to Leads yet” | Pipeline Templates deep-link page only |

---

## 6. Venue Guide dual placement (fact)

| Path | Destination | Same feature? |
|---|---|---|
| Your Venue → Venue Guide | `/guide` | Yes |
| Library → Communication → Venue Guide card | `/guide` | **Same route, same editor** (`VenueGuideEditor`); Library card count = FAQ count |

---

## 7. Packages dual route (fact after left-nav pass)

| Path | Behavior |
|---|---|
| `/packages` | Canonical full Packages UI |
| `/library/packages` | `redirect("/packages")` only — no second implementation |
| Library card | Links to `/packages` |

---

## 8. Category count summary (Library home cards today)

| Group | Card count |
|---|---|
| Agreements | 2 |
| Pricing & Packages | 4 |
| Planning | 4 |
| Communication | 2 (Message Templates + Venue Guide) |
| Marketing | 2 |
| Reports | 1 |
| **Total promoted cards** | **15** |
| Not promoted | Pipeline Templates (route only) |

---

## 9. Out of Library (confirmed by global nav / product placement)

Not Library home cards; listed only to bound the inventory:

- Help & Guides (`/help`) — Overview  
- Automations / Series — Communication  
- Live Contracts / Invoices / Payments — Financials  
- Leads pipeline board — Sales  
- Clients / Vendors / Task Center / Requests — operational  
- Settings — Your Venue  

---

*End of current-state inventory. Recommendations live in `docs/library-ia-final-recommendation.md`.*
