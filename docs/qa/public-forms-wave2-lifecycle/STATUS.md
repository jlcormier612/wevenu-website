# Public Forms Wave 2 — Operational management / lifecycle

**Status:** IMPLEMENTATION + TESTS GREEN · Sandbox deploy pending · Browser proof pending  
**Production:** untouched  
**Wave 1:** remains GREEN (`4446af99`)

## Product

Venue staff can create, draft, publish, edit, duplicate, archive, share, and attach multiple QR codes to purpose-specific Public Forms. Responses remain normal leads.

## Tests

`npx tsx --test lib/public-forms/wave1.test.ts lib/public-forms/wave2.test.ts lib/public-forms/public-path.test.ts lib/qr-campaigns/archive-ui-state.test.ts` → **37/37 pass**

Typecheck: no new errors in Wave 2 files.

## Browser QA (Sandbox)

Pending deploy of this commit.
