# Findings remediation — Wave A+ (email CTA, ceremony clarity, add-ons, Next Steps, floor setups)

**Mode:** Migration APPLIED; redeploy in flight after venue-app typecheck fix + template streamline elevation.  
**Branch:** `feat/spaces-booking-e1-smart-fields`  
**Commit:** `72ea7a0c71d5a97cb9b3e4389831689078345eef`  
**Migration run:** https://github.com/jlcormier612/wevenu-website/actions/runs/41530570343 — **success** (…273…progress_state + …274…budget_category_remove_custom)  
**Prior deploy (failed typecheck):** https://github.com/jlcormier612/wevenu-website/actions/runs/41530574175 — venue-app `AddSectionResult.message` narrowing (fixed in this commit)  
**Redeploy:** pending dispatch after push of `72ea7a0c…`  
**No Production deploy from this work.** Unrelated dirty tree preserved.

## Decisions locked (product)

1. Optional add-ons: always-available root groups (all categories), not nested under a parent by default.
2. Ceremony count: both exactly-N required and up-to-N optional (existing engine + clearer UI).
3. Next Steps: submitted / waiting on venue is enough to leave Home; do **not** mark vendor tasks complete on submit.
4. Floor plans: one preference per setup (ceremony / cocktail / reception), not multi-select of competing full layouts.

## Shipped in this pass

### Email CTA
- `/order/{token}` Event Order share emails render **Review your Event Order** button via `linkifyPlainTextForEmailHtml` (same pattern as proposal / questionnaire).
- Plain-text body still carries the raw URL.
- Tests: `lib/email/conversation-brand.test.ts`

### Ceremony / choice-count clarity
- Unified control: “Couples must choose [1|2|3]” + Required, with live rule hint (e.g. 2 of Arch, Runner, Petals).
- Files: `selection-rule-controls.tsx`, `package-choices-panel.tsx`; regression updates in builder / choice-logic tests.

### Optional add-ons (template modeling — no silent DB rewrite)
- `newOptionalAddOnsGroupInput` + **Add optional add-ons group** button on Couple chooses.
- Copy clarifies staff Add-ons lines vs couple-facing optional add-ons groups.
- Existing events/templates unchanged until venue remodels + re-freezes packet.

### Next Steps demotion
- Migration `20261427300000_portal_tasks_progress_state.sql` exposes `progressState` on `get_portal_tasks`.
- Home filters `awaitingVenueReview` (progress_state=in_progress for vendor_selected / questionnaire / seating / timeline triggers).
- Task remains incomplete until venue confirms — vendor lifecycle preserved.
- Tests: `lib/portal/next-steps.test.ts`

### Floor setups (copy + guidance)
- Couple wedding-setups copy clarifies one preference per part of day.
- Single-offer chooser copy points venues at wedding setups for multi-space.
- Staff organizer copy warns against competing full-celebration options.
- Runtime already prefers setups when `hasSetups` (no multi-check on single chooser).

### EO Mark as Paid deep-link
- When EO-linked invoice is `sent` / `partially_paid`, strip shows **Mark as Paid** linking to existing invoice or payment schedule (no second ledger).

### Per-person choice qty → guest count (no sent-invoice rewrite)
- `resolveSelectedOptions` scales per-person options (pricingModel or “Per person” description) to Guaranteed ?? Estimated headcount; stamps `boundToHeadcount` + unit `guest` on EO lines.
- `applyChoicesToEventOrder` loads bound headcount from the event; never creates/updates invoice rows.
- Freeze stamps `pricingModel: per_person` on choice packets for future applies.
- Sent/paid invoices remain frozen (existing freeze-on-send + headcount B4). Draft EO invoices continue to project live EO lines only.
- Explicit `allowQuantity` couple answers win and stay unbound.

### Portal documents viewer / print
- Couple Documents **Open** opens `CoupleDocumentViewerDialog` (iframe when previewable + Print + Download + New tab).
- Reuses token-auth `/api/portal/documents/{id}/file?token=…` where the list route already rewrites public file URLs.
- Review & sign stays an external `/sign/{token}` link. Event Order / Inventory / Questionnaire still navigate in-portal.
- Venue `DocumentViewerDialog` unchanged.

### Timeline couple-add
- Template apply / replace ensures a **Your additions** section with `clientCanAdd`.
- Venue toolbar: **Allow couple additions** when none exists.
- Portal: Add your item above the fold; calm empty state when venue has not enabled add.

### Floor default packaging
- Opt-in **Start with Ceremony + Reception** (no silent backfill of events that already have setups).
- Copy recommends multi-part wedding packaging; single-layout can skip.

### Budget delete → unallocated + custom
- Migration `20261427400000_budget_category_remove_custom.sql` — `is_removed`, remove RPC, custom_name on upsert.
- Soft-remove zeros budgeted (returns to Unallocated); Add custom category from unallocated.

### Edit / Preview / Use chrome + template streamline (thin)
- Sticky `TemplateWorkflowChrome` on edit + preview (Edit → Preview → Use / Send).
- Sticky incomplete-groups checklist at top of guided wizard with in-page anchors.

### Template streamline elevation (collapse → path-preview → split Use/Send → unify rule → couple summary)
- Guided sections **collapse by default** with a 1-line health chip; incomplete sections (and checklist hash anchors) expand. Specialist rules labeled **Advanced**.
- Couple choice follow-ups navigate via **Try this path** (one parent branch open at a time).
- Use/Send is **two steps**: included + staff add-ons, then choice groups (`Continue to choices`).
- Unified `SelectionRuleControls`: **Couples must choose [1|2|3]** + Required, live rule label (`Choose exactly N`).
- Couple Event Order document shows **What’s included / What you choose** summary before Approve.

## Intentionally not done yet

- Catalog-first defaults / write-in demotion (elevation item 5 — deferred)
- Full builder spine reorder / second builder
- Browser exercise / STATUS GREEN until Sandbox serves `72ea7a0c…`

## Migration note

`20261427300000_portal_tasks_progress_state.sql` must be applied to Sandbox before Next Steps demotion is live there. Local/code path is ready; Sandbox DB apply is a separate authorize step.

## Regression

```
npx tsx --test lib/email/conversation-brand.test.ts \
  lib/event-order-templates/choice-logic-regression.test.ts \
  lib/event-order-templates/builder-ux.test.ts \
  lib/event-order-templates/guided-setup.test.ts \
  lib/event-order-templates/offering-package-builder.test.ts \
  lib/portal/next-steps.test.ts \
  lib/client-choices/apply-to-event-order.test.ts \
  lib/event-order-templates/selection-definition.test.ts \
  lib/event-order-templates/starter-commercial-semantics.test.ts \
  lib/events/headcount-b4.test.ts \
  lib/portal/couple-document-viewer.test.ts \
  lib/flow-review/quick-copy-fixes.test.ts \
  lib/portal/findings-wave-remainder.test.ts \
  lib/floor-plans/phase3-required-setups.test.ts \
  lib/event-orders/couple-approve-summary.test.ts
```

All prior Wave A tests + remainder suite (timeline / floor / budget / chrome) + streamline elevation.
