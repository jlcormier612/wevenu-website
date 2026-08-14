# Hello to Cheers — Starter FAQ Library Implementation

**Status:** Finished product on the existing Venue Guide FAQ engine (not a second FAQ system).  
**Keys:** `FAQ-01` … `FAQ-12`  
**Product name (customer-facing):** Hello to Cheers  
**Stop condition:** FAQs only — Starter Library content families are **COMPLETE**. No further starter families started in this pass.

---

## 1. Purpose

Give every Hello to Cheers venue twelve useful starting Venue Guide FAQs they can open under Library → Venue Guide, review/customize, and publish when ready — without inventing operational source-of-truth for packages, guest count, payments, vendors, floor plans, or dates.

---

## 2. Where FAQs appear

| Surface | Role | Starter visibility |
|---|---|---|
| **Library → Venue Guide** (`/guide`) | Venue review / edit / publish | All FAQs, including unpublished starters (Starter badge) |
| **Library landing** (`/library`) | Count + link into Venue Guide | Ensures starters; count includes unpublished |
| **Couple portal Venue Guide** | Client browse + Luv Ask | **Published only** (`projectGuideForAudience` → `isFaqPublished`) |
| **Vendor handbook** | Vendor browse | **Published only** |
| **Guest concierge** | Guest Q&A context | **Published only** |
| **Brochure (venue session + public token)** | Prospect leave-behind / PDF | **Published only** (TS filter + SQL `filter_published_venue_faqs`) |
| **Couple wedding website FAQ section** | Couple-authored site content | **Not** Venue Guide FAQs (separate SoT) |
| **Vendor profile FAQs** (`vendor_faqs`) | Vendor business FAQs | **Not** this library |

---

## 3. Approved content (exactly provisioned)

Content is the **product-approved FAQ-01…12** set from the finished-product brief (not rewritten). Order is FAQ-01 → FAQ-12.

| Key | Question |
|---|---|
| FAQ-01 | What is included with our venue rental? |
| FAQ-02 | Can we tour the venue before booking? |
| FAQ-03 | How far in advance should we book our wedding? |
| FAQ-04 | Can we have both our ceremony and reception at the venue? |
| FAQ-05 | What happens if we want to change our guest count? |
| FAQ-06 | Can we choose our own vendors? |
| FAQ-07 | When should we finalize our event details? |
| FAQ-08 | Can we customize the layout for our event? |
| FAQ-09 | When will we receive our final event details? |
| FAQ-10 | What time can we arrive to set up? |
| FAQ-11 | What should we bring with us on the wedding day? |
| FAQ-12 | What happens after our wedding? |

Full answers live in `lib/venue-guide/starters.ts` and are covered by exact-match unit tests.

**Content safety:** Starters intentionally avoid cancellation/refunds, insurance, alcohol, catering restrictions, exact payment deadlines, exact capacity/setup times, noise/curfews, ADA/legal compliance, required vendors/staffing, service charges/taxes/minimum spends, and legal/contractual policy language.

---

## 4. Source-of-truth boundaries

FAQs are **explanatory content**, not operational SoT.

| Topic FAQ mentions | Authoritative system |
|---|---|
| What’s included | Packages catalog / agreement |
| Guest count changes | Event / final details / portal tasks |
| Vendors | Vendor directory / assignments / policies section |
| Layout / seating | Floor Plan |
| Timeline / event-day details | Timeline / Event Order / Final Details |
| Setup / access times | Booking / Event Order / coordinator confirmation |
| Payments | Invoices / Payment Plans (not FAQ copy) |

Editing an FAQ never writes packages, guest counts, invoices, floor plans, or timelines.

---

## 5. Publishing default decision (and why)

**Decision: Hello to Cheers starter FAQs seed with `published: false`.**

They are available in the Venue Guide editor for review/customize, with a **Starter** badge and a publish switch. They do **not** appear on:

- public brochure token / PDF
- couple portal Venue Guide / Luv
- vendor handbook
- guest concierge

until the venue turns **Visible to clients, vendors, and brochures** on and saves.

**Why:** Unlike Package / Timeline templates (library catalogs that are not themselves a public website), Venue Guide FAQs are live explanatory content pulled by brochures and portal. Existing architecture had **no** draft gate on FAQ cards. Auto-inserting starters as live would present unreviewed example answers as the venue’s public truth. There was no certified “starter vs published” distinction before this work — so the finished product adds one instead of auto-publishing.

**Legacy / venue-authored FAQs:** Missing `published` is treated as **live** (`isFaqPublished` → true) so existing guide content does not disappear.

**Venue-authored new FAQs** (Add FAQ) default to `published: true` — intentional writing by the venue.

Editing a starter does **not** auto-publish; the venue must publish explicitly.

---

## 6. Masters + provisioning

| Piece | Path |
|---|---|
| Protected masters | `lib/venue-guide/starters.ts` |
| Provision / seed / ensure / restore | `lib/venue-guide/provision.ts` |
| Publish filter helpers | `lib/venue-guide/audience.ts` (`isFaqPublished`, used by `resolveFaqsForAudience`) |
| Migration | `supabase/migrations/20261276000000_faq_starter_library.sql` |

### Idempotency

- Skip when `source_master_key` already present (`skip_key`)
- Skip when exact question already present (`skip_question`) — never overwrite customs
- Re-provision creates **0** rows when all 12 keys exist
- Restore (“Restore starters”) re-adds only missing keys, still unpublished

### Venue seed + ensure

- New venue setup: `seedFaqStarters` in `lib/venue/service.ts`
- `/guide` and `/library`: `ensureFaqStartersForCurrentVenue`

### JSON entry shape

```json
{
  "question": "…",
  "answer": "…",
  "source_master_key": "FAQ-01",
  "published": false,
  "audience": "both"
}
```

