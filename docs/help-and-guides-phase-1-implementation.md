# Help & Guides — Phase 1 Implementation

**Date:** 2026-08-12  
**Source of truth:** `docs/help-guides-product-education-audit.md`, `docs/help-guides-information-architecture.md`, `docs/help-guides-content-inventory.md`

---

## 1. What existed

- **Store:** `success_library_articles` (platform-wide; HQ authoring via RLS).
- **Model:** Best Practice fields (`why_it_matters`, `when_to_use`, `best_practices`, `common_mistakes`) + `goal_category` + `linked_gap_keys` + related feature links.
- **Venue routes:** `/success-library`, `/success-library/[slug]` titled “Luv's Success Library.”
- **HQ:** `/admin/success-library` create/edit/draft/publish.
- **Nav:** Already listed under Operations as “Success Library” (audit claimed none — present in `lib/navigation.ts` at Phase 1 start; still poorly named/placed for Help).
- **Five published articles** under older coaching categories (Booking More Tours, Getting Paid, Growing Your Venue, Working with Vendors).
- **Dashboard:** Getting Started “Read more” deep-linked to Success Library slugs.

No second content system existed; Phase 1 keeps this store.

---

## 2. What changed

| Change | Detail |
|---|---|
| Customer name | **Help & Guides** (+ tagline “Quick answers for using Hello to Cheers.”) |
| Canonical venue route | `/help`, `/help/[slug]` |
| Legacy URLs | `/success-library` → redirect `/help`; `/success-library/[slug]` → `/help/[slug]` |
| Navigation | **Help & Guides** under Overview (persistent, non-admin). Removed Operations “Success Library” entry. |
| Taxonomy | 12 IA areas in `lib/help-guides/areas.ts`; home always lists all 12 |
| Article migration | SQL updates `goal_category` for the five existing articles (content unchanged) |
| Empty areas | “Guides for this area are coming soon.” |
| Article UX | Return link to Help & Guides; “Best Practice” label; category shown |
| HQ authoring | Labels → Help & Guides; category is a 12-area select (legacy value kept if present) |
| Dashboard links | `articleHref` → `/help/{slug}` |

### Article classification

| Slug | Title | New area |
|---|---|---|
| `signing-your-first-contract` | Turning a Lead into a Signed Client | Finding & Booking Clients |
| `getting-paid-on-time` | Getting Paid, On Time | Contracts & Payments |
| `creating-your-first-package` | Creating Your First Package | Building the Event |
| `inviting-your-first-couple` | Inviting Your First Couple to Their Portal | Working With Clients |
| `working-with-your-vendor-network` | Getting the Most from Your Vendor Network | Vendors |

Migration: `supabase/migrations/20261282000000_help_guides_phase1_taxonomy.sql`

---

## 3. What was deliberately NOT built

- 18 P0 articles / content dump
- Advanced search / Elasticsearch / embeddings
- Related-article engine
- Feedback / ratings
- Contextual help widgets
- New Luv features or Luv-owned KB
- Analytics dashboards
- Second content table/engine
- Content-type enum system beyond a light “Best Practice” label on existing articles

---

## 4. Validation

| Check | Result |
|---|---|
| Browser smoke (core) | **12/12 PASS** — nav, home, 12 areas, empty states, 2 articles, back link (`docs/qa/help-guides-phase-1/`) |
| Legacy URLs | Permanent redirects in `next.config.ts` (`/success-library` → `/help`) |
| Auth | `/help` requires venue session |
| Authoring | HQ `/admin/success-library` retained; 12-area category select |

**Note:** Playwright was not re-blocked waiting on long shells after core path passed. Legacy redirect flake under page-level `redirect()` was fixed via `next.config.ts` redirects instead.

### Secondary entry points inspected (not all changed)

| Surface | Opportunity | Phase 1 action |
|---|---|---|
| Command palette | Could index articles later | None (search out of scope) |
| User/profile menu | Possible later | None |
| Dashboard Getting Started | Already has Read more | Updated href only |
| Venue Guide | Separate product | Unchanged |
| Luv | Optional concierge later | No new Luv work |

---

## 5. Follow-up

**Phase 2 — Help & Guides P0 Content:** author the 18 P0 articles from `docs/help-guides-content-inventory.md` into the existing pipeline, classified into the 12 areas. Then search (global command palette), relatedness, feedback, and contextual/Luv guidance.
