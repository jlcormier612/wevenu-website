# Library Information Architecture — Final Recommendation

**Date:** 2026-08-12  
**Type:** Product IA recommendation + scoped implementation notes.  
**Companion inventory:** [`docs/library-ia-current-state.md`](./library-ia-current-state.md)  
**Governing constraints:** Library interaction model standardization; left-nav final recommendation; Pipeline architecture recommendation; do **not** rebuild asset domains.

---

## 1. Core product rule

**Library = reusable venue-defined assets** (define once, apply many).

Keep Library distinct from:

| Place | Role |
|---|---|
| Global nav | Live / aggregate operational destinations |
| Client / Event workspace | What’s true about one booking |
| Help & Guides | Product education (Hello to Cheers–owned) |
| Your Venue (Settings / Venue Guide) | Venue configuration and venue-owned client reference |

Not a dumping ground. Prefer fewer purpose-based groups. Do **not** create a “Templates / Business / Documents / Tools / Assets / Setup / Resources” catch-all.

---

## 2. Recommended internal structure (simplest for a brand-new venue owner)

Keep today’s purpose groups. They already speak venue language and match how owners think about “what I reuse.”

```
LIBRARY (/library)

  Agreements
    Contract Templates          → /library/contracts
    Questionnaires & Feedback   → /library/questionnaire-templates

  Pricing & Packages
    Packages                    → /packages
    Inventory                   → /library/inventory
    Inventory Templates         → /library/inventory-templates
    Payment Schedules           → /library/payment-schedules

  Planning
    Planning Templates          → /library/playbooks
    Timeline Templates          → /library/timeline-templates
    Floor Plan Templates        → /library/floor-plan-templates
    Event Order Templates       → /library/event-order-templates

  Communication
    Message Templates           → /communication/templates

  Marketing
    QR Campaigns                → /library/qr-campaigns
    Brochures                   → /library/brochures

  Reports
    Saved Reports               → /reporting/saved
```

**Explicitly not on Library home:**

| Item | Placement |
|---|---|
| Pipeline Templates | Not promoted. Deep link `/library/pipeline-templates` may remain. Discover from Sales → Leads / Pipeline board. |
| Venue Guide | Operational only: Your Venue → Venue Guide (`/guide`). No Library card. |

**Why not invent new groups:** Current six groups already cluster by purpose (agreements, pricing, day-of planning, messages, marketing, saved reports). Renaming or inventing Business/Templates/Documents would recreate the old Resources junk drawer under a new label.

---

## 3. Plain-language mental model (for owners)

- **Library** = “How we do things” — menus, wording, checklists, layouts you reuse.  
- **Workspace** = “This wedding.”  
- **Financials / Inbox / Automations** = live ledgers and running tools.  
- **Your Venue → Venue Guide** = what *clients* read about *this* venue (not a template you stamp onto events).  
- **Help & Guides** = how to use Hello to Cheers.

---

## 4. Asset-by-asset recommendation

| Asset | Stay in Library? | Notes |
|---|---|---|
| Contract Templates | Yes | Agreements |
| Questionnaires | Yes | Agreements; keep full-page authoring; no Planning Forms/Tasks/Workflow rename |
| Packages | Yes | Card → `/packages` only |
| Inventory + Inventory Templates | Yes | Pricing & Packages today |
| Payment Schedules | Yes | Presets; Use ≠ send |
| Planning / Timeline / Floor Plan / Event Order templates | Yes | Planning |
| Message Templates | Yes | Only Communication card; not global sidebar; not Sequence/Workflow wording |
| Venue Guide | **No (as Library card)** | Same feature as Your Venue → Venue Guide |
| QR Campaigns / Brochures | Yes | Marketing |
| Saved Reports | Yes (keep for now) | See unresolved #3 |
| Pipeline Templates | **Not Library primary IA** | Leads config entry |

---

## 5. Explicitly decided (safe to implement)

