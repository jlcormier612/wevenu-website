# Event Order workflow — commercial experience reuse

## Status

**IN PROGRESS — deployed commit pending Sandbox serve + E2E**

Product implementation is on `2bdb49e4`. Sandbox deploy dispatched; browser GREEN is not claimed until the serving image matches and the full journey harness passes.

## Implementation commit

| Item | Value |
| --- | --- |
| Commit | `2bdb49e4eb2ed49f78001f234e1672a92e7346d8` |
| Deploy | https://github.com/jlcormier612/wevenu-website/actions/runs/40059994727 |
| Branch | `feat/spaces-booking-e1-smart-fields` |

Production was not deployed.

## What changed (product)

### Reused commercial patterns

| Lead → Booked pattern | Event Order reuse |
| --- | --- |
| CreateProposalSheet / RH preview | `ClientChoicesPanel` two-column composer + `EventOrderTemplatePreviewView` / `ChoicesDefinitionView` |
| ArtifactReviewOverlay send preview | Full selection-request preview before ShareDialog |
| ShareDialog send | Unchanged `sendClientChoicesRequest` + ShareDialog |
| CommercialFacts meaningful CTAs | `EventOrderJourney` — never generic "View" |
| Create contract → invoice | Finalize Event Order (no signature) → Create invoice & payment plan |
| Invoice / payment plan engine | Existing `createInvoiceFromEventOrderAction` + payments UI |

### Stages

1. **Client selections** — template dropdown, RH full template preview (categories, fixed/included, prices, choice groups), prepare packet, ArtifactReviewOverlay full send preview, one Send selection request. Fixed lines freeze into `ChoicesDefinition.fixedLines` so the couple sees complete context.
2. **Event Order** — Review selections → apply → Review Event Order → Finalize Event Order. Signature / share is optional and not an invoice gate.
3. **Invoice & payments** — Create / Open invoice & payment plan labels; existing financial path preserved (`da1b04cf` billable reconciliation).

## Unit tests (local)

```text
npx tsx --test lib/events/event-order-journey-stage0.test.ts \
  lib/events/event-commercial-workflow-p2b.test.ts \
  lib/event-order-templates/selection-definition.test.ts \
  lib/client-choices/couple-email.test.ts
→ pass
```

## E2E (required for GREEN)

```text
EXPECTED_SHA=2bdb49e4eb2ed49f78001f234e1672a92e7346d8 npx tsx docs/qa/event-order-workflow-correction/verify-browser.mts
```

Run only after deploy success and serving image tag/digest match `2bdb49e4…`.

## Prior billing GREEN (preserve)

| Item | Value |
| --- | --- |
| Billing fix | `da1b04cfd6761c77ec89de81bc2e0609d7852231` |
| Digest (historical) | `sha256:272529ddc58671f2014c711d2c18d88a4fbba618c2851123b5396842e9986363` |
| Payable | $2,266.31 |

Do not regress billable vs delivery subtotal semantics.
