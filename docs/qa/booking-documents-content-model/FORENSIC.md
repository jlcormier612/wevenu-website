# Booking Documents content model — forensic

## Root cause

`components/events/booking-documents-tab.tsx` rendered a **Templates** card listing reusable contract templates and a **Send Questionnaire** action. That is Library / Questionnaires workflow UI, not event documents.

`get_venue_documents` also projected every non-draft questionnaire (including `sent` / `in_progress`) into the Documents workspace — conflating outbound status with returned records.

## Inclusion rules (product)

| Include in Documents | Exclude |
| --- | --- |
| Uploaded / shared files for this booking | Reusable contract / questionnaire templates |
| Event-specific contract records | Send-a-template CTAs |
| Questionnaires in `submitted` / `resubmitted` / `complete` / `changes_requested` | `draft` / `sent` / `in_progress` questionnaires |

## Fix

- Remove Templates section and send CTAs from Documents.
- Contracts section = event contracts only.
- Returned questionnaires section + workspace filter via `isReturnedQuestionnaireDocumentStatus`.
- Send/review remain on Questionnaires tab / Library / Contracts flows.
