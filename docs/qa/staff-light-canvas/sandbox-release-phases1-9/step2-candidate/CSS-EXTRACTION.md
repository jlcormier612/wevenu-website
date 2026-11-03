# Step 2 — Surgical CSS Extraction

**Do not copy** working-tree `app/globals.css` (2916 lines dirty) wholesale.  
**Baseline file:** 966 lines @ `cf84a4ee…`  
**Candidate file:** 1177 lines (+211 Phase 1–9 only)

## Inserted content

1. **Calm tokens** (staff theme block after warm neutrals):
   - `--htc-calm-blue`, `--htc-calm-blue-deep`, `--htc-border-calm`, `--htc-calm-accent`

2. **Phase 8** — `.htc-staff .htc-hospitality-intro` (+ sm padding media query) inserted after `.htc-hospitality-heading`, before existing `.htc-hospitality-toolbar`.

3. **Phases 1–7 + 9** — calm / setup / settings rules inserted after `.htc-hospitality-catalog`, before existing `.htc-catalog-section`:
   - `.htc-library-guidance-calm`
   - `.htc-inbox-no-selection`
   - `.htc-communication-health-guidance`
   - `section.htc-automations-help` (+ expanded / header / body hierarchy)
   - `.htc-setup-hub-welcome`, `.htc-contract-agreement-guidance`
   - `.htc-setup-stage-section-label`, `.htc-settings-directory-icon`
   - `.htc-task-center-plate-clear`
   - `.htc-availability-settings-guidance*`
   - `.htc-migration-guidance*`, `.htc-import-cutover-pointer`
   - `.htc-venue-guide-orientation`, `.htc-contract-template-disclaimer`

4. **Dark companions** — added `.htc-hospitality-intro` only to the existing hospitality dark remapping group (no Phase 10 filter/section-label/calendar/tours selectors).

## Explicitly excluded from extraction

| Selector / block | Reason |
|---|---|
| `.htc-hospitality-intro-accent` | Phase 10 |
| `.htc-hospitality-filter` | Phase 10 |
| `.htc-hospitality-section-label` | Phase 10 |
| Dark rules for accent/filter/section-label | Phase 10 |
| Calendar / tours hospitality expansions | Unrelated dirty work |
| Dirty-tree attention-row soft-rose rewrite on `.htc-hospitality-table` | Not required by Phase 8 manifest; baseline serving semantics preserved |

## Separation boundary (shared intro)

- **INCLUDED:** `.htc-staff .htc-hospitality-intro { … }`
- **EXCLUDED:** `.htc-staff .htc-hospitality-intro.htc-hospitality-intro-accent { … }`

## Verification greps (candidate)

```bash
# Present — pass
rg -n "htc-library-guidance-calm|…|--htc-calm-blue|htc-hospitality-intro|htc-setup-stage-section-label|htc-settings-directory-icon" app/globals.css

# Absent — pass (CLEAN_OF_EXCLUSIONS)
rg -n "htc-hospitality-intro-accent|htc-hospitality-filter|htc-hospitality-section-label|Phase 10|htc-calendar-view|htc-tours-workspace" app/globals.css
```

Serving already provides `.htc-hospitality-page` / toolbar / table / eucalyptus tokens — left unchanged.
