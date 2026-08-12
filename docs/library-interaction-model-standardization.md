# Library Interaction Model Standardization

**Date:** 2026-08-11  
**Product:** Hello to Cheers  
**Scope:** Shared Library presentation + interaction language (not domain architecture rebuild)  
**Verdict:** **PASS WITH NAMED DIFFERENCES**

---

## 1. Executive summary

Starter Library content is certified. Hands-on review showed the Library did not behave like one product: families used different open/edit/overflow patterns and save feedback was often invisible.

This pass establishes **one interaction language** around domain-specific capabilities:

- Shared card grammar (`LibraryAssetCard` + `LibraryOverflowMenu`)
- Consistent primary actions (**Preview | Edit | Use** where applicable)
- Overflow **•••** for Duplicate / Archive / Restore / Delete
- Unified labels (**Restore** not Unarchive; **Duplicate** not icon-only Copy; **Save changes**)
- Clearer persistence communication (explicit Save + Floor Plan autosave status)

Domain engines, tables, permissions, and certified lifecycles were not redesigned.

---

## 2. Problem statement

Venue owners were learning a different control language per family (copy icon vs kebab vs inline Archive; Preview only on some lists; silent canvas saves). That violates Hello to Cheers principles: reduce cognitive load, progressive disclosure, spoon-feed the owner.

---

## 3. UX principle

> **Different things. Same way of using them.**

> **One Library. One interaction language. Many domain-specific capabilities.**

---

## 4. Current-state audit matrix (pre-change)

| Family | Open | Preview | Edit | Save | Use | Copy/Duplicate | Archive | Delete | Starter | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| Messages | Edit button | Editor tab only | Edit page | Explicit Save changes | None on list | Kebab Duplicate | Restore/Archive | Yes | Badge + Add again menu | |
| Questionnaires | Click row → sheet | Missing | Sheet | Save | None | Copy icon | Inline Unarchive | No | Copy icon odd one | |
| Contracts | Buttons | Preview sheet | Edit page | Save changes | Use Template | Duplicate | Restore | Yes | Closest to standard | |
| Payment Plans | Page browse | Inline lines | N/A (code masters) | N/A | Global Create CTA | None | None | None | Intentional | |
| Event Orders | Click → detail | Missing | Detail | Per-action persist | Event workflow | Duplicate | Restore | Yes | | |
| Inventory catalog | Click → edit | Image only | Edit | Save Changes | None | None | Unarchive | No | No Starter badge in type | |
| Inventory templates | Click → detail | Missing | Detail | Per-action | Event workflow | None | Inline Unarchive | Detail | | |
| Timelines | Click → editor | Overflow Preview | Page | Item Save + reorder autosave | Event picker | Duplicate | Unarchive | No template delete | | |
| Floor Plans | Click → editor | Preview | Canvas | Silent autosave | Event picker | Duplicate | Unarchive | No template delete | Highest persist ambiguity | |
| Packages | Kebab only | Overflow Preview | Edit page | Save changes + inclusions immediate | Booking | Duplicate | Restore | Yes | Dual routes | |
| FAQs | Inline guide | N/A | Inline | Save FAQs (dirty) | Publish switches local until save | None | Remove row | Soft | | |
| Brochures | Click → detail | PDF in detail | Detail | Save | Share/Send | Duplicate | Restore | Yes | No Add-again UI | |
| Saved Reports | Title → report | N/A | Manage | Mixed | Open report | Copy icon | None | Trash | Bookmark semantics | |

---

## 5. Standard Library card grammar

**Name → short description → meaningful badges → primary actions → ••• overflow**

Shared components:

- `components/library/library-asset-card.tsx`
- `components/library/library-overflow-menu.tsx`
- `components/library/library-save-status.tsx`
- `components/library/labels.ts`

---

## 6. Preview standard

**Preview** = show me what this is before I change or use it.

Where meaningful: Contracts, Packages, Timelines, Floor Plans, Brochures (PDF).  
Messages keep Preview inside the editor tabs (list primary = Edit).  
Planning Forms remain edit-sheet first (field config is the asset).

---

## 7. Edit standard

**Edit** = change my reusable Library asset. Does not send, publish, sign, or create financial commitment.

---

## 8. Use standard

**Use** = apply this reusable asset in its intended workflow.

| Family | Label | Meaning |
|---|---|---|
| Contracts | Use Template | Creates working contract |
| Payment Plans | Use payment plan | Starts invoice-tied schedule flow |
| Questionnaires | Use Questionnaire → **Create Questionnaire** | Snapshots a **draft** on an event (never sends) |
| Saved Reports | Open report | Opens saved reporting view |
| Others | (workflow entry elsewhere) | Use remains on events/bookings where certified |

### Edit / Use / Send / Withdraw (client-release safety)

