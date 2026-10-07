# Setup Profile — Client Experience Model

## Verdict: implementing → deploy/browser proof

## Changes
- Customer-facing Setup Profile explanation + Invite to portal next step
- Planning dropdown sources active Client Planning templates (`kind === "client"`)
- Floor plans: multi-select client options + preferred starting plan; inherit creates `event_floor_plan_offers`
- Questionnaires: multi-select prepared as drafts at book (not auto-sent)
- Vendors: required = team expectation (not auto-assigned); recommended seeded as client recommendations

## Focused tests
`NODE_ENV=test npx tsx --test lib/event-setup/setup-profile-client-experience.test.ts lib/event-setup/setup-profile-defaults.test.ts lib/event-setup/setup-profile-model.test.ts lib/event-setup/profile.test.ts`
**37/37 PASS**
