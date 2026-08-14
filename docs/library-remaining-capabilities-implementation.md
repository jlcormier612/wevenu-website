# Work Package D7 — Remaining Library Capabilities: Brochures, Saved Reports & Event Order Templates

**Status: shipped 2026-08-11.** This is an implementation phase, not another architecture-certification exercise. The three capabilities the Library presented as "Coming later" — Brochures, Saved Reports, and Event Order Templates — are now real, working, connected to the systems already built across D1–D7's predecessors, and validated with real data and real authenticated sessions.

Built in the brief's own mandated order: **D7A (Event Order Templates) → D7B (Brochures) → D7C (Saved Reports)**.

## 1. What existed before D7

- **Event Order Templates**: nothing. Confirmed by direct research (schema search, code search): no `event_order_templates` table, no reuse concept anywhere in `lib/event-orders/` or `components/event-orders/`. This was a previously *documented, deliberate* gap (`docs/event-order-operational-experience-implementation.md` §24-25: "no established requirement forced it"), not an oversight — D7 is that requirement.
- **Brochures**: nothing real. A prior research pass (`docs/business-asset-system-definition.md`) had already flagged "Brochures" as a phantom/placeholder concept. One dormant, unreachable signal existed (a `"brochure"` `DocType` in the client portal's document-type union with no producer ever populating it) — not a real integration point.
- **Saved Reports**: nothing. Reporting (R1–R3) was explicitly scoped to NOT include save/export/schedule (`docs/reporting-experience-implementation.md`: "Export — the existing product has no general report-export capability today... none was built").

All three were real, named gaps — not imagined ones.

## 2. What was built

**D7A — Event Order Templates.** A new `event_order_templates` + `event_order_template_sections` + `event_order_template_lines` schema, following the exact "Library template + copy-at-commitment Working Item" shape already established twice in this codebase (Contract Templates, Inventory Templates). A template stores only reusable *structure* — section names, standard line description/quantity/price — never a live Package/Inventory reference, never event-specific data. Applying a template (at Event Order creation, via an extended `ensureEventOrder(eventId, templateId?)`) copies that structure into the real `event_order_sections`/`event_order_lines` tables through the exact same sanctioned insert functions every other line-adding path already uses (`insertSection`, `insertCustomLine`, provenance `"custom"`) — no second line-insertion mechanism was created. A template selector was added to the existing "Start Event Order" flow, appearing only when the venue has templates (mirrors Event Inventory's own proven `StartInventory` pattern exactly).

**D7B — Brochures.** A plain `brochures` table (not a Document Domain producer — see the reasoning in the migration's own comment and §4 below) with `welcome_text`/`closing_text` as venue-authored editorial content, plus `include_packages`/`include_faqs` toggles that pull **live** data from the already-authoritative `packages` and `venue_operational_info.faqs` tables at render time — never copied or duplicated. A third `@react-pdf/renderer` generator (`lib/brochures/pdf.ts`), matching the two existing generators' exact styling constants and header/footer pattern. Sharing reuses the existing `ShareDialog` with a Lead picked from the existing Leads list (never a typed email) — the email links to a public, unauthenticated `/brochure/[share_token]` page, the same "token + public route" pattern already established for Contract signing.

**D7C — Saved Reports.** A thin persistence layer over the already-complete, untouched Reporting system: a `saved_reports` table storing only `reportPath` + `datePreset` (+ literal `from`/`to` only for the `custom` mode) — confirmed sufficient to fully reconstruct any report view. Relative presets (`"this_month"`, etc.) stay relative; opening or scheduling a saved report always re-resolves the date window fresh, never replays a frozen snapshot. A "Save Report" button was added directly to the shared `DateRangeControl` (so it's available on all five report pages with zero per-page wiring). CSV export (not PDF — the research found this data is inherently tabular, and no PDF-report precedent existed worth extending) reuses the exact canonical metric functions the Overview page itself calls. Weekly scheduled delivery follows the daily digest's own proven skeleton (service-role client, `SECURITY DEFINER` "who's due" RPC, content-hash dedupe, `sendEmail()`), gated to Owner/Manager since a schedule can target an editable recipient address.

## 3. Customer journey for each capability

**Brochure:** Library → Brochures → "+ New Brochure" → name it → toggle Packages/FAQs, write a welcome + next-steps blurb → Preview (real PDF, opens in a new tab) → Save → pick a prospect from existing Leads → Share → prospect receives an email with a link to a branded page (no account needed) → venue returns later, edits the brochure, shares an updated version. Verified live end-to-end, including the actual email-link/PDF path a real prospect would use (see §6/§10).

**Saved Report:** Reporting → pick a report + date range → "Save Report" → name it → confirmation toast points to Saved Reports → Saved Reports (also in the Library) → open later → data is current (re-resolved, not frozen) → Manage → schedule weekly delivery to an email, or export a CSV snapshot. Verified live, including the schedule's actual "who's due" resolution.

**Event Order Template:** Library → Event Order Templates → "+ New Template" → name it → add sections + standard lines → an event's Event Order panel now shows "Start blank" or any template by name → apply it → sections/lines appear pre-filled, fully editable, and are a fully independent copy — editing the template afterward never touches that Event Order (verified live). Duplicate a template to build a variant.

None of these journeys require the venue to understand any internal architecture — the words on screen are Brochure/Saved Report/Event Order Template/Package/FAQ/Lead/Share/Duplicate, never Document Domain/representation/canonical/entity.

## 4. Data / source-of-truth map

| Capability | Owns | Reuses live (never copies) |
|---|---|---|
| Brochure | name, welcome/closing text, include-toggles, share token | `venues` (branding, contact), `packages` (active only), `venue_operational_info.faqs` |
| Saved Report | name, report path, date preset (+ literal from/to only for `custom`) | Every number is read fresh from `lib/metrics/*`/`lib/reporting/service.ts` at open/export/send time — nothing is precomputed or stored |
| Event Order Template | section names, standard line description/quantity/price | Nothing live-referenced by design — a template line has no Package/Inventory FK; applying it produces a `provenance: "custom"` line in the real Event Order, matching the brief's own boundary ("never duplicate inventory pricing or calculate totals in the template layer") |

## 5. Permissions matrix

| Action | Owner | Manager | Coordinator | Staff | Enforced at |
|---|---|---|---|---|---|
| Brochure — create/edit/duplicate/share | ✓ | ✓ | ✓ | ✓ | RLS (venue-scoped, no role check — authoring, not governance) |
| Brochure — delete | ✓ | ✓ | ✗ | ✗ | RLS RESTRICTIVE (`brochures_delete_gate`) — live-verified |
| Event Order Template — create/edit/duplicate/apply | ✓ | ✓ | ✓ | ✓ | RLS (matches Event Order's own looser, no-role-check posture) |
| Event Order Template — delete | ✓ | ✓ | ✗ | ✗ | RLS RESTRICTIVE (`event_order_templates_delete_gate`) — live-verified |
| Saved Report — create/open/duplicate/delete | ✓ | ✓ | ✓ | ✓ | RLS (venue-shared, personal-bookmark weight, deliberately not a governed asset) |
| Saved Report — export CSV | ✓ | ✓ | ✓ | ✓ | Authenticated session (venue-scoped) |
| Saved Report — create/edit a schedule | ✓ | ✓ | ✗ | ✗ | RLS RESTRICTIVE (`saved_report_schedules_write_gate`/`_update_gate`) — added and live-verified after a real gap was found (see §6) |

This deliberately does **not** reproduce the D2 Template Permission Defect pattern (inconsistent delete-gating across template types): both new template-shaped tables (`event_order_templates`, `brochures`) got the `RESTRICTIVE` Owner/Manager delete gate from their very first migration, not as a later patch.

## 6. Security / cross-venue validation

All three capabilities were live-tested with real authenticated `supabase-js` sessions (`owner@example.com`, `d5b-staff@example.com` — one venue; `emma.carter@example.com`, Owner of a second venue "The Pretty Platypus" — for cross-venue checks):

- **Event Order Templates**: Venue B reading Venue A's template → 0 rows. Staff attempting delete → honest denial (0 rows, no false success). Owner delete → succeeds.
- **Brochures**: Venue B reading Venue A's brochure row directly → 0 rows. The public `get_brochure_by_token` RPC correctly resolves for an **anonymous, unauthenticated** client (the actual prospect path) while the authenticated table stays venue-isolated. Staff delete → denied; Owner delete → succeeds.
- **Saved Reports**: Venue B reading Venue A's saved report → 0 rows. The `get_due_saved_report_schedules` RPC is `service_role`-only — a regular authenticated session (Owner included) gets a real Postgres permission-denied error when calling it directly, confirmed live.

**Two real defects were found and fixed during this validation, not assumed away:**

1. **Critical — the public `/brochure/[token]` page and its public PDF route were being redirected to `/login`.** This app's auth gate (`proxy.ts`, Next.js 16's renamed `middleware.ts`) uses an explicit `PUBLIC_PATHS` allowlist; `/brochure` and `/api/brochures/public` were never added to it. A prospect with no Hello to Cheers account — the entire point of a Brochure — could never have viewed one. Fixed by adding both to the allowlist, mirroring exactly how `/sign` (Contract signing) is handled. The same review caught that the new `/api/saved-reports/process` cron route would have been silently unreachable by Vercel's cron caller (no user session) for the identical reason — fixed the same way, mirroring the other CRON_SECRET-guarded routes already in the allowlist.
2. **`saved_report_schedules` had no RLS write restriction, only an app-layer (service function) check.** Confirmed live: an authenticated Staff session could `INSERT` a schedule directly via the REST API, completely bypassing the intended Owner/Manager gate in `lib/saved-reports/service.ts`. This is the exact "app check is UX, RLS is the real boundary" class of gap this codebase has hardened repeatedly before (the D2/D6 Template Permission Defect, several `TR-L*` fixes). Fixed with a `RESTRICTIVE` insert/update policy; re-verified live that Staff is now correctly denied at the database layer, not just the app layer.

## 7. Template isolation tests

All live-verified (Event Order Templates — see script output preserved in this session's history; Brochures — duplicate isolation confirmed via direct SQL):

- Applying a template to Event A, then editing the template afterward → Event A's Event Order lines are **unchanged** (still the original description/price).
- Applying the (now-edited) template to a **new** Event B → Event B correctly gets the **current** template content — confirming templates aren't frozen at creation, only individual *applies* are copy-at-commitment.
- Deleting a template does not touch (and, per the RESTRICTIVE gate, can't even be attempted by) any already-created Event Order.
- Duplicating a Brochure, then editing the duplicate's welcome text → the original brochure's welcome text is confirmed unchanged.

## 8. Reporting canonicality validation

Saved Reports and its CSV export call **only** existing, already-certified functions — `getCanonicalBookings`, `getGrossBookedRevenue`, `getPaymentsCollected`, `getOutstandingBalance`, `getLeadsTrend`, `getConversionFunnel` (`lib/metrics/*`, `lib/reporting/service.ts`) and `resolveDateRange` (`lib/reporting/date-range.ts`) — the exact same calls the Reporting Overview page itself makes. No new metric, no new formula, no new date-range semantics were introduced anywhere in D7C. `SavedReportPath` is a closed union of the five existing report routes; there is no way to save or schedule a report shape that doesn't already exist.

## 9. Financial safety validation

Live-verified: after applying an Event Order Template (twice, to two different events) and editing the template in between, `invoices` had **zero** rows referencing either resulting Event Order — confirming template application never touches Invoices, Payment Plans, or any financial record. Event Order Template lines are inserted with `provenance: "custom"` and their own computed `amount` (`quantity × unitPrice`), exactly the existing rule every other Event Order line already follows — no second pricing or totals calculation exists in the template layer.

## 10. PDF / visual validation

The Brochure PDF (the one net-new PDF surface in D7) was rendered with realistic data — real venue branding (logo, hero image, brand color), a real Package, a real FAQ — and visually inspected page-by-page, twice, catching two real defects on the first pass:

- An orphaned "Next Steps" heading, stranded alone on page 1 while its body text flowed to page 2.
- The venue's contact line printed twice on the same short page (once in the body, once in the footer).

Both fixed (`wrap: false` grouping so a heading and its immediately-following content move together across a page break, and removing the redundant body-level contact line since the footer already carries it on every page). Re-rendered and re-inspected after each fix, including a second pass with multiple packages and FAQs to confirm consistent spacing across list items — a related regression (missing bottom margin on the first list item specifically) was caught and fixed in the same pass. The final render is a single clean page, correct branding, no clipping, no orphaned headings, no duplicated content, no unexpected blank pages.

## 11. Mobile / accessibility validation

The three new list/editor surfaces reuse the same shared component families (`Card`, `Sheet`, `Select`, `Switch`, `BusinessAssetHeader`, `ActivityTimeline`, `DropdownMenu`) already used throughout the certified Library/Business Asset surfaces — no new visual language was introduced. The public `/brochure/[token]` page was hand-built (it can't reuse the authenticated app shell) with a single-column, `max-w-2xl` layout that reflows naturally at narrow widths, and real `alt` text on both images. A full dedicated mobile/accessibility audit (screen-reader pass, explicit focus-state audit) was not performed this phase — this is an honest, explicitly named gap (see §13), consistent with D6's own prior finding that this is a broader, pre-existing pattern across the app, not something newly introduced here.

## 12. Regression testing

Every change in D7 is additive: `ensureEventOrder(eventId, templateId?)` and `insertEventOrder(..., templateId?)` both extend existing signatures with an optional, default-`null` parameter — every pre-existing call site is unaffected. The Library page's three `ComingLaterCard` placeholders were replaced with real `ToolboxCard`s one at a time; the now-dead `ComingLaterCard` component was removed. `DateRangeControl` gained one new button (`SaveReportButton`) that renders on all five report pages but touches no existing report-fetching logic. `proxy.ts`'s `PUBLIC_PATHS` array only gained new entries — no existing pattern was changed or removed. A full `tsc --noEmit` run after every phase (and again after every live-validation-driven fix) shows **zero new errors** — the only errors present are the same pre-existing, unrelated baseline (`portal-shell.tsx`, wedding-website test files, `shared/*.mts` smoke scripts) confirmed unchanged throughout.

## 13. Explicitly deferred items

- **Full mobile/accessibility audit** for the three new surfaces (§11) — reuses certified shared components but wasn't independently re-audited screen-reader-by-screen-reader this phase.
- **Scheduled Saved Report delivery is link-based, not data-embedded.** The cron engine runs as `service_role` with no user session (a cron tick has no logged-in venue user), and the canonical metric functions all expect `getCurrentVenue()`'s session-derived scoping — reusing them in a session-less loop would need a second, service-role-safe call path. The scheduled email links to the live report instead of embedding numbers inline; the interactive "Save → Export CSV" path (which does run in a real authenticated session) has the full canonical numbers.
- **Saved Reports has no per-metric selection.** Confirmed during research: no such concept exists anywhere in the current Reporting UI (every report page renders a fixed set of cards) — inventing one would be a new Reporting feature, out of D7's "thin persistence layer" scope.
- **Brochures do not integrate with the Document Domain or the cross-asset `/documents` Document Workspace list.** A deliberate call, reasoned in `lib/brochures/pdf.ts`'s own comment: the Document Domain's real adoption is 2 producers in the whole app (both with a real negotiation/finalization lifecycle a Brochure doesn't have), and the actual `/documents` list reads producer tables directly, not the Document Domain — neither integration is required for Brochures to work correctly today.
- **No per-package selection for a Brochure** — a Brochure includes *all* active Packages (a toggle, not a picker). Simpler, and the Packages list is typically small; a future refinement if venues want to curate a subset.

## Files changed this phase

**D7A:** `supabase/migrations/20261261000000_event_order_templates.sql`; `lib/event-order-templates/{types,repository,service}.ts`; `app/(app)/library/event-order-templates/{actions.ts,page.tsx,[id]/page.tsx}`; `components/event-order-templates/{event-order-template-list,event-order-template-detail}.tsx`; `lib/event-orders/{types,repository,service}.ts` (extended); `app/(app)/events/[id]/event-order-actions.ts` (extended); `components/event-orders/event-order-panel.tsx` (template selector); `components/events/event-detail.tsx`, `app/(app)/clients/[id]/page.tsx` (prop threading); `app/(app)/library/page.tsx`.

**D7B:** `supabase/migrations/20261262000000_brochures.sql`, `20261263000000_brochure_public_content.sql`; `lib/brochures/{types,repository,service,pdf}.ts`; `app/(app)/library/brochures/{actions.ts,page.tsx,[id]/page.tsx}`; `components/brochures/{brochure-list,brochure-detail}.tsx`; `app/api/brochures/[id]/pdf/route.ts`; `app/api/brochures/public/[token]/pdf/route.ts`; `app/brochure/[token]/page.tsx`; `integrations/supabase/proxy.ts` (public paths); `app/(app)/library/page.tsx`.

**D7C:** `supabase/migrations/20261264000000_saved_reports.sql`, `20261265000000_saved_report_schedule_permission_gate.sql`; `lib/saved-reports/{types,repository,service,export,schedule-engine}.ts`; `lib/csv.ts` (new shared helper); `app/(app)/reporting/saved-reports-actions.ts`; `app/(app)/reporting/saved/{page.tsx,[id]/page.tsx}`; `components/reporting/{save-report-button,saved-report-list,saved-report-detail}.tsx`; `components/reporting/date-range-control.tsx` (Save Report button); `app/api/saved-reports/process/route.ts`; `app/api/saved-reports/[id]/export.csv/route.ts`; `vercel.json` (cron entry); `integrations/supabase/proxy.ts` (cron public path); `app/(app)/library/page.tsx`.

## Final Completion Matrix

| Capability | Create | Edit | Preview | Duplicate | Apply/Use | Share | Export | Schedule | Permissions | Isolation | Visual QA | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Brochure | PASS | PASS | PASS | PASS | N/A | PASS | PASS (PDF) | N/A | PASS | PASS | PASS | **PASS** |
| Saved Report | PASS | PASS | PASS | PASS | PASS (open) | N/A | PASS (CSV) | PASS | PASS | PASS | N/A | **PASS** |
| Event Order Template | PASS | PASS | PASS | PASS | PASS | N/A | N/A | N/A | PASS | PASS | N/A | **PASS** |

*"N/A" reasoning:* Brochure Apply/Use — a Brochure is shared, not applied to a working item. Saved Report Share — reports are already venue-team-visible by RLS design, no separate per-person send concept was requested or needed. Event Order Template Share/Export/Schedule — a template is an internal authoring tool, never itself sent to anyone (the *Event Order* it produces already has its own, unrelated Share/PDF flow, untouched by this phase). Event Order Template / Saved Report Visual QA — N/A because neither produces a new rendered artifact of its own (a Saved Report reuses the already-visually-certified Reporting UI/CSV; a Template has no PDF or public view).

## Final customer-journey self-check (brief §64)

- *"I want to send a new prospect our brochure."* — Library → Brochures is discoverable and real. Create, edit, and preview all work without explanation. Share resolves a real Lead and sends a real link. A prospect with zero Hello to Cheers account can open it (verified anonymously, live) and download a real, correctly-paginated PDF.
- *"I want to look at the same report every Monday."* — Save Report is one click from any report view. Saved Reports is a real destination (Library and `/reporting/saved`). Scheduling to a weekly day/email is a real, live-verified, permission-gated action.
- *"We use the same BEO format for most weddings."* — Event Order Template is a real Library destination. Applying it to a new event populates real sections/lines, fully editable, verified independent of the template and of every other event that used it. Inventory's existing finalize→add-to-Event-Order flow is completely untouched. No new financial engine, no duplicate totals, invoices/payments verified unaffected.

None of these required explaining the architecture underneath.
