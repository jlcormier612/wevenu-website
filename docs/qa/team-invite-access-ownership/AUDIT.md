# Owners vs Team — authorization audit

## Findings

### 1. Owner storage
- Table: `venue_staff`
- Flag: `is_owner boolean`
- Pending: `owner_invite_pending` (set true on invite; flipped to `is_owner=true` on accept)
- Display fields on the same row: `full_name`, `title`, `email`
- **No separate owners table**

### 2. Multi-owner support — YES (backend)
- Multiple `venue_staff` rows may have `is_owner=true`
- `venue_active_owner_count(venue_id)` counts accepted active owners
- `enforce_last_owner_invariant` prevents removing/demoting the last accepted owner
- Unique partial index: at most **one** pending owner invite per venue
- Invite path: `inviteStaffMember({ isOwner: true })` → email + `owner_invite_pending`

### 3. Owner vs Administrator
- Owner (`is_owner`): ownership-only caps (`ownership.add_owner`, `remove_owner`, `transfer`, `close_venue`) + automatic `account.billing`
- Administrator: broad operational caps via `access_title`; **not** ownership-only unless also `is_owner`
- Owner can coexist with any `access_title` (Jennifer Fancy = `administrator` + `is_owner`)

### 4. Staff access storage
- `access_title`, `title_basis`, `capability_overrides` (jsonb sparse)

### 5. Business & Brand single-owner UI assumption
- `getVenueFullDetails` uses `.maybeSingle()` on `is_owner=true` — assumes ≤1 owner for profile fields
- `updateOwnerStaff` patches **all** `is_owner=true` rows with the same name/title/email
- Currency / week-start live on `venues`, unrelated to ownership auth

### 6. UX decision (this work)
- **Business & Brand**: manage owners (list + Add owner) using existing `inviteStaffMember(isOwner)` / remove / last-owner rules
- **Team & Permissions**: staff only — no Owner invite/edit controls; owners listed informationally at top
- Add-owner from Business & Brand sets `accessTitle: administrator` (full day-to-day + ownership) without exposing Access/Owner pickers
- Do **not** invent a second owner system

### 7. Production
Untouched (Sandbox only)
