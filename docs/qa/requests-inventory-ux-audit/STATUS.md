# Requests + Inventory UX audit — STATUS

**Sandbox tip:** pending deploy (see browser-results after verify).  
**Production:** untouched.

## Part 1 — Due date label — GREEN (code)

- Root cause: New Request date input had no visible `<label>`.
- Fix: `components/requests/request-manager.tsx` — label **Due date** with `htmlFor` / `id="request-due-date"`.
- Behavior (optional date, persistence) unchanged.

## Part 2 — Starter Edit label — GREEN (code)

- Root cause: starters used `LIBRARY_LABELS.editActivities` (“Edit activities”) with preview emphasis; venue-owned used `LIBRARY_LABELS.edit` (“Edit”).
- Both already linked to the same `/library/inventory-templates/${id}` detail editor. Customize remains the separate duplicate-to-venue-owned path.
- Fix: starters use `LIBRARY_LABELS.edit` + edit emphasis. No workflow removed.

## Part 3 — Inventory images → clients — GREEN_NO_CLIENT_IMAGES

See `docs/qa/inventory-item-images-client-visibility/FORENSIC.md` and `probe-results.json`.

Catalog `image_url` exists (e.g. 72" Round Table public storage URL). Event inventory + portal RPC/API/UI have **no** image field. Images are venue-catalog only today. No client-facing image feature implemented (decision gate).

## Verification

- Unit: `lib/requests/due-date-label.test.ts`, `lib/event-inventory/starter-edit-label.test.ts`
- Probe: `docs/qa/inventory-item-images-client-visibility/probe-visibility.mts`
- Browser: `EXPECTED_SHA=<tip> npx tsx docs/qa/requests-inventory-ux-audit/verify-browser.mts`
