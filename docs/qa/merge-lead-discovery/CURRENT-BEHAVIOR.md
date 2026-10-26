# Current behavior — Merge Lead (pre-change inspection)

Inspected on branch `feat/spaces-booking-e1-smart-fields` before discovery UX work.

## Entry points

- Lead detail: `MergeLeadButton` → `MergeLeadDialog` (`components/leads/merge-lead-dialog.tsx`).
- Possible-duplicate banner: opens the same dialog with `initialOtherLeadId` and auto-runs preview.

## Discovery (defect for venue users)

- Modal required **“Other lead ID”** (UUID paste) plus Preview.
- No name/email/phone search in the merge modal.
- Duplicate banner could pre-fill a matched ID when review already linked one; otherwise staff needed a UUID.

## Survivor selection

- Default primary = earliest `created_at` (`pickDefaultPrimary` in `lib/leads/merge.ts`).
- Identical `created_at` → `needsExplicitPrimaryChoice` (must choose before confirm).
- User may override primary via radio; preview re-runs with `primaryId`.

## Field contract

- Empty primary + populated secondary → **fill**.
- Identical → **same**.
- Both populated and different → **conflict** (explicit choice required).
- Primary populated + secondary empty → **keep_primary**.
- Includes contact + partner fields (`partner_*`), event fields, inquiry message (keep-both sentinel supported), assignment/source/channels.

## Related records

- Notes, tasks, activities on secondary **move** to primary (counts shown in preview).
- Tour appointments are **reassociated** to primary (not deleted/recreated). Venue may optionally cancel specific active tours before reparent.
- Secondary is **soft-marked** (`merged_into_lead_id`), not hard-deleted; detail redirects to primary.
- No customer messages / sequence enrollment on merge.

## Authorization & safety

- Venue-scoped load (`venue_id`); same-lead rejected; missing leads rejected.
- Blocks: already-merged secondary, merged primary, tour protection requests.
- Confirm revalidates preview + `updated_at` stamps (stale → abort).
- Atomic confirm via `merge_leads_v1` RPC (staff/owner check, `FOR UPDATE`, idempotent already-merged into same primary).

## Existing search elsewhere

- Leads list `getLeads` `q`: first/last/email/partner first/last (not phone).
- Calendar relation search: same fields (not phone).
- Merge discovery will add a dedicated search that also covers **phone** (and partner email for distinguishability) while staying venue-scoped and excluding the current lead.
