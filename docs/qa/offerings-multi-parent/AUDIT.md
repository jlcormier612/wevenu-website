# Offerings ↔ major choices — Phase 1 forensic audit

**Date:** 2026-10-28  
**Scope:** Can one catalog offering (e.g. Cheesecake) belong under multiple major choices (Plated Dinner + Buffet Dinner) without duplication?  
**Status:** Audit complete — safe M:N path identified. Implementation follows this document.

---

## 1. Current data model

### Schema

| Artifact | Role |
|---|---|
| `offerings` | Canonical catalog row (name, category, default price, inventory link, archive). |
| `offerings.parent_offering_id` | **Nullable FK → offerings(id) ON DELETE SET NULL.** Single parent only. Added in `20261425200000_offerings_parent_hierarchy.sql`. |
| `validate_offering_parent` trigger | Same venue; optional same category; **one nesting level** (parent must itself have `parent_offering_id IS NULL`); no self-ref. |
| RLS | `offerings` / `offering_categories`: `venue_id = current_user_venue_id()`. |

There is **no** junction table today. The single-parent limit is **enforced in the data model**, not only in the UI (single `<select>` in `offerings-library-section.tsx`).

### App mapping

- `Offering.parentOfferingId: string | null`
- Hierarchy helpers (`lib/offerings/hierarchy.ts`) treat null = top-level (major/standalone), non-null = item under exactly one major.
- Create/update write one FK via `repository.offeringRow`.

### Existing Sandbox data

Any child currently stores exactly one `parent_offering_id`. Migration must preserve those rows as association links without changing offering IDs.

---

## 2. Event Order Templates

| Concern | Behavior |
|---|---|
| Template options | Store `offering_id` (nullable FK to catalog) **per option row**, plus label, price, included flag, `depends_on_option_ids`. |
| Nested / follow-up choices | Driven by **option dependency graph** (`depends_on_option_ids`), **not** by catalog `parent_offering_id`. |
| Authoring filter `underMajor` | Uses catalog parent to **prefer** children of the major linked on the parent option; fallback to same-category top-level if none. |
| Same offering in multiple contexts | **Already allowed.** The same catalog `offering_id` can appear on multiple template options / sections. Identity is the option row + offering FK, not a unique constraint on offering_id. |

**Conclusion:** EO templates already reuse one catalog offering across contexts. Catalog multi-parent does not require changing template storage. Catalog hierarchy is an **authoring convenience filter**, not the runtime selection graph.

---

## 3. Client selection → Event Order lifecycle

1. **Catalog association** — organizational only (which items “belong under” a major in Library).
2. **Template config** — venue picks offerings onto options; sets inclusion, unit price, quantity rules on the **option / group**, not on the catalog parent link.
3. **Apply / share** — snapshots definition onto the event’s client-choices definition.
4. **Couple selection** — answers select **option IDs** within active groups (`depends_on` gates follow-ups). Selecting Plated Dinner activates plated-dependent groups only; Buffet-only options stay inactive.
5. **Finalization / Add to Event Order** — `resolveSelectedOptions` emits lines from **selected options** (offeringId, description, qty, unitPrice, isIncluded). Duplicate catalog IDs only appear if **two selected options** both reference that offering.

**Pricing / inclusion / quantity live on template options (and applied choice lines), not on catalog parent associations.** Sharing Cheesecake under two majors does not invent a second price and does not auto-insert EO lines when editing the catalog.

**If couple selects only Plated Dinner:** only plated-dependent options apply → Buffet-only items are not selected. Cheesecake appears only if an option under the plated path references it and is selected.

**If both majors somehow selected and both paths include Cheesecake options:** established rule is one EO line **per selected option**, not per catalog association. Do not invent dedupe-by-offering-id unless product later requires it; current apply path does not collapse by offering_id.

---

## 4. UI / terminology

- Library: “Belongs under major choice (optional)” — **single select** today.
- “+ Item under this” on a major pre-fills that parent.
- EO template: “Select where this belongs…” = **choice-group dependency**, separate from catalog parent.
- Established terms: major choice, item under major choice, standalone offering.

---

## 5. Root cause of the product gap

Venues need M:N catalog associations. The model stores **at most one** `parent_offering_id`, so Cheesecake cannot legally belong under both Plated and Buffet without duplicating the offering row (which would break canonical identity and confuse EO references).

---

## 6. Chosen implementation path (safe, minimal)

### Relationship model

Add normalized junction:

```text
offering_major_links (
  id,
  venue_id,
  offering_id → offerings ON DELETE CASCADE,   -- child / item
  parent_offering_id → offerings ON DELETE CASCADE,  -- major
  unique (offering_id, parent_offering_id)
)
```

- RLS: venue-scoped like `offerings`.
- Validation trigger: same venue; no self-link; parent is top-level (not itself a child in links or legacy FK); optional same-category; child must not already be used as a parent of others (one nesting level).
- **Backfill** from `offerings.parent_offering_id`.
- Keep `parent_offering_id` as a **denormalized primary** (lexicographically first parent id by parent name, or null) so existing readers/triggers remain coherent during and after cutover. App source of truth for associations: **links**.
- Removing one link must not delete the offering; cascade only deletes **link** rows when an offering is deleted.

### App changes

- `parentOfferingIds: string[]` on Offering / OfferingInput / OfferingWithCategory.
- Hierarchy helpers accept `parentOfferingIds` (fallback to single `parentOfferingId` for tests/legacy).
- Edit form: multi-select of top-level majors; clear all = standalone/major.
- List: one row per offering; subtitle `Under A, B` when multiple.
- EO authoring `underMajor`: include offerings whose `parentOfferingIds` contains that major.
- **No** change to client-choices apply, invoices, or finalized EO lines.

### Explicit non-goals

- Do not store parent IDs in JSON/CSV on the offering row.
- Do not auto-create EO lines from catalog edits.
- Do not invent context-specific prices on the junction (prices stay on template options).
- Production untouched.

---

## 7. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Dual source of truth (FK vs links) | Writes always replace links then sync `parent_offering_id` to first parent or null. |
| Cross-venue links | Trigger + RLS on `venue_id`. |
| Cascade deleting offering when unlinking | Links use CASCADE on offering delete; unlink is DELETE of link only. |
| List looking like duplicate catalog rows | Single list row; multi-parent shown in subtitle. |
| EO double-charge | Unchanged: lines follow selected **options**, not catalog links. |

---

## 8. Phase gate

Audit establishes: M:N is required at catalog layer; EO runtime already supports shared `offering_id`; pricing context stays on templates. Proceed to Phase 2–5 per this path.
