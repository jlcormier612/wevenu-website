# P2-A — Event workspace tabs + cards

**STATUS:** Implementation local; Sandbox deploy + browser verification in progress.  
**Date:** 2026-10-23  
**Scope:** Venue tab restructure, Questionnaires card, Inventory & Event Order card. No commercial/send/finance/scheduling changes.

## Changes

- Row 1: Planning Overview, Planning Tasks, Timeline, Floor Plans, Vendors
- Row 2: Documents, Payments, Conversation, Activity, Internal notes, Luv
- Cards: Questionnaires; Inventory & Event Order (open existing TabsContent via hash)
- Deep links preserved: `#questionnaires`, `#inventory`, `#event-order`, `#event-order-choices`, etc.
- Couple portal: Inventory/Order nav hidden until shared (active shared entries kept). Full Docs-first removal deferred to P2-D.

## Units

```text
npx tsx --test lib/events/workspace-tab-nav-p2a.test.ts \
  lib/playbooks/constants.test.ts \
  lib/event-setup/commercial-c6-setup-cleanup.test.ts \
  lib/events/questionnaire-delivery-guidance.test.ts
→ 25/25 pass
```
