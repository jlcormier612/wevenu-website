# Financial reconciliation

**Status:** Pending re-run on serving tip after deploy.

Expected: Fancy finalized fixture unchanged by template-builder UX (no EO line mutation from wizard navigation alone).

Command after tip is live:

```bash
EXPECTED_SHA=20a5d08c39d26efaef2fe098d3b42cf3e6c5000a \
  npx tsx docs/qa/event-order-process-completion/verify-financial-fixture.mts
```

Historical comparison values on prior tip (`d9e25c77`): invoice total **2189.81**, freeze rev **26**. Confirm actuals for this run — do not hard-code.
