# Migration Center follow-up — partial import clarity + empty-client discoverability

**Code tip:** pending commit  
**Sandbox:** pending deploy  
**Production:** untouched

## A. Partial imports

- Existing machinery already distinguishes `partially_done` / needs decision / outcome sentence.
- **Defect found:** post-commit toast always used `toast.success`, including when unresolved records remained (also when `failed` was only in the commit batch).
- **Fix:** `formatPartialImportGuidance` + commit toast from real session resume counts; durable `data-migration-outcome="needs-attention"` callout.

## B. Empty-venue clients

- Header already had `+ New Client` + Import; empty state was lead-centric (“convert their lead inquiry”).
- Prior onboarding harness noted New Client hard to discover on empty venues.
- **Fix:** empty state copy + primary **Add your first client** + **Import Clients** alternative (`data-clients-empty`).

## Verify

```bash
npx tsx --test lib/migration/session-accounting.test.ts lib/migration/partial-import-clarity.test.ts lib/clients/empty-state-discoverability.test.ts
EXPECTED_SHA=<tip> npx tsx docs/qa/migration-partial-empty-clients/verify-browser.mts
```
