# Continue manually → Select package → Create contract

## Status: GREEN (Sandbox browser + persisted state)

**Verified tip:** `9e59f278` (live Sandbox at verification; Luv/financial ancestors included)  
**Script:** `scripts/qa/continue-manually-direct-contract-browser.mts`  
**Evidence:** `browser-results.json`, `01-sent-waiting.png` … `04-contract.png`, `run.log`

### Root cause of the “stuck after proposal” report

The agreed path already existed: **Continue manually** withdraws the sent proposal; **Select package** appears for venue takeover; **Create contract** is primary once a venue selection exists with `proposal_id=null` (offer-only exception via `isVenueManualTakeover`). The gap was discoverability after withdraw — addressed by opening the Select package sheet immediately when no selection exists.

### Journey A (offer-only Fancy) — PASS

| Step | Result |
|---|---|
| Sent proposal, no package | Continue manually visible; Create contract hidden |
| Withdraw | `commercial_proposals.status=withdrawn` |
| Select + save package | Selection `proposal_id=null`, draft |
| Reload | **Create contract** visible |
| Create contract | Navigates `/contracts/new?selectionId=…` |
| History | Withdrawn proposal row retained; not accepted |

### Follow-up code

`booking-journey-panel.tsx`: after successful withdraw with no selection, open Select package sheet.
