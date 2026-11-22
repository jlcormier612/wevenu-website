# CRM demo-isolation verification

`verify-demo-isolation.mts` exercises Fancy feedback, ordinary Sandbox customer, demo Stripe MRR exclusion, and disposable fixture classification on an isolated **file** CRM store.

```bash
npx tsx scripts/crm-data-clean/verify-demo-isolation.mts
```

Does not call Stripe, venue-app, or Auth. Does not mutate Sandbox live CRM.