| Decision | Status |
|---|---|
| Pipelines not a Library primary card | Already done (left-nav pass) |
| Deep link `/library/pipeline-templates` may remain | Keep |
| Leads remains Pipeline config entry | Keep |
| Venue Guide operational = Your Venue → Venue Guide | Keep |
| Remove duplicate Library Venue Guide card (same `/guide`) | **Implement in this pass** |
| Do not delete Venue Guide feature/route; do not move operational Venue Guide | Keep |
| Packages Library card → `/packages`; no second `/library/packages` UI | Already done (redirect) |
| Message Templates: one primary Library home under communication grouping | Already present; keep after Venue Guide removal |
| Questionnaires: not Planning Forms/Tasks/Workflows; don’t modify editor | Keep |
| No global Library search / new filters / AI / Starter Library destination / Luv | Not in scope |
| Prefer fewer categories; don’t invent Business/Templates/Documents/… | Followed |

---

## 6. STOP — decisions needing future product decision

**Do not implement these until the user decides.**

### Decision A — Communication group after Venue Guide removal

After removing the Venue Guide card, **Communication has a single card** (Message Templates).

Options:

1. **Keep** group label “Communication” with one card (lowest change; recommended default until decided).  
2. Fold Message Templates into another **existing** group (e.g. Marketing) — this is a cross-domain move.  
3. Rename the group (e.g. “Messages”) — major category rename.

**Needs user decision before changing grouping beyond Venue Guide removal.**

### Decision B — Major category renames

Should any of **Agreements / Pricing & Packages / Planning / Communication / Marketing / Reports** be renamed for clearer first-morning language?

**Needs user decision.** This pass does not rename categories.

### Decision C — Saved Reports primary home

Saved Reports is a Library card **and** lives under reporting (`/reporting/saved`), while Overview → Reports is the operational reporting home.

Options:

1. Keep dual discovery (Library bookmark + Reports).  
2. Library-only card removed; discover only from Reports.  
3. Something else.

**Needs user decision before removing or relocating the Library card.**

### Decision D — Inventory catalog group placement

Inventory (catalog) sits under **Pricing & Packages** beside Packages. It is “what we provide,” not always “pricing.”

Options: leave; move under Planning; other.

**Needs user decision before moving.**

### Decision E — Card / page label inconsistencies

Examples:

- Library card “Packages” vs page title “Packages & Inventory”  
- “Questionnaires & Feedback” vs shorter “Questionnaires”

**Needs user decision before renames** (avoid rename-for-rename’s-sake).

### Decision F — QR Campaigns Library fit

QR Campaigns have live analytics and lead capture — closer to a small operational tool than a pure copy-once template. Left-nav already filed them in Library.

**Needs user decision only if product wants to promote QR outside Library** (would also touch global nav — out of this pass).

### Decision G — Library home description copy

“toolbox” / “Templates you build once…” is slightly product-y. Aligning to “reusable assets you define once” is polish, not blocking.

**Needs user decision if changing homepage microcopy is desired this pass.**

### Decision H — Pipeline Templates deep-link stale copy

`/library/pipeline-templates` still says not connected to Leads. Pipeline architecture doc recommends fixing that copy — **belongs to Pipeline work, not Library IA regrouping.** Do not treat as Library IA rename/move.

---

## 7. Empty states & starters (review only — no interaction-model redesign)

| Observation | Assessment |
|---|---|
| Empty states | Generally short, action-oriented (“No X yet” + create/starter CTA). Acceptable; no redesign required for IA. |
| Help links | Library lists rarely deep-link Help & Guides. Optional future: link area guides when P0 Help content exists — **not Help P0 in this pass.** |
| Starters | Badge + Add again / Restore patterns feel helpful when present; vary by family (intentional per interaction model). |
| Archive pollution | Primary lists already partition archived into collapsible section — archive should **not** pollute primary view if families use `partitionArchived`. QR still uses a lighter archived pattern. |
| Library home counts | Mostly active-only; Packages uses `getPackages(true)` (activeOnly). |

**No starter-provisioning or archive-engine changes in this pass.**

