# Phase 11A — Release isolation notes

**Do not commit from this task.** When a Sandbox release is authorized later, isolate only Phase 11A hunks.

## Clean / single-purpose diffs (easy to cherry)

| File | Phase 11A change only |
|---|---|
| `components/clients/client-list.tsx` | className → `htc-record-link` |
| `components/events/event-list.tsx` | className → `htc-record-link` |
| `components/requests/request-manager.tsx` | className → `htc-record-link font-medium` |
| `components/messaging/message-history-list.tsx` | className → `htc-record-link …` |
| `app/(app)/invoices/page.tsx` | add `htc-record-card-link` |
| `lib/theme/phase11a-record-interactions.test.ts` | **new file** (entirety is 11A) |

## Mixed-diff files (pre-existing dirty + 11A)

| File | Pre-existing | Phase 11A slice |
|---|---|---|
| `app/globals.css` | Large hospitality/Phase 1–10 CSS already dirty | Insert block: `.htc-record-link` + `.htc-record-card-link` (search `Phase 11A — Pattern 13`) |
| `components/leads/lead-list.tsx` | Hospitality / filters / other | Record name Link class only |
| `components/contracts/contract-list.tsx` | Hospitality / mobile cards / other | Two title Link classnames |
| `components/vendors/vendor-list.tsx` | Hospitality | Vendor name Link class |
| `components/payments/payment-schedule-list.tsx` | Hospitality | Schedule title Link class |
| `components/document-workspace/document-card.tsx` | **Phase 10** mobile overflow + other | Title button gains `htc-record-link`; remove redundant `hover:underline text-heading` |

## Dependencies

- Staff shell must include `.htc-staff` ancestor (already true for app workspace).
- Relies on existing `--foreground` charcoal (`#24332B` under staff light).
- Does **not** require Phase 11B–11E.
- Phase 10 Documents mobile treatment must remain when extracting `document-card` hunks.

## Explicitly out of release from this wave

- Calendar / Reports KPI / Tours chrome / Automations badges / Setup BYB selected (11B–11D+)
- Dirty-tree features unrelated to record links
- Isolated Phase 1–9 release worktree
- Production

## Baseline

- Branch: `feat/spaces-booking-e1-smart-fields`
- HEAD: `69cacab8508c40f4d4716b552f2b88e831816ca3`
- Sandbox still serves Phases 1–9 @ `1b7eca0d` (unchanged by this task)
