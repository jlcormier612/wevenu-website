# Vendor list reflects Approved preference

**Environment:** Sandbox only  
**Verdict:** IN PROGRESS

## Root cause (proven)

Selecting **Approved** on the vendor form persists correctly as `venue_vendor_relationships.preference_level = 'standard'`. It does **not** change claim state.

Meadowbrook Sandbox (2026-10-13) after the user’s session:

| Vendor | preference_level | status | is_claimed |
|---|---|---|---|
| Baker's Dozen | `standard` (Approved) | active | false |
| Nail Studio | `standard` (Approved) | active | false |
| Harah's Hair | `recommended` | active | false |
| Cuppity Cakes | `preferred` | active | false |

The two Approved vendors were **Baker's Dozen** and **Nail Studio**.

The list Preference column intentionally rendered **no badge** for `standard`, while the Relationship column correctly showed **Not claimed**. The save succeeded; the list failed to reflect the saved Approved preference. Claim status is a separate fact and was never the approval field.

## Fix

Show an **Approved** badge for `preference_level === "standard"` in the venue Vendor list Preference column. Keep client-facing chips quiet for standard. Do not alter claim, invite, or relationship status writes.

## Files

- `lib/vendors/list-presentation.ts`
- `components/vendors/vendor-list.tsx`
- `lib/vendors/list-presentation.test.ts`
- `lib/vendors/vendor-network-preference.test.ts`
- `lib/vendors/vendor-approval-list.test.ts` (new)

## Tests

`npx tsx --test lib/vendors/list-presentation.test.ts lib/vendors/vendor-network-preference.test.ts lib/vendors/vendor-approval-list.test.ts lib/vendors/required-vendors.test.ts lib/vendors/resolve-or-create-vendor.test.ts` → **38 pass**
