# Inventory & Event Order — Unified Document Lifecycle

**Verdict: OPEN / NOT ACCEPTED**  
**Date:** 2026-10-28  
**Production:** untouched  
**Unrelated dirty/untracked work:** preserved

Implementation map: [`IMPLEMENTATION-MAP.md`](./IMPLEMENTATION-MAP.md).

---

## Serving / deploy

| Item | Value |
|---|---|
| Commit | `2b97ed8805fde90079fdb69ea6a7e3990ec7d14b` |
| Deploy | [40800596173](https://github.com/jlcormier612/wevenu-website/actions/runs/40800596173) — success |
| Migration | `20261425800000_inventory_agreement_venue_documents.sql` via [40800628547](https://github.com/jlcormier612/wevenu-website/actions/runs/40800628547) — success |
| ECS | `htc-sandbox-venue-app:2b97ed8805fde90079fdb69ea6a7e3990ec7d14b` |

---

## Implemented on tip

| Requirement | Evidence |
|---|---|
| Remove Inv/EO from Portal Setup toggles | Browser: Settings → Leads planning list has no Inv/EO copy; Setup Profiles commercial note |
| Portal sections not gated by those toggles | `isPortalSectionEnabledByCapabilities` always true for inventory / event-order |
| Inventory finalize → email + portal notify | `finalize-notify.ts` after persist; failure cannot unlock |
| Client Choices finalize → email + portal notify | same pattern |
| Couple Documents — Inventory Agreement | merge helper + Documents UI card |
| Venue Documents — finalized Inventory | migration extends `get_venue_documents` |

Reused (unchanged domain rules): template→instance, share deep-links, client respond, venue review/finalize lock, EO Documents on share, Setup Profiles already exclude Inv/EO as setup steps.

---

## Focused tests

```text
npx tsx --test \
  lib/event-inventory/finalize-notify.test.ts \
  lib/client-choices/finalize-notify.test.ts \
  lib/portal/couple-documents-inventory.test.ts \
  lib/portal/inventory-event-order-discoverability.test.ts \
  lib/playbooks/planning-capabilities-batch.test.ts \
  lib/event-setup/venue-settings-sot.test.ts
→ 34 pass / 0 fail
```

## Browser (partial — serving SHA)

```bash
EXPECTED_SHA=2b97ed8805fde90079fdb69ea6a7e3990ec7d14b \
  npx tsx docs/qa/inventory-eo-document-lifecycle/verify-browser.mts
→ PARTIAL — 5 pass / 0 fail (Portal Setup / Settings gates only)
```

Shots: `shots/01-settings-planning-1280.png`, `02-setup-profiles-1280.png`, `03-settings-planning-390.png`.

---

## OPEN — required for ACCEPTED

Full real-browser scenarios from the brief are **not yet closed** on this tip:

1. Pre-booking Inventory: email link → choose/submit → venue review → finalize → client email + portal notify → both Documents open locked agreement  
2. Pre-booking Event Order (choices/response) equivalent  
3. Booked client portal initiation matching email/template path  
4. Finalization immutability, duplicate finalize/notify, notification failure handling, access isolation — end-to-end in browser  

Do not treat unit tests + Settings partial harness as GREEN for the full lifecycle.

Production untouched.
