# Event Order Couple Portal Remediation

**Date:** 2026-08-14  
**Evidence labels:** VERIFIED LIVE · VERIFIED FROM DATABASE · VERIFIED FROM SOURCE · UNVERIFIED

## 1. Root cause confirmed

**VERIFIED FROM SOURCE.** `PortalSection` already included `"event-order"`, the portal shell already rendered `EventOrderPortalSection` when `activeSection === "event-order"`, and both the Event Order share email and unified-task presentation already targeted `#event-order`.

The canonical `PORTAL_SECTIONS` set in `lib/portal/workspace-routing.ts` omitted `"event-order"`. Consequently, `isPortalSection("event-order")` returned `false`, `parsePortalHash("#event-order")` returned a null section, and the shell retained its initial Home (`"overview"`) section.

## 2. Exact remediation

Added `"event-order"` to the existing canonical `PORTAL_SECTIONS` allowlist. No other routing behavior or portal navigation structure changed.

Preserved without modification:

- `PortalSection` and `EventOrderPortalSection`
- the portal RPC and its `shared_at is not null` gate
- Event Order finalization, immutability, reopen, and persistent `shared_at` behavior
- Contracts, Invoices, Payments, Playbooks/Tasks, `$0` protection, HQ enablement, and pricing

## 3. Discoverability decision and handling

**VERIFIED FROM SOURCE.** The complete existing path is:

1. `shareEventOrderWithClient()` finalizes the share representation and sets `shared_at`.
2. It sends the client an email whose URL is `/p/{portal-token}#event-order`, creating a normal couple portal session first when needed.
3. It invokes `triggerAutoComplete(..., "event_order_shared")` using the existing best-effort playbook mechanism.
4. `TRIGGER_WORKSPACE.event_order_shared` maps a configured open task to section `"event-order"` with action label `"Review event order"`.
5. Home/Tasks CTA navigation uses the canonical `navigateTo()` → `formatPortalHash()` mechanism, and the shell uses `parsePortalHash()` to activate the section.

The direct share-email deep link is the intended reliable discoverability path once an Event Order is shared. The optional configured-task mapping also remains intact. The allowlist correction makes both canonical paths resolve. No sidebar, dashboard, notification, navigation, or task framework was added.

## 4. Files changed

- `lib/portal/workspace-routing.ts` — added `"event-order"` to the canonical section allowlist.
- `lib/portal/workspace-routing.test.ts` — added canonical section/hash regression coverage.
- `lib/portal/unified-tasks.test.ts` — added `event_order_shared` destination/presentation coverage.
- `docs/event-order-couple-portal-remediation.md` — this report.

## 5. Tests

**VERIFIED LIVE (test runner).**

Focused command:

`npx tsx --test lib/portal/workspace-routing.test.ts lib/portal/unified-tasks.test.ts`

Result: **45 passed, 0 failed**.

Coverage proves:

- `isPortalSection("event-order")` is accepted.
- `formatPortalHash("event-order")` produces `event-order`.
- `parsePortalHash("#event-order")` resolves to `{ section: "event-order", focus: null }`, preventing silent Home fallback.
- existing floor-plan, payment, compound-hash, focus, and unknown-route behavior remains intact.
- `event_order_shared` remains navigate-only and targets the canonical Event Order section with `"Review event order"`.
- the portal shell's existing `activeSection === "event-order"` branch remains the canonical component render mechanism.

## 6. TypeScript

**VERIFIED LIVE (compiler).**

`npx tsc --noEmit`

Result: **passed with no errors**.

## 7. Full test suite

**VERIFIED LIVE (test runner).**

`npm test`

Result: **598 passed, 0 failed; 138 suites**.

## 8. Live browser

**VERIFIED LIVE.** Against the running local application and real local Couple Portal:

- Temporarily enabled Event Orders for Sweet Daisy Barn & Farm only.
- Created a temporary Event Order for the existing disposable Nicole & Colby test event.
- Added one priced line: `COUPLE PORTAL REMEDIATION LIVE — Catering Service`, quantity 1, amount **$500.00**.
- Finalized the temporary Event Order and moved it through the shared boundary in the database.
- Opened the real Couple Portal at `/p/{real-token}#event-order`.
- Confirmed the URL retained `#event-order`.
- Confirmed the shell rendered the **Your event order** section, the named line, and **$500.00**.
- Confirmed the portal did not silently render the Home welcome state.

The remediation verification run used controlled database state transitions for temporary create/finalize/share setup so it would not emit an email or leave a generated Document Domain/storage representation. The venue-side Share UI itself was **UNVERIFIED in this remediation run**; it is unchanged by this fix and was previously verified live in `docs/event-order-controlled-release-verification.md`.

## 9. Database and security verification

**VERIFIED FROM DATABASE and VERIFIED LIVE (real HTTP/RPC).**

Before sharing:

- A valid portal token for the Event Order's own client returned `{ "eventOrder": null }`.
- An invalid token returned `{ "eventOrder": null }`.
- A valid different-client token returned `{ "eventOrder": null }`.

After setting `shared_at`:

- Only the owning client's valid portal token returned the finalized Event Order.
- The response contained the correct temporary line and **$500.00** amount.

**VERIFIED FROM SOURCE.** `get_event_order_for_portal()` remains a `security definer` RPC scoped by active portal session client, venue, and `eo.shared_at is not null`. The API route still delegates access control to that RPC. No RLS, RPC, grant, route, or `shared_at` logic changed.

## 10. Cleanup confirmation

**VERIFIED FROM DATABASE.**

- Temporary Event Order removed: **0 remaining** for the test event.
- Temporary priced line removed: **0 remaining**.
- Sweet Daisy `event_order_enabled` restored to `false`.
- Enabled venues after cleanup: **0**.
- All seven other venues remained disabled throughout the run.
- No test email, generated PDF, Document Domain record, or storage object was created by this verification setup.

## 11. Final status

# READY FOR CLAUDE RE-VERIFICATION

The confirmed release blocker is fixed through the existing canonical routing mechanism, regression-covered, type-safe, full-suite clean, live-browser verified in the Couple Portal, and fully cleaned up.
