# Launch Recovery — dedicated Sandbox E2E fixtures

Created 2026-09-28 for the post-repair customer-journey run. These exist so the
run is reproducible without touching the canonical Jennifer account
(`jennifer@hellotocheers.com` / Jen's Fancy Venue), which was not read, modified,
signed out, or re-credentialed at any point.

## Venue / staff user

| Field | Value |
| --- | --- |
| Venue name | `Recovery E2E Venue 1790617113989` |
| Venue id | `9d67030d-365f-472d-9dcc-817007b7c1cb` |
| Owner email | `recovery-e2e-1790617113989@hellotocheers-test.invalid` |
| Auth user id | `8e2d8392-9797-4add-a69b-afcae4a31e42` |
| Enrollment id | `ffd8b953-ec73-4586-94d3-f7f178d90812` |
| `venue_staff` id | `ed71256c-38a9-4956-9340-6c3927d6bc15` (`role=owner`, `is_owner=true`, `access_title=administrator`) |
| Onboarding type | `self_setup`, plan `standard` |

The password lives only in `/tmp/e2e-creds.json` on the operator machine. It was
generated for a user that did not exist before this run and is deliberately not
recorded here or anywhere in source control.

## Abandoned first attempt

| Field | Value |
| --- | --- |
| Enrollment id | `6bd4de04-ab14-4e75-838e-8687b0b188cb` |
| Owner email | `recovery-e2e-1790616419814@hellotocheers-test.invalid` |

Left at `status=pending`. Provisioning failed against the `venue_staff.access_title`
NOT NULL constraint, so no venue, staff row, or auth user was created. Retained
rather than deleted because it is the evidence that self-setup provisioning was
broken, and deleting fixtures was out of scope.

## Journey records (Robin Avery — post-migration Booked path)

| Field | Value |
| --- | --- |
| Lead id | `0d151a4c-10ed-410d-94c6-f8d7f06aa828` |
| Client id | `47c813ab-87a1-4f4a-ad24-fa3228f5c9d5` |
| Event id | `b8c48297-f54f-4d3e-8a63-8f4e62a99f8a` |
| Selected package | Essential Wedding · $18,000 · selection `0b223bb2-41a6-416a-955a-24ca2954de20` |
| Contract id | `0f0cae7d-10d4-408f-bad6-935a4f00f637` (Fully Executed) |
| Invoice id | `a09d3735-c669-4fc2-b887-d1d2465871e6` (`INV-2026-A09D37`) |
| Date hold | `71eea892-aad2-4f72-8795-0ce190a02afb` · 2027-09-11 · `converted` |

## Taylor Morgan — pre-migration leftover (do not hand-edit)

| Field | Value |
| --- | --- |
| Lead id | `582ab281-9ea7-477d-a293-6f104b39d6bd` |
| Client id | `3f5859eb-68fe-4d4c-a503-d97520678ff1` |
| Date hold | `09b0ec92-7673-48f1-b7bd-ff2f68524d09` · 2027-06-19 · still `active` |

Booked before `20261408300000` was applied. The hold is leftover evidence, not a defect in the current RPC. The already-Booked branch of `book_relationship` converts leftover active holds on the Event date on the next authoritative booking write. Proven by source assertion in `lib/availability/date-hold-booked-boundary.test.ts`. The row was not mutated by hand.

## Convention

Follows the existing Sandbox E2E convention (`scripts/verify-crm-sandbox-e2e.mts`):
`*-e2e-<stamp>@hellotocheers-test.invalid`. Provisioning went through the real
`/api/internal/enrollment/upsert` → `/api/internal/enrollment/provision` path, so
the venue is shaped exactly like a real customer's rather than hand-assembled.
