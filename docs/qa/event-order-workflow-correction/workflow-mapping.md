# Event Order ↔ Lead→Booked commercial mapping

| Lead → Booked capability | Existing implementation | Event Order reuse |
| --- | --- | --- |
| Package/proposal composition | `CreateProposalSheet`, package eligibility | Template dropdown + `createClientChoicesFromEventOrderTemplate` |
| Right-hand preview | Proposal sheet / MultiOptionProposalView | `EventOrderTemplatePreviewView` (pre-packet) / `ChoicesDefinitionView` (packet, includes `fixedLines`) |
| Preview as client will receive | `ArtifactReviewOverlay` + proposal view | Same overlay over full `ChoicesDefinitionView` |
| Send | ShareDialog / proposal send | ShareDialog + `sendClientChoicesRequest` (selection email, not financial) |
| Client response | Proposal accept | Portal `/api/portal/choices` submit |
| Venue next action | Create contract | Review selections → Create/Update Event Order |
| Finalize document | Contract finalize/sign | **Finalize Event Order only** — signature ceremony skipped for this release |
| Invoice & payment plan | Post-contract invoice + plan | `EventOrderInvoiceLink` → `createInvoiceFromEventOrderAction` + `/payments/new` |
| Documents / portal | Existing docs surfaces | Unchanged EO share + Documents |

## Explicit non-goals

- No `commercial_proposals` row for post-booking EO workflow
- No change to `bookClient` / `events.booked_at`
- No parallel invoice or payment-plan calculator
- Inventory remains off this commercial path

## Lifecycle order (must stay distinct)

1. Send selection request  
2. Couple submit  
3. Venue apply selections → Event Order lines  
4. Venue finalize Event Order  
5. Create invoice & payment plan → send financial request  