Follow-up pass documented in [`library-archive-and-client-release-safety.md`](./library-archive-and-client-release-safety.md):

- **Edit** = reusable Library change only  
- **Use / Create** = working draft only  
- **Send / Share / Publish** = explicit client-facing release with confirmation  
- **Withdraw / Cancel / Stop access** = stops further access where the domain supports it; does not recall email  
- Soft **Archive** never deletes working customer records  

---

## 9. Duplicate / copy / starter re-copy

| Concept | Meaning | Label |
|---|---|---|
| Duplicate | Another reusable venue-owned copy | **Duplicate** |
| Use | Enter workflow | **Use …** |
| Starter re-copy | Non-destructive add master again | **Add … again** / **Restore starters** (missing-only menus) |

Backend semantics unchanged.

---

## 10. Starter behavior

Badge **Starter** = Hello to Cheers starting point; venue edits their copy; original remains available via existing restore/re-copy. No engineering terms exposed.

---

## 11. Overflow menu standard

Secondary actions live under **•••** (`aria-label="More actions"`): Duplicate, Archive/Restore, Delete, Rename, Set as Default where applicable.

**Archive UX (2026-08-11 release-hardening):** Primary Library lists show **active only**. Archived assets move to a collapsible **Archived** section (`LibraryArchivedSection`) with Preview + Restore — **not Use**. See `docs/library-archive-and-client-release-safety.md`.

---

## 11a. Client release safety (Use ≠ Send)

| Verb | Venue meaning |
|---|---|
| Use / Create | Working draft only |
| Send / Share / Publish | Explicit client exposure |
| Stop client access | Status withdraw where RPC already gates (questionnaires → draft) — never claim email recall |

---

## 12. Destructive-action standard

Delete stays in overflow, confirmation retained, success only after mutation (Packages delete false-optimism fixed).

---

## 13–17. Save / autosave / unsaved / exit

| Model | Where |
|---|---|
| A Explicit **Save changes** + **Unsaved changes** status + leave confirm | Messages, Contracts, Packages (fields), Brochures, Inventory item form, Planning Forms sheets, Timeline item sheet, Saved Report schedule fields, FAQ sections (already had Unsaved changes) |
| B Autosave with status chrome | Floor Plan editor; Package inclusions; Event Order sections/lines; Inventory template items; Timeline **reorder** |

Shared helpers:
- `useLibraryUnsavedGuard` — `beforeunload` + native `confirm()` on Cancel/back
- `LibrarySaveStatus` — Unsaved / Saving… / Saved just now / error
- Toast after successful explicit save: **Changes saved.**

Leave confirmation language: *You have unsaved changes. Leave without saving?*

Intentional mixed models remain (Package fields vs inclusions; Timeline item Save vs reorder autosave).

---

## 18. Domain-by-domain mapping (after)

| Family | Card | Primary | Overflow | Persist UX |
|---|---|---|---|---|
| Messages | Shared grid | Edit | Dup/Archive/Delete | Explicit |
| Questionnaires | Shared row | Edit | Dup/Archive | Explicit Save changes |
| Contracts | Shared grid | Preview\|Edit\|Use Template | Dup/Archive/Delete | Explicit |
| Payment Plans | Starter cards | Use payment plan | N/A | N/A |
| Event Orders | Shared row | Edit | Dup/Archive/Delete | Per-action (named difference) |
| Inventory catalog | Shared grid | Edit | Archive/Restore | Explicit |
| Inventory templates | Shared row | Edit | Archive/Restore | Per-action |
| Timelines | Card + Preview\|Edit | Preview\|Edit | Dup/Rename/Default/Archive | Mixed |
| Floor Plans | Card + Preview\|Edit | Preview\|Edit | Dup/Rename/Default/Archive | Autosave status |
| Packages | Shared grid | Preview\|Edit | Dup/Archive/Delete | Explicit + inclusions immediate |
| FAQs | Guide sections | Save changes | N/A | Explicit dirty |
| Brochures | Shared row | Edit\|Preview | Dup/Archive/Delete | Explicit |
| Saved Reports | Shared row | Open report\|Manage | Dup/Delete | Mixed schedule |

---

## 19. Shared component architecture

Presentational only — domains supply handlers/capabilities. No universal backend template system.

---

## 20. Changes implemented

- New `components/library/*` presentation primitives
- Migrated list UIs toward shared card/overflow grammar
- Terminology: Unarchive → Restore; Copy icon → Duplicate; Save → Save changes (FAQ/Brochure/Inventory/Timeline item)
- Packages: honest delete after successful mutation; Preview\|Edit primary
- Floor Plan: autosave status chrome
- Payment Plans: per-card Use payment plan
- Questionnaire: Edit primary + overflow (no bare copy icon)
- **Persistence pass:** explicit Save forms show Unsaved changes + disable Save when clean; Cancel/back confirm; autosave/per-action surfaces show Saving… / Saved just now (EO, Inventory templates, Package inclusions, Timeline reorder)

