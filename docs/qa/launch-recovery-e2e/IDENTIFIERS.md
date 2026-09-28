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

## Convention

Follows the existing Sandbox E2E convention (`scripts/verify-crm-sandbox-e2e.mts`):
`*-e2e-<stamp>@hellotocheers-test.invalid`. Provisioning went through the real
`/api/internal/enrollment/upsert` → `/api/internal/enrollment/provision` path, so
the venue is shaped exactly like a real customer's rather than hand-assembled.
