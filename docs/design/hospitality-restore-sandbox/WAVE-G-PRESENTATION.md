# Wave G presentation ports (main-safe)

**Branch:** `fix/hospitality-wave-g-complete`  
**Base:** `origin/main` @ `c9115c9f` (includes reporting #21, recovery #22–#24, dashboard #25)  
**Visual source:** `f22b8c14` presentation tokens only  
**Production:** untouched  

## Strategy

Do **not** blind-import f22 trees that pull missing modules (attention, relationship-photos, multi-venue, billing org cards, event-setup, etc.).

Apply approved hospitality **presentation** onto current main behavior:

- `htc-hospitality-page` / `htc-hospitality-heading` / `htc-hospitality-intro-accent`
- warm borders (`--htc-border-warm`), canvas chips, botanical accents
- `htc-hospitality-toolbar` / `htc-hospitality-table` / `htc-hospitality-section-label`
- `htc-surface-working` / `htc-surface-guidance` / `htc-working-card`
- `htc-record-link` / `htc-badge-attention`

## Files restored or adapted this wave

### Pages (heading chrome)

- `app/(app)/communication/series/page.tsx`
- `app/(app)/contracts/page.tsx`
- `app/(app)/guide/page.tsx`
- `app/(app)/help/page.tsx`
- `app/(app)/invoices/page.tsx`
- `app/(app)/leads/pipeline/page.tsx`
- `app/(app)/messaging/health/page.tsx`
- `app/(app)/packages/page.tsx`
- `app/(app)/requests/page.tsx`
- `app/(app)/settings/communications/page.tsx`
- `app/(app)/settings/import/page.tsx`
- `app/(app)/settings/integrations/page.tsx`
- `app/(app)/settings/page.tsx`
- `app/(app)/setup-hub/lead-capture/page.tsx`
- `app/(app)/tasks/page.tsx`

### Components (list / workspace chrome)

- `components/brochures/brochure-detail.tsx`
- `components/contracts/contract-list.tsx`
- `components/document-workspace/document-workspace.tsx`
- `components/event-inventory/inventory-template-detail.tsx`
- `components/events/timeline/timeline-summary-bar.tsx`
- `components/offerings/offerings-library-section.tsx`
- `components/payments/payment-schedule-list.tsx`
- `components/questionnaire-templates/questionnaire-authoring-workspace.tsx`
- `components/requests/request-manager.tsx`
- `components/vendor-app/vendor-event-workspace.tsx`
- `components/vendors/vendor-list.tsx`

### Regression

- `lib/theme/wave-g-presentation-parity.test.ts`

## Explicitly deferred (dependency-blocked)

Still need dedicated feature ports before full f22 visual parity:

- Nav attention badge stack (`lib/navigation/attention` + inbox ownership)
- Multi-venue shell (`active-context` / venue-switcher)
- Relationship photos editors
- Floor-plan / playbook / timeline template editor headers (+ details sheets)
- Library documents manager (+ documents actions)
- Billing org / referral cards; offerings choice-groups; public-forms catalog
- Calendar share-availability clients
- Tier-upgrade `shared/pricing/*` routes (helpers already on main)

## Preserved newer functionality

Reporting #21, dashboard ready-invite #25, Welcome Back × White Glove, hard-nav `/reporting`, booking/contract/timeline rules, Willow Grove demo data — untouched by these class-only ports.