---

## 21. Browser validation matrix

Evidence: `docs/qa/library-ux-smoke.json` + `docs/qa/library-ux-smoke-retry.json` (Owner login, targeted gotos, short timeouts; retries used `waitUntil: commit` when cold `domcontentloaded` stalled — not treated as product defect).

All 12 family routes returned healthy authenticated shells; no `Unarchive` label observed.

| Family | Consistent card | Preview | Edit | Save state clear | Use | Overflow | Duplicate clear | Delete/archive safe | Starter clear | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| Messages | Yes | Editor tab | Yes | Explicit | N/A list | Yes | Yes | Yes | Yes | PASS |
| Questionnaires | Yes | N/A sheet | Yes | Explicit | Event | Yes | Yes | Archive | Yes | PASS |
| Contracts | Yes | Yes | Yes | Explicit | Use Template | Yes | Yes | Yes | Yes | PASS |
| Payment Plans | Browse cards | Structure | N/A | N/A | Use payment plan | N/A | N/A | N/A | Yes | PASS (diff) |
| Event Orders | Yes | Detail | Yes | Per-action | Event | Yes | Yes | Yes | Yes | PASS WITH DIFF |
| Inventory | Yes | Image | Yes | Explicit | N/A | Yes | N/A | Archive | No badge in type | PASS WITH DIFF |
| Inventory Templates | Yes | Detail | Yes | Per-action | Event | Yes | N/A | Archive | Yes | PASS WITH DIFF |
| Timelines | Yes | Yes | Yes | Mixed | Event | Yes | Yes | Archive | Yes | PASS WITH DIFF |
| Floor Plans | Yes | Yes | Yes | Autosave UI | Event | Yes | Yes | Archive | Yes | PASS |
| Packages | Yes | Yes | Yes | Explicit | Booking | Yes | Yes | Yes | Yes | PASS |
| FAQs | Guide | N/A | Inline | Explicit | Publish separate | N/A | N/A | Remove | Yes | PASS WITH DIFF |
| Brochures | Yes | PDF | Yes | Explicit | Share | Yes | Yes | Yes | Yes | PASS |
| Saved Reports | Yes | N/A | Manage | Mixed | Open report | Yes | Yes | Delete | Yes | PASS WITH DIFF |

---

## 22. Starter → Custom → Use validation

Representative path exercised conceptually against prior certification + this UI pass:

- Contracts: Starter → Edit → Save changes → Use Template (workflow unchanged)
- Messages: Starter → Edit → Save changes
- Packages: Starter → Edit → Save changes (pricing remains venue-owned)
- Floor Plans: Starter → Edit → autosave status → reopen (domain apply remains event picker)

Protected masters still cannot be deleted via UI; re-copy remains non-overwrite.

---

## 23. Permission validation

No permission/RLS changes. UI continues to call existing server actions; failures surface via toast.

---

## 24. Public / private validation

Brochure Preview opens PDF (existing authenticated route). FAQ Save still required before publish visibility. No new public exposure paths.

---

## 25. Performance / typecheck

Library UX files: no new `tsc` errors. Broader repo has pre-existing unrelated errors. No new N+1 or server/client boundary imports of server-only modules in shared Library components.

---

## 26. Remaining intentional differences

1. **Payment Plans** are code presets, not DB editable Library templates.  
2. **Use** on contracts vs event apply for timelines/floor plans/EO — different certified entry points.  
3. **Per-action persist** for Event Order / Inventory template lines (not a single session Save).  
4. **Package inclusions** still persist on Add while package fields use Save changes.  
5. **FAQs** live inside Venue Guide chrome, not a Toolbox card identical to Contracts.  
6. **Inventory catalog** type has no `sourceMasterKey` exposure for Starter badge (provision still server-side).  
7. **Starter re-add menus** still vary (Add again always vs Restore starters when missing) — semantics preserved, not forced identical.

---

## 27. Real defects discovered and fixed

- Packages delete optimistic-UI success before backend confirmation → wait for mutation success.
- Floor Plan silent autosave → status communication added.
- Planning Forms icon-only Copy + inline Archive → Duplicate/Archive in overflow; Restore label.

---

## 28. Final UX assessment

> **Does the Hello to Cheers Library now behave like ONE product?**

### PASS WITH NAMED DIFFERENCES

A venue owner can move between families and recognize **Preview / Edit / Use / ••• / Save changes (or Saved just now)** without learning each team’s ad-hoc pattern. Remaining differences are domain lifecycle necessities, documented above.

---

## STOP

Starter Library remains certified. This work is Library interaction coherence only.

Do not begin: Luv, Automation, new Starter families, unrelated engineering cleanup, new reporting, or domain architecture rebuilds.
