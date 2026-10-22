# Vendor Workflow Clarity Fix — Overview + Vendors Tab

**Status: GREEN**  
**Sandbox only. Production untouched.**  
**Unrelated dirty paths preserved (~945).**

## Product commits

| Role | SHA |
| --- | --- |
| Initial clarity helpers + Vendors tab grouping + preview badge | `e5f0366180a5d7284c1d5eaa5454fdeccea84a1d` |
| **Serving product** — wire copy into live Overview Event Setup vendors card | `5c236121d110c8f7d36bac180d8d30deaac9e05d` |

## Source discrepancy (audit vs current)

The forensic audit targeted `BookingOverviewSummary` (“vendors selected” / “recommendations pending”). In current source that component is **not mounted** on booked Overview (`event-detail.tsx` Overview = Event Setup + Needs Attention). Fix A was applied to the orphaned summary helper **and** to the live surface: Event Setup vendors readiness (`lib/event-setup/readiness-detail.ts` → `event-setup-card-vendors` / `overview-vendors-tile`).

## Before → after

| Surface | Before | After |
| --- | --- | --- |
| Overview Vendors | Misleading selected/pending (orphaned summary) / Network-only highlight count on Event Setup | “N vendors assigned…” + unsubmitted/all-submitted/no-highlights copy |
| Vendors tab highlights | Flat list; `selectedAt` badge only | Help copy + **Chosen by the couple** / **Not yet submitted** groups (`selectedAt` only; `pickedAt` ignored) |
| Portal preview | “Visible to client” ambiguity risk | Badge/copy: recommendations ≠ assigned roster; view-only |

## Deploy + serving

- Deploy run: https://github.com/jlcormier612/wevenu-website/actions/runs/39817396566 (`success`)
- Serving `data-dpl-id`: `5c236121d110c8f7d36bac180d8d30deaac9e05d` (exact match)

## Tests

| Suite | Result |
| --- | --- |
| Focused clarity + readiness + vendors setup + required/portal/network vendor tests | **77 / 77 pass** |
| Browser acceptance (`vendor-workflow-clarity-acceptance.mts`) | **18 / 18 PASS → GREEN** |

Pre-existing unrelated failure (not in this suite): `lib/clients/contact-workspace.test.ts` inquiry-message assertion — not touched.

## Browser fixture + isolation

- Fancy venue · client `b4e2764b-…` · event `ebf74f77-…`
- Browse: recommendation + assignment fingerprints unchanged
- Remove unsubmitted highlight: recommendation row deleted; **assignments unchanged**; Network 10→10; invites 1→1; notifications 3483→3483
- Fixture recommendation restored after remove check

## Screenshots

- `docs/qa/booking-to-portal-simplification/vendor-workflow-clarity-shots/overview-vendors-1280.png`
- `docs/qa/booking-to-portal-simplification/vendor-workflow-clarity-shots/vendors-highlights-1280.png`
- `docs/qa/booking-to-portal-simplification/vendor-workflow-clarity-shots/vendors-highlights-390.png`
- `docs/qa/booking-to-portal-simplification/vendor-workflow-clarity-shots/preview-vendors-1280.png`

## Machine results

- `docs/qa/booking-to-portal-simplification/vendor-workflow-clarity-results.json`
- `docs/qa/booking-to-portal-simplification/vendor-workflow-clarity-acceptance.log`

## Limitations

- Fixture had zero `selectedAt` rows → “Chosen by the couple” group correctly hidden (empty-state rule). Submitted-group visibility covered by unit/seam tests.
- `BookingOverviewSummary` remains fixed but unmounted; remount would already show correct copy.
- No lifecycle/RPC/schema/approval/portal-visibility changes.
