# Help & Guides — Content Inventory

**Type:** Content planning only. No articles have been written; this is the inventory that would guide writing them.
**Companions:** `docs/help-guides-product-education-audit.md`, `docs/help-guides-information-architecture.md` (read first — article types, length rules, and IA areas are defined there, referenced by name below).

**Priority key:** P0 = could block normal product use if unanswered. P1 = common enough to create real support burden. P2 = helpful education, not urgent. P3 = nice-to-have/best-practice.

---

## Full Question Inventory (by IA area)

### 1. Getting Started
- What do I actually need to do before I can take my first booking? *(How-To, P0)*
- What's the difference between Owner, Manager, Coordinator, and Staff? *(What Is This?, P0)*
- Where do my brand colors actually show up? *(Quick Answer + honest caveat, P0 — real, confirmed gap)*
- How do I invite a team member? *(How-To, P1)*
- What's the Venue Guide, and who sees it? *(What Is This?, P1)*

### 2. Finding & Booking Clients
- What happens when someone fills out my inquiry form? *(What Is This?, P0)*
- How do tour requests become bookings? *(Guided Journey — "New Lead", P0)*
- Why does this lead show up twice? *(Troubleshooting, P1 — should not happen given canonical intake, but real confusion if a venue manually adds someone already in the system)*
- Can I change my pipeline stages? *(Quick Answer, P1)*
- How do I set my tour availability? *(How-To, P1)*
- What's the difference between "Lead" and "Client"? *(What Is This?, P1)*

### 3. Working With Clients
- What's the Relationship Workspace? *(What Is This?, P1)*
- How do I message a couple? *(How-To, P0)*
- Why can't I see the couple's portal chat from the client page anymore / where did Messages go? *(Troubleshooting, P1 — real migration-education need post-RC2)*
- How do I invite a couple to their portal? *(How-To, P0)*
- Can more than one person from the couple use the portal? *(What Is This?, P1 — real, `client_contacts` supports this)*
- What can I see that my couple can't, and vice versa? *(What Is This?, P1)*