Masters are **not** editable DB rows. Venue copies are independent jsonb objects inside `venue_operational_info.faqs`.

---

## 7. Permissions & cross-venue isolation

| Concern | Finding |
|---|---|
| RLS | `venue_rw_operational_info` — any **active** `venue_users` member for the venue (Owner / Manager / Coordinator / Staff) may read/write the guide row |
| Delete gate | No per-FAQ table; removing a card is an update of the venue’s jsonb array |
| Service role | Migration grants `select, insert, update` for venue-create seed (same family pattern) |
| Cross-venue | Row keyed by `venue_id`; portal/brochure RPCs resolve venue from token, not from caller input |

Isolation was validated locally by provisioning one venue while confirming a second venue’s FAQ keys stayed empty / distinct.

---

## 8. UI

- Starter badge on entries with `source_master_key`
- “Not published” badge when unpublished
- Publish switch with customer language (not engineering terms)
- Restore starters menu for missing FAQ-01…12
- Section copy updated so venues know starters must be reviewed before going live

Customer language: **Hello to Cheers starter** / **Starter** — not “master seed fixture.”

---

## 9. Terminology mismatches (documented, not silently rewritten)

| Source | Mismatch |
|---|---|
| `STARTER-LIBRARY.md` §5.C | Older FAQ-01…12 set (capacity, payment expectations, parking, rain plan, décor/open flame, accessibility, food & beverage, last-minute changes). **This finished product uses the approved brief set above**, not §5.C. |
| UI wording vs FAQ copy | Guide UI still talks about parking lots, sparklers, alcohol in **section placeholders / tips**; starter FAQ **answers** deliberately stay softer/general. Copy was **not** rewritten to match placeholders. |
| FAQ-01 says “package” | Matches the Packages catalog customer term — good. Exact inclusions remain package SoT. |
| FAQ-08 says “floor plan” | Matches Floor Plan product language — layout truth remains Floor Plan SoT. |
| §5.C “Also seed lightly” Parking / Rain Plan / Policies placeholders | **Not** implemented in this FAQ pass (user stop: FAQs only). |

---

## 10. Validation

### Unit tests

```bash
npx tsx --test lib/venue-guide/starters.test.ts lib/venue-guide/audience.test.ts
```

Covers: exact Q/A + order, unsafe-topic bans, publish defaults, skip rules, audience projection hiding unpublished starters.

### Local DB (`supabase_db_wevenu-website`)

| Check | Result |
|---|---|
| Migration applied + recorded in `schema_migrations` | **Yes** (`20261276000000` / `faq_starter_library`) |
| `filter_published_venue_faqs` + brochure RPC wires the filter | **Yes** (`brochure_uses_filter = t`) |
| Synthetic fresh unpublished starters → published filter returns **0** starters (legacy-only kept) | **Yes** |
| Publish one starter (FAQ-02) in synthetic payload → filter returns only that starter + legacy | **Yes** (`published_starter_keys = ["FAQ-02"]`) |
| Cross-venue snapshot (read-only): venues remain separate rows | **Yes** (Daisy / Pretty Platypus each own their guide row) |
| Live write provision into shared venue rows | **Not executed in this pass** — avoided mutating customer/dev venue FAQ content from the agent; ensure/seed paths match other starter families and will create on `/guide` or `/library` visit / new venue setup |

Unit tests cover exact Q/A, order, skip/idempotency rules, and outbound unpublished hiding.

---

## 11. Visual review (editor)

Venue Guide FAQs section shows starters with Starter / Not published badges and publish switch. Library Venue Guide card points at `/guide` with updated description. No FAQ redesign beyond starter badge / publish / restore.

---

## 12. Gaps (honest)

| Gap | Notes |
|---|---|
| STARTER-LIBRARY.md §5.C out of date vs shipped FAQ-01…12 | Documented; do not “fix” by rewriting approved starters to §5.C |
| Parking / Rain Plan / Policies example section prose from §5.C | Not seeded (FAQ-only stop) |
| Vendor dual-list FAQs (`section_overrides.faqs.vendors`) | Unchanged; starters go into main client FAQ list only |
| Wedding website FAQ section | Still couple-owned; not auto-filled from Venue Guide (correct separation) |
| Per-role delete restriction Owner/Manager | Guide uses blanket venue_users write (pre-existing); not tightened in this pass |
| Interactive browser pass for brochure URL | Validated via SQL `filter_published_venue_faqs` + service filters; full browser click-path not claimed |

---

## 13. Files

| Path | Role |
|---|---|
| `lib/venue-guide/starters.ts` | Protected masters FAQ-01…12 |
| `lib/venue-guide/provision.ts` | Idempotent provision / seed / ensure / restore |
| `lib/venue-guide/starters.test.ts` | Exact content + skip + publish tests |
| `lib/venue-guide/audience.ts` | `source_master_key` / `published` + outbound filter |
| `lib/venue-guide/audience.test.ts` | Existing audience suite (still green) |
| `supabase/migrations/20261276000000_faq_starter_library.sql` | Comments, `filter_published_venue_faqs`, brochure RPC, service_role grant |
| `lib/venue/service.ts` | Seed on venue create |
| `lib/brochures/service.ts` | Defense-in-depth published filter |
| `app/(app)/guide/page.tsx` | Ensure + missing keys |
| `app/(app)/guide/faq-starter-actions.ts` | Restore action |
| `app/(app)/library/page.tsx` | Ensure + description |
| `components/guide/venue-guide-editor.tsx` | Badge / publish / restore |
| `docs/hello-to-cheers-starter-faq-implementation.md` | This report |

---

## 14. Confirmation

**STOPPED.** Starter Library content families are **COMPLETE**. No further starter families were started after FAQs.
