# Post-contract Client Choices — STATUS

## IMPLEMENTATION STATUS: IN PROGRESS (Sandbox verification pending)

Architecture approved. Implementation landed in repo. Sandbox migrate + deploy + browser E2E required before GREEN.

## Locked architecture (shipping)

Choices Template → Create Client Choices → Send → Client submits → Venue reviews → **Venue finalizes** → **Event Order** → existing Invoice / Payment Plan. Client Submit ≠ charge. No second financial system. FE contracts immutable.

## What shipped (code)

- Migration `20261407300000_client_choices_foundation.sql`
- Domain: `lib/client-choices/*`, `lib/client-choices-templates/*`
- Library UI: `/library/choices-templates`
- Venue: Client Choices panel on Event Order tab
- Portal: Your Choices section + APIs + Next Steps/`client_choices` action type
- Documents union: `client_choices` in venue + finalized in couple documents
- Finalize → EO line APIs only (no direct invoice writes)

## GREEN gate

Requires Sandbox deploy + migration + browser E2E A–T (not unit tests alone).