### 4. Contracts & Payments
- Who signs first, me or my client? *(What Is This?, P0 — actively evolving product behavior, see the audit doc's flag)*
- Why can't I edit a signed contract? *(Why, P0)*
- What happens if I need to change something after signing? *(How-To — amendments, P0)*
- How do I create a payment plan? *(How-To, P0)*
- Why did my invoice balance change? *(Why — should never happen post-fix, but worth a reassurance article, P1)*
- What's the difference between "sent," "paid," and "void" on an invoice? *(Quick Answer, P0)*
- Can I issue a refund? *(How-To, P1)*
- Is Stripe actually collecting my couples' payments? *(Why/honest-limitation, P0 — real, currently-true "not yet, pending live credentials" answer)*
- How does QuickBooks sync work? *(What Is This?, P2)*

### 5. Planning the Event
- What's the difference between the three Questionnaires? *(What Is This?, P1)*
- How do I add a custom question? *(How-To, P1)*
- What does "locked" mean on the Timeline? *(Quick Answer, P0)*
- Who can see what on the Timeline? *(What Is This?, P1 — Owner/Visibility model is genuinely new to most venues)*
- Can I have a multi-day Timeline? *(Quick Answer, P2)*
- What's a Playbook? *(What Is This?, P1)*
- How do key dates and reminders work? *(How-To, P2)*

### 6. Building the Event
- What's an Event Order / BEO? *(What Is This?, P0)*
- What's the difference between a Package and an Event Order line? *(What Is This?, P1)*
- If I change a package's price, does it change my already-booked clients' invoices? *(Why, P0 — real, correctly-designed "no" answer worth stating plainly)*
- How does inventory relate to my Event Order? *(What Is This?, P1)*
- Why can't I change this inventory item anymore? *(Why, P0 — finalized-immutability, a real and correct but surprising behavior)*
- What does the lock icon mean on my floor plan? *(Quick Answer, P0 — the brief's own flagship example)*
- How do I add furniture to a floor plan? *(How-To, P0)*
- What can my couple change on the floor plan, and what can't they? *(What Is This?, P0)*
- How do I know when my couple is done with seating? *(How-To, P1)*
- How do I finalize a floor plan? *(How-To, P1)*

### 7. Event Day
- What's the Day Sheet, and who's it for? *(What Is This?, P1)*
- How does vendor check-in work? *(How-To, P2)*
- What does the Wedding Day dashboard show me? *(What Is This?, P2)*

### 8. After the Event
- How do I send a post-event feedback request? *(How-To, P2)*
- What's the review/referral automation, and can I turn it off? *(What Is This?, P2)*

### 9. Vendors
- What does "preferred" vs "inactive" mean for a vendor? *(Quick Answer, P1)*
- How do I assign a vendor to an event? *(How-To, P1)*
- Can vendors see my floor plan / inventory? *(What Is This?, P2)*
- What can my vendor do in their own portal? *(What Is This?, P2)*

### 10. Your Venue
- How do I change my venue's colors and logo? *(How-To, P0)*
- Why doesn't my email look branded? *(Why/honest-limitation, P1 — real, confirmed current gap)*
- How do I set up Stripe / QuickBooks? *(How-To, P1)*

### 11. Reports
- What's the difference between a Report and a Saved Report? *(What Is This?, P2)*
- Where did /analytics go? *(Troubleshooting, P1 — real migration-education need)*
- How do I schedule a report? *(How-To, P2)*

### 12. Guided Journeys (per the IA doc's Part 9)
- New Venue, New Lead, New Booking, Planning, Event Week, After Event — each its own entry, not decomposed here (full treatment in the IA doc).

---

## Prioritized Content Matrix

| Area | User question | Article type | Priority | Context | Luv opportunity |
|---|---|---|---|---|---|
| Building the Event (Floor Plans) | What does the lock icon mean? | Quick Answer | P0 | Floor Plan Studio | Yes |
| Building the Event (Floor Plans) | What can my couple change vs. me? | What Is This? | P0 | Floor Plan Studio | Maybe |
| Contracts & Payments | Who signs first, me or my client? | What Is This? | P0 | Contract Detail | Yes |
| Contracts & Payments | Why can't I edit a signed contract? | Why | P0 | Contract Detail | No |
| Contracts & Payments | What's "sent" vs "paid" vs "void"? | Quick Answer | P0 | Invoice Detail | No |
| Contracts & Payments | Is Stripe actually collecting payments? | Why (honest limitation) | P0 | Settings/Payments | No |
| Building the Event (Event Order) | What's an Event Order / BEO? | What Is This? | P0 | Event Order panel | No |
| Building the Event (Inventory) | Why can't I change this item anymore? | Why | P0 | Event Inventory | No |
| Building the Event (Packages) | If I change a package price, does it affect existing bookings? | Why | P0 | Package editor | No |
| Planning (Timeline) | What does "locked" mean on the Timeline? | Quick Answer | P0 | Timeline editor | No |
| Working With Clients | How do I message a couple? | How-To | P0 | Relationship Workspace | No |
| Working With Clients | How do I invite a couple to their portal? | How-To | P0 | Relationship Workspace | Yes |
| Getting Started | Where do my brand colors show up? | Quick Answer | P0 | Settings — Brand | Yes |
| Getting Started | What's the difference between roles? | What Is This? | P0 | Team settings | No |
| Finding & Booking Clients | How do tour requests become bookings? | Guided Journey | P0 | Leads / Pipeline | Yes |
| Contracts & Payments | What happens if I need to change something after signing? | How-To | P0 | Contract Detail | No |
| Contracts & Payments | How do I create a payment plan? | How-To | P0 | Client Financials | No |
| Your Venue | How do I change my colors and logo? | How-To | P0 | Settings | No |
| Working With Clients | Where did Messages go? | Troubleshooting | P1 | Client detail | No |
| Working With Clients | Can more than one person use the portal? | What Is This? | P1 | Client contacts | No |
| Finding & Booking Clients | Can I change my pipeline stages? | Quick Answer | P1 | Pipeline settings | No |
| Finding & Booking Clients | How do I set tour availability? | How-To | P1 | Tour settings | No |
| Planning (Questionnaires) | What's the difference between the three Questionnaires? | What Is This? | P1 | Questionnaire library | No |
| Planning (Questionnaires) | How do I add a custom question? | How-To | P1 | Questionnaire editor | No |
| Planning (Timeline) | Who can see what on the Timeline? | What Is This? | P1 | Timeline editor | Maybe |
| Planning (Playbooks) | What's a Playbook? | What Is This? | P1 | Playbook library | No |
| Building the Event (Floor Plans) | How do I know when my couple is done with seating? | How-To | P1 | Floor Plan Studio | Yes |
| Building the Event (Floor Plans) | How do I finalize a floor plan? | How-To | P1 | Floor Plan Studio | No |
| Building the Event (Event Order/Package) | Package vs. Event Order line — what's the difference? | What Is This? | P1 | Event Order panel | No |
| Contracts & Payments | Can I issue a refund? | How-To | P1 | Invoice Detail | No |
| Vendors | What does "preferred" vs "inactive" mean? | Quick Answer | P1 | Vendor Network | No |
| Vendors | How do I assign a vendor to an event? | How-To | P1 | Event workspace | No |
| Your Venue | Why doesn't my email look branded? | Why (honest limitation) | P1 | Conversations | No |
| Your Venue | How do I set up Stripe / QuickBooks? | How-To | P1 | Settings — Integrations | No |
| Reports | Where did /analytics go? | Troubleshooting | P1 | Reporting nav | No |
| Getting Started | How do I invite a team member? | How-To | P1 | Team settings | No |
| Event Day | What's the Day Sheet, and who's it for? | What Is This? | P1 | Wedding Day dashboard | No |
| Finding & Booking Clients | Difference between "Lead" and "Client"? | What Is This? | P1 | Pipeline | No |
| Getting Started | What's the Venue Guide, who sees it? | What Is This? | P1 | Venue Guide | No |
| *(everything else in the Full Question Inventory above)* | — | — | P2–P3 | — | — |

**How many articles for a strong initial release:** the P0 row count above is **18** — this is the recommended first-release scope, not the full inventory. Adding the full P1 list brings the total to **~36**. This matches the brief's own explicit warning against documentation bloat: 18–36 short, well-targeted articles is a genuinely achievable, high-quality initial release; the full P0–P3 inventory in this document (~55 identified questions, before Guided Journeys and Best Practice migration) is the *backlog*, not the launch scope.
