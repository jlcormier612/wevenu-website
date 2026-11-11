# Selection request vs Event Order share — forensic result

## Verdict

**Selection-request send does not share, finalize, or accept the Event Order.**  
The portal “Shared” / “Accept this Event Order” UI on fixture `ebf74f77-…` is a **pre-existing** shared Event Order from an earlier explicit Share (billing/workflow harness), not a side effect of Send selection request.

## Trace (code)

| Step | Proposal path | Selection-request path |
| --- | --- | --- |
| UI | CreateProposalSheet → Share/send | `choices-send-selection-request` → ShareDialog |
| Action | `sendProposal` → `submitProposalCoupleEmail` | `sendClientChoicesRequest` → `sendClientChoices` + `submitClientChoicesCoupleEmail` |
| Transport | `sendEmail` + `recordExternalClientOutbound` (`proposal_email`) | Same (`client_choices_request`) |
| Link | Proposal accept token URL | `choicesReviewUrl` → `/p/[token]?view=choices#choices` |
| EO share | N/A | **Not called** — no `shareEventOrderWithClient` / `setSharedAt` in client-choices |

## Sandbox persisted evidence (fixture B2P)

| Fact | Value |
| --- | --- |
| Event Order | `624eceef-…` |
| `shared_at` | `2026-10-24T02:24:06.106Z` (fixed) |
| Latest EO share activity | `2026-10-24T02:24:06.174Z` — “Updated shared copy” |
| Selection sends after that `shared_at` | **10+** packets with `sent_at` later; `shared_at` **unchanged** |
| `client_agreed_at` | **null** (Accept not set by selection open/submit) |
| Latest selection email | `sent_at` `2026-10-24T03:21:33Z`, `status=accepted`, `sourceType=client_choices_request`, Resend `provider_id=01a16bed-…` |
| Email URL (redacted) | `https://app.sandbox.hellotocheers.com/p/[redacted]?view=choices#choices` |
| Recipient | `b2p-simp-…@hellotocheers-test.invalid` (Sandbox test) |

## Why the screenshot shows Shared + Accept

1. Venue explicitly shared the finalized Event Order earlier (`shareEventOrderWithClient` → `shared_at` + portal documents).
2. Couple portal Event Order section correctly shows Shared / Accept for that artifact.
3. Selection email deep-links to **Choices** (`?view=choices`), a separate section. Opening Documents / Event Order still shows the legitimately shared EO.

## Safety preserved

- No booking / `booked_at` change from selection send  
- No invoice creation from selection send  
- Finalization and Share remain venue-controlled, separate steps  

Probe artifact: `selection-vs-share-probe.json`  
Harness now asserts isolation checks before any intentional Share step.
