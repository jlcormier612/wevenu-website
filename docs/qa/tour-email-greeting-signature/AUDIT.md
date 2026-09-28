# Tour / sequence email greeting + signature regression

**Date:** 2026-09-28  
**Trigger:** Screenshot of outbound email for Betty Rubble showing wrong greeting and duplicated venue signature.

## Observed (Betty conversation, delivered 2026-09-28T02:05:03Z)

```
Hi Betty Rubble,
…
Warmly,
Jen's Fancy Venue
Jen's Fancy Venue
```

## Exact path (not the system Tour Schedule builder)

| Layer | Finding |
|---|---|
| Email body | New Inquiry Welcome (MSG-01 / SEQ-01), not `lib/tours/communication.ts` |
| Greeting token | Venue copy still had `Hi {{client_name}},` → `Betty Rubble` |
| Signature tokens | `Warmly,\n{{coordinator_name}}\n{{venue_name}}` |
| Coordinator SoT | `getMergeContextForRelationship` → `venue_staff` where `is_owner` |
| Failure mode | Fancy Venue has **two** `is_owner` rows (Jennifer Fancy accepted + Ron Cormier pending invite). Bare `.maybeSingle()` → PGRST116 → `staff` null → fallback `venues.name` |
| System tour emails | Already correct: `Hi Betty,` via first-token split; no Warmly block |

Authoritative sources after fix:

| Value | Source |
|---|---|
| Greeting | `leads.first_name` / `{{first_name}}` |
| Owner signature | Accepted `venue_staff` owner `full_name` + `title` |
| Venue signature line | `venues.name` (customer-facing) |

## What changed (root cause)

1. **Coordinator:** `is_owner` + `maybeSingle` since Jul 2026; became wrong when a second owner row appeared (owner-invite work ~`ac3d4cee`, Ron row 2026-09-24).
2. **Greeting:** Masters moved to `{{first_name}}` in `feb0e00e`; provision skips existing copies → MSG-* venue rows kept `{{client_name}}`.

## Unrelated but co-reported (already fixed in `39fc3aff`, pending deploy)

- Manual lead **In Workflow** — SEQ-01 `update_pipeline_on_enroll` on `lead_created`
- Manual lead **SMS Allowed** — phone-keyed consent inheritance from Rebecca

## Intentionally not changed

- Proposal branding (`venues.name` customer-facing / `business_name` legal)
- Date Hold defaults
- System tour confirmation copy (no Warmly redesign; first-name greeting already correct)
- Legitimate website inquiry SMS consent
