# Migration Center Specialized Certification — STATUS

**Overall specialized MC paths:** **IN PROGRESS** (runtime verification running)

| Field | Value |
|-------|-------|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Prior serving (start) | `d62f4260` · TD `:807` · dpl match |
| Prior baseline | Final cert 36/36 intact — not reopened |
| Disposable venue | See `runtime-results.json` |
| Production | Untouched |

## Scope (from UI + code)

See `SCOPE-MATRIX.md`. Specialized entities exercised in this package:

| Path | Method | Target verdict |
|------|--------|----------------|
| guest_list | MC CSV | GREEN if DB-linked to client |
| guest orphan (missing parent) | MC CSV | GREEN if review / not persisted |
| event_vendor_assignment | MC CSV (vendor pre-seeded) | GREEN if assignment on event |
| timeline_entry (near + force) | MC CSV | GREEN if Ceremony start persisted |
| timeline far (no force) | MC CSV | GREEN if not persisted |
| document | Pre-upload + MC CSV | GREEN if doc on event |
| active_commitment | MC CSV | GREEN if EO + invoice + schedule |
| floor_plan | Dedicated PNG uploader | GREEN if document / floor_plans row |

## Defects in this package

| Change | Status |
|--------|--------|
| `lib/migration/event-vendor-assignment.ts` complete `VendorInput` (no partial cast) | Local fix + unit test; deploy if assignment create-vendor path needed on Sandbox |
| `lib/migration/event-vendor-input-complete.test.ts` | Added |

## Side-effect gates

Re-verified on specialized disposable venue: invitations / enrollments / scheduled messages.

## Launch decision

Pending runtime-results.json. Prior eight-entity + Word/PDF/Luv remain GREEN.

Unrelated dirty/untracked work preserved. Production untouched.