---

## 8. Implementation plan for this pass

### Implement now

1. Remove Library home **Venue Guide** card (duplicate of `/guide`).  
2. Drop unused Venue Guide fetch/count/icon wiring on `/library` only.  
3. Leave FAQ starter provisioning on `/guide` (operational page). Remove Library-page FAQ ensure only if it exists solely to support the removed card’s count path — prefer leaving brochure/report ensures intact; FAQ ensure on Library can be removed as dead for this page.  
4. Keep Communication group with Message Templates only (Decision A default until user chooses otherwise).  
5. Confirm Packages → `/packages`, Pipeline card absent, interaction model untouched.

### Do not implement

- Category renames or new categories  
- Moving Inventory / Saved Reports / Message Templates between groups  
- Pipeline copy fix / Pipeline starters / Pipeline schema  
- Help content, Luv, Automation P1, global sidebar edits  
- Search/filters, Starter Library destination  
- Domain architecture / permissions / archive engine changes  

---

## 9. New Venue Morning (Library-scoped)

| Task | Expected path after this pass |
|---|---|
| Create a package | Library → Pricing & Packages → Packages → `/packages` |
| Find contract template | Library → Agreements → Contract Templates |
| Create questionnaire | Library → Agreements → Questionnaires |
| Create message template | Library → Communication → Message Templates |
| Find floor plan template | Library → Planning → Floor Plan Templates |
| Find Venue Guide | Your Venue → Venue Guide (not Library) |
| Customize sales pipeline | Sales → Leads → Pipeline Templates / Board (not Library home) |

---

## 10. Validation checklist

- [ ] Library home groups/cards match recommended structure (no Venue Guide; no Pipeline card)  
- [ ] Each remaining category/card loads  
- [ ] Packages → `/packages`; `/library/packages` still redirects  
- [ ] Leads → Pipeline Templates still works  
- [ ] Your Venue → Venue Guide still works; Library no longer duplicates it  
- [ ] Starters / archived / Preview-Edit-Use still present on spot-checks  
- [ ] Mobile Library home readable  
- [ ] `npx tsc --noEmit`  
- [ ] `npm test`  
- [ ] Document pre-existing failures  

---

## 11. Migration impact

| Change | Severity | Risk |
|---|---|---|
| Remove Library Venue Guide card | P2 | Low — same feature remains under Your Venue |
| No route deletion | — | `/guide` unchanged |
| No Packages / Pipeline architecture change | — | Already aligned |

---

## 12. Verdict

**Recommended IA:** keep purpose-based groups; demote Pipeline; remove Venue Guide duplicate from Library; Packages via `/packages`; Message Templates under Communication.

**This pass implements only the Venue Guide Library-card removal (plus related dead wiring), after verifying `/guide` is the same feature.**

**Blocked on user decisions A–H before further regrouping, renames, or Saved Reports / Inventory moves.**

---

## 13. What was implemented vs stopped

| Item | Result |
|---|---|
| Current-state doc | Created — `docs/library-ia-current-state.md` |
| Recommendation doc | Created — this file |
| Remove Venue Guide Library card | **Done** — `app/(app)/library/page.tsx` |
| Pipeline not promoted | Confirmed already absent on Library home |
| Packages → `/packages` | Confirmed; `/library/packages` redirects |
| FAQ ensure on Library page | Removed (operational `/guide` still provisions FAQ starters) |
| Category renames / moves / new categories | **STOPPED** awaiting Decisions A–H |
| Interaction model / domains / starters / archive | Untouched |
| Validation | Browser 34/34 pass; `tsc --noEmit` clean; `npm test` 484/484; evidence in `docs/qa/library-ia-browser-evidence/` |
| Pre-existing failures | None observed in this validation set. Pipeline Templates deep-link copy still stale (“Not connected to Leads yet”) — known, deferred to Pipeline work (Decision H). |

**STOP.** No New Venue Morning product pass, Help P0, Luv, or Automation P1 from this task.
