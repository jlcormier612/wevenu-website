# Commercial workflow vs Event Order (code mapping)

Serving at inspection: `htc-sandbox-venue-app:49b3c72dcc0ef251f19fc35b40a7055ed54da87e`  
Digest: `sha256:44c06727274575b855b9ad014e322fdeaa44a6750ce329040efa0ab16bfc0f88`

| Existing commercial pattern | Actual component / action | Event Order equivalent | Connection |
| --- | --- | --- | --- |
| Package/proposal preparation | `lib/commercial-proposals/service.ts` + proposal builder | Event Order template → `createClientChoicesFromEventOrderTemplate` in `ClientChoicesPanel` (`choices-start-selections`) | Reused template store (`event_order_templates`). Not a second catalog. |
| Proposal preview | Proposal preview UI | `choices-staff-preview` dialog (`ChoicesDefinitionView`) | Same packet the portal renders. Preview does not send. |
| Proposal send/share | ShareDialog + couple email | `sendClientChoicesRequest` → `submitClientChoicesCoupleEmail` + ShareDialog | Reused ShareDialog + `sendEmail`. **Was misconnected:** URL used a financial portal token when that was the only/newest fallback (`sessions[0]`). |
| Client package selection | Couple proposal page | `ChoicesPortalSection` via `/p/{coupleToken}?view=choices#choices` | Financial token renders `PaymentAccessShell` and ignores the hash. That is the invoice page the user saw. |
| Client proposal response | Proposal submit | `POST /api/portal/choices/submit` | Persists on `client_choices`. Does not create an invoice. |
| Create Contract | `createContractAction` opens the contract document | `finalizeClientChoicesAction` (`choices-create-event-order`) applies lines onto the Event Order | Reuses `ensureEventOrder` + line apply. After success the page scrolls to `#event-order-order`. |
| Contract document editor | Contract builder | `EventOrderPanel` | Existing editor. Stages are no longer collapsed `<details>`, so the document stays on the page like the contract step. |
| Finalization / signatures | Contract finalize + existing signature support | Event Order finalize/share on `EventOrderPanel` | No new signature system. |
| Create invoice/payment plan | Invoice from contract/commitment | `createInvoiceFromEventOrderAction` | Existing financial engine. Booking-commitment invoice is excluded from the EO-linked invoice lookup. |
| Documents | Couple Documents | Shared Event Order + shared invoice via existing portal documents | Documents-first. Drafts stay unshared. |

## Root cause — selection email opened the invoice

`submitClientChoicesCoupleEmail` chose:

`sessions.find(accessLevel !== "financial") ?? sessions[0] ?? create couple`

Invoice send (`lib/invoices/outbound.ts`) creates a `financial` session and links `/p/{financialToken}`. When that was the only session, the selection email reused it. `app/(portal)/p/[token]/page.tsx` renders `PaymentAccessShell` for every financial token and never reads `#choices`. The button label was “Review your selections”; the page was Invoice & Payment Plan (contracted total, amount paid, balance, payment plan).

P2-E browser checks asserted a `#choices` string in the email payload and opened a pre-chosen couple token. They did not open the URL the email builder actually emits when the client’s only session is financial.

## Root cause — workflow did not operate like proposal → contract

The domain actions already existed (template → send → submit → finalize onto Event Order → share → invoice → Documents), but the Event Order document stage was a collapsed `<details>` whenever selections were the current step. “Start selections” and the document lived behind that disclosure and a separate journey chrome, so the page did not present the next commercial document the way Create Contract does.

## Correction in this change

- Pick only `couple` or `planning` sessions; otherwise create a couple session labeled `Selections`.
- Link: `/p/{token}?view=choices#choices` (`view` survives fragment-stripping redirects).
- Financial tokens still ignore `view=choices` and stay on `PaymentAccessShell`.
- Invoice outbound still creates/uses the financial token only.
- Both Event Order stages stay visible.
- Create Event Order scrolls to `#event-order-order`.
