# Hello to Cheers — Starter Library + Complete Starter Experience

**Document type:** Product / content definition (no implementation)  
**Product name (customer-facing):** Hello to Cheers  
**Date:** 2026-08-11  
**Standard:** High-end release — complete and immediately useful, not an MVP sample set  

This document defines what every newly created venue account receives permanently upon initial account provisioning, what content is authored, how the customer should experience it, and exactly what Hello to Cheers must build where the current implementation is incomplete.

Implementation begins only after product review of this pack.

---

## 1. Executive Summary

Every new Hello to Cheers venue should log in and find a full, professionally written Starter Library already waiting — not empty shelves, not a demo corner, not a short list of “what we can seed today.”

The Starter Library is how Hello to Cheers proves it understands how an independent wedding/event venue actually runs:

- respond to inquiries and schedule tours  
- share packages and answer FAQs  
- move a lead through a clear sales process  
- send a solid agreement structure (without pretending to be the venue’s lawyer)  
- collect final details  
- plan the day with client and team checklists  
- build inventory and Event Order / BEO  
- schedule payments against invoices  
- share a polished brochure with prospects  
- open useful Saved Reports  

**Philosophy used in this pack (same as D5A Inventory):**  
If something belongs in the finished product and the code does not support it yet, we **define the experience, write the content, name the gap, and list the engineering build**. We do not drop it because the schema is thin today.

**Contract safety (non-negotiable):**  
The starter contract is a professional **structure and product example**. Hello to Cheers does **not** invent legally operative cancellation, insurance, liability, indemnification, force majeure, alcohol, damages, dispute, governing-law, default, attorney-fee, or waiver language. Those sections use venue-owned placeholders.

**Protected master / venue copy:**  
Hello to Cheers keeps a protected system master for each starter. New venues receive an independent venue-owned copy. Venue edits never alter the master or anyone else’s copy. Venues can re-copy a master later without overwriting customized versions.

---

## 2. Finished Starter Library

Every new venue receives the following as **venue-owned copies**, organized with the existing Library IA (Agreements · Pricing & Packages · Planning · Communication · Marketing · Reports), plus financial **default configurations** that sit where venues already create Payment Plans / Invoices.

### 2.1 Complete set (provisioned)

| ID | Name | Form | Library home |
|----|------|------|----------------|
| MSG-01 | New Inquiry Response | Message Template (Email) | Communication → Message Templates |
| MSG-02 | Tour Confirmation | Message Template (Email) | Communication → Message Templates |
| MSG-03 | Tour Reminder | Message Template (Email) | Communication → Message Templates |
| MSG-04 | Tour Follow-Up | Message Template (Email) | Communication → Message Templates |
| MSG-05 | Proposal Follow-Up | Message Template (Email) | Communication → Message Templates |
| MSG-06 | Contract Reminder | Message Template (Email) | Communication → Message Templates |
| MSG-07 | Final Details Reminder | Message Template (Email) | Communication → Message Templates |
| MSG-08 | Final Guest Count Reminder | Message Template (Email) | Communication → Message Templates |
| MSG-09 | Event Week Welcome | Message Template (Email) | Communication → Message Templates |
| MSG-10 | Payment Reminder | Message Template (Email) | Communication → Message Templates |
| MSG-11 | Post-Event Thank You | Message Template (Email) | Communication → Message Templates |
| CTR-01 | Wedding Venue Agreement | Contract Template | Agreements → Contract Templates |
| QST-01 | Wedding Final Details | Questionnaire Template (+ finished questionnaire model) | Agreements → Questionnaire Templates |
| PKG-01 | Ceremony & Reception | Package (starter record) | Pricing & Packages → Packages |
| PKG-02 | All-Inclusive Celebration | Package (starter record) | Pricing & Packages → Packages |
| PKG-03 | Intimate Gathering | Package (starter record) | Pricing & Packages → Packages |
| FAQ-01…12 | Core Venue Guide FAQs | Library content (Venue Guide FAQs) | Communication → Venue Guide |
| BR-01 | Venue Overview | Brochure | Marketing → Brochures |
| PLB-C1 | Standard Wedding — Client Planning | Planning Template | Planning → Planning Templates |
| PLB-V1 | Standard Wedding — Venue Planning | Planning Template | Planning → Planning Templates |
| TL-01 | Wedding Day — Classic | Timeline Template | Planning → Timeline Templates |
| TL-02 | Wedding Day — Essentials | Timeline Template | Planning → Timeline Templates |
| INV-CAT | Starter Master Catalog items | Inventory catalog starters | Pricing & Packages → Inventory |
| INV-01 | Ceremony Setup | Inventory Template | Pricing & Packages → Inventory Templates |
| INV-02 | Reception Essentials | Inventory Template | Pricing & Packages → Inventory Templates |
| EO-01 | Wedding Day Operations | Event Order Template | Planning → Event Order Templates |
| FP-01 | Reception — Rounds (150) | Floor Plan Template | Planning → Floor Plan Templates |
| PIPE-01 | Wedding Inquiry Pipeline | Pipeline Template | Planning → Pipeline Templates |
| PAY-DEF-01 | 50% Deposit + 50% Final | Default payment schedule configuration | Payments setup (not a Library “template table”) |
| PAY-DEF-02 | 30% Deposit + 70% Final | Default payment schedule configuration | Payments setup |
| PAY-DEF-03 | Three Equal Installments | Default payment schedule configuration | Payments setup |
| RPT-01 | Sales Pipeline — This Quarter | Saved Report | Reports → Saved Reports |
| RPT-02 | Bookings — This Year | Saved Report | Reports → Saved Reports |
| RPT-03 | Revenue — This Month | Saved Report | Reports → Saved Reports |
| RPT-04 | Events Overview — This Quarter | Saved Report | Reports → Saved Reports |

**SMS:** Message starters ship as Email first. Each may be duplicated by the venue into SMS using the same smart-field vocabulary (already shared across channels in `MESSAGE_MERGE_FIELDS`). Hello to Cheers may offer “Create SMS version” from an email starter without inventing different tokens.

**Not provisioned as fake “templates”:** Invoice body documents. Finished experience = invoices created from packages / Event Order / retainer flows with clear defaults (see §5 Financial).

### 2.2 Keep Library calm

Even with a complete set, the Library must not feel like 40 competing objects.

| Rule | Behavior |
|------|----------|
| Existing IA | Keep Agreements / Pricing & Packages / Planning / Communication / Marketing / Reports |
| Starter badge | Every provisioned item shows a quiet “Starter” badge until the venue edits it |
| Recommended ribbon | Within Message Templates and Planning Templates, a “Recommended starters” group at top |
| Counts | Badge counts include starters (they are real venue copies) |
| Empty zero | New venues never see zero in Contracts, Messages, Packages, Planning, Guides |
| No technical jargon | Never label cards “entities,” “canonical,” “working items,” or “domains” |

---

## 3. Customer Mental Model

The venue owner thinks in jobs, not architecture:

| What they need | What they open |
|----------------|----------------|
| “Send this couple our package.” | Packages → brochure or proposal message |
| “Have them complete the questionnaire.” | Questionnaire → send / portal |
| “Build their BEO.” | Event Order (from Event Order Template + inventory) |
| “Finalize inventory.” | Event Inventory |
| “Send the contract.” | Contract from template |
| “Who still owes me information?” | Planning / portal tasks / Luv |
| “How is the business doing?” | Reporting + Saved Reports |

They reuse Library things. They customize their copies. They apply copies to clients and events. They never need to understand masters, merge engines, or snapshot semantics — those are implementation facts, explained only in this engineering document.

---

## 4. Capability Classification

| Capability | Finished-product requirement | Starter needed? | Correct form | Current support | Required build |
|------------|------------------------------|-----------------|--------------|-----------------|----------------|
| Message Templates | Full reusable venue communications library | Yes — MSG-01…11 | Template | Strong (`message_templates`, categories, merge, scheduled send) | Provisioning; resolve `task_name`; add tour/payment merge fields; optional “Create SMS version” |
| Brochure | Polished prospect leave-behind | Yes — BR-01 | Template / brochure record | Strong (welcome/closing + live packages/FAQs + branding) | Provisioning; ensure welcome does not require unsupported `{{tokens}}` |
| Packages | Sellable offerings | Yes — PKG-01…03 | Starter record | Strong | Provisioning with example inclusions + prices clearly labeled as examples |
| FAQs | Couple/vendor answers | Yes — FAQ-01…12 | Library content (Venue Guide) | Strong | Seed FAQs on guide for new venues |
| Pipeline | Sales process stages | Yes — PIPE-01 | Template | Strong (stages + canonical mapping) | Provisioning + make active by default for new venues |
| Questionnaire | Collect day-of logistics truthfully | Yes — QST-01 | Template applying to event questionnaire | **Partial** — 6 optional fields + always-on guest/emergency; locations/times exist on row | **Expand questionnaire field model** to finished QST-01 (§6) |
| Contract | Sendable agreement structure | Yes — CTR-01 | Template | Partial — merge fields exist; default content includes language we will not keep; missing package/spaces/price tokens | Safer CTR-01 body; extend merge map; provisioning replaces old default for new venues |
| Event Order / BEO | Day-of operational order | Yes — EO-01 | Template | Strong (sections + lines snapshot) | Provision EO-01 content |
| Event Inventory | Working inventory for event | Yes — via INV templates + catalog | Template + working item | Strong (D5A) | Seed INV-01/02 + catalog starters |
| Master Inventory catalog | Named sellable/useable stock | Yes — INV-CAT | Starter records | Strong (`lib/inventory`) | Seed catalog rows venues can edit |
| Client Planning | Couple checklist with verified completion | Yes — PLB-C1 | Template (playbook) | Strong (Standard Wedding already) | Provision copy on new venue; deepen deep links (questionnaire, payments, EO) |
| Venue Planning | Team checklist | Yes — PLB-V1 | Template | Strong | Same; fix `floor_plan_created` auto-complete if still unwired |
| Timeline | Reusable day-of schedule | Yes — TL-01, TL-02 | Template | Strong (DB timeline templates + apply) | Provision TL-01/02 into venue library (not only hardcoded app constants) |
| Floor Plan | Reusable room layout | Yes — FP-01 | Template | Strong (objects, dimensions, apply) | Provision dimensional starter with reception layout objects |
| Payment schedule | How venues split money across dates | Yes — PAY-DEF-* | Default configuration | Strong presets in `SCHEDULE_PRESETS` but not provisioned as venue Library content | Surface as named venue defaults / Settings preference + first-run picker already usable |
| Invoice | Charge client for the booking | Yes — as default behaviors, not fake invoice “templates” | Default configuration / working document | Strong invoice + retainer + package lines | Seed no blank “invoice template”; ensure booking/payment UX advertises presets |
| Saved Reports | One-click business views | Yes — RPT-01…04 | Saved Report | Strong (paths + date presets only) | Provision 4 saved reports using canonical paths |
| QR Campaigns | Print tracking | Optional on day one | Starter record | Exists | Do not overwhelm; offer create-from-blank; no mandatory seeded campaign |
| Smart fields | Credible personalization | Yes across docs/messages | Shared merge mechanics + domain vocabularies | D2 engine real; vocabularies small | Extend vocabularies listed in §15–§14 |

---

## 5. Complete Content

### 5.A Message Templates

**Channel:** Email  
**Tone:** Warm, polished, human, helpful, confident — never corporate, cheesy, or overly enthusiastic.  
**Tokens used in bodies:** Only tokens that either resolve today or are named in §14 as required build. Until tour/payment tokens ship, those messages use careful wording that still works with `venue_name`, `client_name`, `coordinator_name`, `event_date`, `days_until_event`, `event_name`.

#### MSG-01 — New Inquiry Response  
**Category:** `inquiry_follow_up`  
**Subject:** Thank you for reaching out to {{venue_name}}

```
Hi {{client_name}},

Thank you for your interest in {{venue_name}}. We’re glad you’re considering us for your celebration.

We’d love to learn more about your plans and walk you through the property — the light, the spaces, and how a day typically unfolds here. Reply with a few dates that work for a tour, or let us know if you’d prefer to start with a short call.

Warmly,
{{coordinator_name}}
{{venue_name}}
```

#### MSG-02 — Tour Confirmation  
**Category:** `tour`  
**Subject:** Your tour at {{venue_name}} is confirmed

```
Hi {{client_name}},

This confirms your upcoming tour of {{venue_name}}. We’re looking forward to showing you the property and answering your questions.

Please arrive a few minutes early so we can begin on time. If you need to adjust anything before then, just reply here.

See you soon,
{{coordinator_name}}
{{venue_name}}
```

**Required build:** When tour context is available at send time, append a sentence with `{{tour_datetime}}` (see §14). Until then, staff should confirm the date/time in the reply thread or calendar invite.

#### MSG-03 — Tour Reminder  
**Category:** `tour`  
**Subject:** Reminder: your tour at {{venue_name}}

```
Hi {{client_name}},

A quick reminder that your tour of {{venue_name}} is coming up. We’re looking forward to welcoming you.

If plans have changed, reply so we can reschedule. Otherwise, we’ll see you soon.

Warmly,
{{coordinator_name}}
{{venue_name}}
```

#### MSG-04 — Tour Follow-Up  
**Category:** `tour`  
**Subject:** Following up after your visit to {{venue_name}}

```
Hi {{client_name}},

It was a pleasure showing you {{venue_name}}. I hope the visit helped you picture your day here.

If you’d like next steps — availability for your preferred date, packages, or a written proposal — reply to this message and we’ll take care of it promptly.

Warmly,
{{coordinator_name}}
{{venue_name}}
```

#### MSG-05 — Proposal Follow-Up  
**Category:** `inquiry_follow_up`  
**Subject:** Checking in on your proposal from {{venue_name}}

```
Hi {{client_name}},

I wanted to check in on the proposal we shared for your celebration at {{venue_name}}.

If it would help to walk through packages, guest count, or timing together, I’m happy to. When you’re ready, reply here and we’ll move into the agreement and payment steps.

Warmly,
{{coordinator_name}}
{{venue_name}}
```

#### MSG-06 — Contract Reminder  
**Category:** `booking_confirmation`  
**Subject:** Your agreement with {{venue_name}} is ready to review

```
Hi {{client_name}},

Your venue agreement with {{venue_name}} is ready for your review and signature. When you have a quiet moment, please open the link we sent and complete signing so we can officially reserve your date.

If anything in the agreement is unclear, reply here and we’ll help before you sign.

Thank you,
{{coordinator_name}}
{{venue_name}}
```

#### MSG-07 — Final Details Reminder  
**Category:** `planning_reminder`  
**Subject:** A few final details for {{event_date}}

```
Hi {{client_name}},

Your celebration at {{venue_name}} is {{days_until_event}} days away ({{event_date}}).

Please complete any open planning items we’ve shared — especially the final details form, guest count, and day-of contacts — so our team can prepare everything smoothly.

If you’re stuck on anything, reply and we’ll walk through it together.

Warmly,
{{coordinator_name}}
{{venue_name}}
```

#### MSG-08 — Final Guest Count Reminder  
**Category:** `planning_reminder`  
**Subject:** Final guest count for {{event_date}}

```
Hi {{client_name}},

We’re preparing seating, rentals, and staffing for your day at {{venue_name}} on {{event_date}}.

Please submit your final guest count in your planning checklist when you can. An accurate number helps everything stay calm on the day.

Questions? Just reply.

Warmly,
{{coordinator_name}}
{{venue_name}}
```

#### MSG-09 — Event Week Welcome  
**Category:** `planning_reminder`  
**Subject:** We’re ready for your week at {{venue_name}}

```
Hi {{client_name}},

Your celebration is almost here — {{days_until_event}} days until {{event_date}}.

Our team is preparing {{venue_name}} for your day. If anything in your timeline, guest count, or contacts has changed, reply as soon as you can so we can update your Event Order and day-of notes.

We’re looking forward to hosting you.

Warmly,
{{coordinator_name}}
{{venue_name}}
```

#### MSG-10 — Payment Reminder  
**Category:** `payment_reminder`  
**Subject:** Payment reminder from {{venue_name}}

```
Hi {{client_name}},

This is a friendly reminder that a payment for your celebration at {{venue_name}} is coming due.

Please open your client portal to review the amount and complete payment when ready. If you’ve already paid, thank you — you can disregard this note.

Questions about timing or methods? Reply and we’ll help.

Warmly,
{{coordinator_name}}
{{venue_name}}
```

**Required build:** Prefer body line using `{{payment_label}}`, `{{payment_amount}}`, and `{{payment_due_date}}` once payment-context merge exists (§14). Until then, portal link remains the honest next step (do not invent amounts in template text).

#### MSG-11 — Post-Event Thank You  
**Category:** `post_event`  
**Subject:** Thank you from {{venue_name}}

```
Hi {{client_name}},

Thank you for celebrating with us at {{venue_name}}. It was an honor to host your day.

If you need anything as you wrap up notes with vendors or share photos, we’re here. And if you’re willing, a short review means a great deal to our independent venue.

With gratitude,
{{coordinator_name}}
{{venue_name}}
```

---

### 5.B Marketing & Sales — Packages

Prices below are **examples for structure**, not industry claims. Venues replace them immediately.

#### PKG-01 — Ceremony & Reception  
**Category:** Wedding  
**Base price (example):** 8500  

**Description:**  
Exclusive use of the property for ceremony and reception during your contracted event hours, including basic furniture setup for your contracted guest count and on-site venue coordination for the day-of timeline. Catering, bar, florals, entertainment, and specialty décor are arranged separately unless confirmed in writing on your Event Order.

**Inclusions (package items):**  
| Description | Qty | Unit |
|-------------|-----|------|
| Exclusive venue use for contracted hours | 1 | event |
| Ceremony seating setup | 1 | setup |
| Reception tables & chairs for contracted guest count | 1 | setup |
| Day-of venue coordinator | 1 | event |
| Client planning portal access | 1 | booking |

#### PKG-02 — All-Inclusive Celebration  
**Category:** Wedding  
**Base price (example):** 14500  

**Description:**  
For couples who want a clearer package boundary: ceremony and reception spaces, tables and chairs for the contracted guest count, linens for guest tables, place-setting setup labor, and venue day-of coordination. Food, beverage, specialty rentals, and entertainment still appear on your final Event Order when selected.

**Inclusions:**  
| Description | Qty | Unit |
|-------------|-----|------|
| Exclusive venue use for contracted hours | 1 | event |
| Ceremony & reception setup | 1 | setup |
| Guest table linens | 1 | set |
| Place-setting setup | 1 | set |
| Day-of venue coordinator | 1 | event |
| Preferential planning timeline | 1 | booking |

#### PKG-03 — Intimate Gathering  
**Category:** Wedding  
**Base price (example):** 4500  

**Description:**  
Designed for smaller ceremonies and celebrations (typical comfort up to ~60 guests, confirmed against your spaces). Includes ceremony or celebration space for contracted hours, essential furniture setup, and venue support for a simpler day.

**Inclusions:**  
| Description | Qty | Unit |
|-------------|-----|------|
| Exclusive use of selected spaces | 1 | event |
| Essential furniture setup | 1 | setup |
| On-site venue contact | 1 | event |

---

### 5.C Venue Guide FAQs (FAQ-01…12)

These are **example venue answers**, editable. They must not read as universal industry law.

1. **What is included with a venue rental?**  
   Your agreement and selected package outline exactly what is included — typically exclusive use of the spaces for your event hours and the furniture or services listed there. Anything not listed can be added as an option or arranged through your vendors.

2. **How many guests can you comfortably host?**  
   Comfortable capacity depends on which spaces you use and how you arrange seating. We’ll confirm the right guest count for your date during your tour and again in your agreement.

3. **Can we bring our own vendors?**  
   Yes, many couples work with preferred or outside vendors. We’ll share any requirements for insurance, load-in windows, and day-of contacts so everyone can set up smoothly.

4. **When is the final guest count due?**  
   You’ll see the due date on your planning checklist. We use that number for seating, rentals, and staffing — timely confirmation keeps the day calm.

5. **What are your payment expectations?**  
   A deposit reserves your date; remaining payments follow the schedule on your invoice and client portal. We’ll remind you before each due date.

6. **Is parking available?**  
   Parking details for guests and vendors are listed in this Venue Guide. If your guest count needs overflow parking or a shuttle, we’ll help you plan for it.

7. **What is your rain plan?**  
   We’ll walk you through indoor or covered options that fit your spaces. The plan you’ve confirmed should also appear on your Event Order.

8. **Can we hang décor or use open flame?**  
   Décor guidelines protect the property and your guests. Share your plans early; restricted items and approved alternatives are listed in venue policies.

9. **What are setup and end times?**  
   Your contracted access window covers vendor load-in, guest arrival, and load-out. The Event Order confirms exact times for your date.

10. **Is the venue accessible?**  
    We’re happy to discuss accessibility for ceremony, reception, restrooms, and parking. Tell us what your guests need so we can plan thoughtfully.

11. **Who handles food and beverage?**  
    Policies vary by venue. Your package, Event Order, or guide will say whether you use preferred caterers, in-house options, or outside catering — and any alcohol service rules you must follow under your own agreements.

12. **How do we communicate changes close to the event?**  
    Use your client portal and reply to your coordinator. Last-minute changes may affect inventory, staffing, and your Event Order — earlier is always better.

**Also seed lightly (Venue Guide sections, not FAQ cards):** short editable placeholders for Parking, Rain Plan, and Policies — empty labels invite the venue to fill property truth, with one-line examples:

- **Parking (example):** Guest parking is available on-site; overflow directions will be shared with your final timeline.  
- **Rain plan (example):** Ceremony relocates to the covered / indoor option confirmed on your Event Order.  
- **Policies (example):** Please review noise, décor, and end-time guidelines with your coordinator before your final planning meeting.

---

### 5.D Brochure — BR-01 Venue Overview

| Field | Starter value |
|-------|----------------|
| Name | Venue Overview |
| welcomeText | Welcome. We’re an independent venue created for celebrations that feel personal and carefully hosted. Whether you’re planning an intimate ceremony or a full reception, our spaces and team are here to help your day unfold with ease. |
| includePackages | true |
| includeFaqs | true |
| closingText | Ready to visit? Reach out to schedule a tour — we’d love to show you the property and talk through your date. |

**Live at render:** venue name, logo, colors, story/hero when set, active packages, FAQs.  
**Customization:** Replace welcome/closing with the venue’s voice; tighten packages and FAQs; set brand colors and logo in venue settings.

**Finished-product brochure ambition vs today:** Spaces and stated capacity are not first-class brochure blocks today. If venues need a Spaces section in the PDF (many do), that is a build item (§14) that pulls from configured venue spaces — not invented free text trapped only in welcome.

---

### 5.E Pipeline — PIPE-01 Wedding Inquiry Pipeline

| Stage name | Canonical stage | Probability |
|------------|-----------------|-------------|
| New Inquiry | inquiry | 10 |
| Tour Scheduled | tour | 25 |
| Tour Completed | tour | 40 |
| Proposal Sent | proposal | 55 |
| Contract Out | decision | 70 |
| Booked | booked | 100 |
| Lost | lost | 0 |
| Cancelled | cancelled | 0 |

Use brand green default stage color (`#5D6F5D`) unless the venue overrides. Mark template **active** on provision.

---

### 5.F Questionnaire — QST-01 Wedding Final Details

#### Finished-product requirement

A couple completing “Wedding Final Details” should answer a **complete, calm, day-of-useful form** — not a thin song list with an emergency contact bolted on.

Today’s product only toggles six optional fields (`meal_notes`, processional/recessional/first dance songs, `parent_dances`, `special_requests`) while always requiring guest count + emergency contact, and collecting timing/location/vendor notes on the questionnaire row. **That model is not adequate for the finished QST-01.** Expand the questionnaire capability (see §14), then provision this template.

#### Client-facing presentation (ordered)

**Intro**  
*Please complete these details so {{venue_name}} can prepare your day. Your answers update your venue team directly — no PDFs required.*

**Section 1 — Celebration basics**  
| # | Question | Type | Required | Notes |
|---|----------|------|----------|-------|
| 1 | Final guest count (adults + children you’re planning for) | number | Yes | Always required |
| 2 | Ceremony start time | time | Yes | |
| 3 | Ceremony location / space | short text | Yes | |
| 4 | Reception start time | time | Yes | |
| 5 | Reception location / space | short text | Yes | |

**Section 2 — Day-of contacts**  
| # | Question | Type | Required |
|---|----------|------|----------|
| 6 | Emergency contact name | short text | Yes |
| 7 | Emergency contact phone | phone | Yes |
| 8 | Day-of planner / wedding coordinator name (if not the venue) | short text | No |
| 9 | Day-of planner phone | phone | No |

**Section 3 — Food & hospitality**  
| # | Question | Type | Required |
|---|----------|------|----------|
| 10 | Meal service style (plated, buffet, stations, family-style, other) | short text | Yes |
| 11 | Meal notes (allergies, dietary counts, children’s meals, vendor meals) | long text | Yes |
| 12 | Bar / beverage notes for venue coordination | long text | No |

**Section 4 — Music & moments**  
| # | Question | Type | Required |
|---|----------|------|----------|
| 13 | Processional song | short text | No |
| 14 | Recessional song | short text | No |
| 15 | First dance song | short text | No |
| 16 | Parent / family dances | long text | No |
| 17 | Special announcements or toasts to note | long text | No |

**Section 5 — Vendors & logistics**  
| # | Question | Type | Required |
|---|----------|------|----------|
| 18 | Key vendor contacts the venue should know (photo, florist, catering, DJ/band) | long text | No |
| 19 | Setup or load-in notes | long text | No |
| 20 | Accessibility or mobility notes for guests | long text | No |

**Section 6 — Anything else**  
| # | Question | Type | Required |
|---|----------|------|----------|
| 21 | Special requests | long text | No |

**Submit confirmation:**  
*Thank you — your final details are with the {{venue_name}} team.*

#### Venue-facing result

A single reviewed record per event showing each answered field, submitted timestamp, and activity (sent / opened / submitted / reviewed / reopened) — already aligned with D5 questionnaire lifecycle.

#### Template settings (once expanded model exists)

| Setting | Value |
|---------|--------|
| Name | Wedding Final Details |
| Description | Day-of details your team needs to run the celebration — guest count, timing, contacts, meals, music, and logistics. |
| Included | All fields above |
| Required | 1–7, 10–11 |

---

### 5.G Contract — CTR-01 Wedding Venue Agreement

**Name:** Wedding Venue Agreement  
**Description:** A professional agreement structure for wedding venue rentals. Add your venue’s approved policy language before sending. This is not legal advice.

**Map smart fields to real Hello to Cheers data where the merge map supports them; bracketed lines are venue fill-ins (or extended merge fields from §14).**

```
WEDDING VENUE AGREEMENT

Document: {{contract_title}}
Agreement Date: {{today_date}}

────────────────────────────────
VENUE
────────────────────────────────
{{venue_name}}
[Venue Address]
[Venue Phone]
[Venue Email]

────────────────────────────────
CLIENT
────────────────────────────────
{{couple_name}}
Primary Contact: {{primary_contact_name}}
[Client Email]
[Client Phone]

────────────────────────────────
EVENT SUMMARY
────────────────────────────────
Event Type:   {{event_type}}
Event Date:   {{event_date}}
Guest Count:  {{guest_count}}

────────────────────────────────
SPACES & ACCESS
────────────────────────────────
Spaces Reserved:
[List contracted spaces / areas]

Access Window:
[Load-in start – event end – load-out complete]

────────────────────────────────
PACKAGE & SERVICES
────────────────────────────────
Selected Package:
[Package name]

Included Services & Items:
[Summarize inclusions. Details may also appear on the Event Order.]

────────────────────────────────
PRICING & PAYMENTS
────────────────────────────────
Fees for this booking:
[List amounts]

Payment Schedule:
[Deposit, installments, and final payment — or reference the Payment Plan in Hello to Cheers]

────────────────────────────────
POLICIES
────────────────────────────────
Use of Property
Clients and their guests will treat the property with care and follow the house rules provided by the venue.

Timeline & Access
Event hours, vendor load-in, and load-out will be confirmed in writing before the event (including on the Event Order).

Cancellation & Refund Policy
[Add your venue's approved cancellation and refund terms here.]

Insurance Requirements
[Add your venue's approved insurance requirements here.]

────────────────────────────────
VENUE-SPECIFIC TERMS
────────────────────────────────
[Add the language approved for use by your venue here.]

────────────────────────────────
SIGNATURES
────────────────────────────────
By signing, the Client confirms they have reviewed this Agreement, including the policies and any attached schedules.

VENUE REPRESENTATIVE
Signature: _______________________________
Name / Title: ____________________________
Date: {{today_date}}

CLIENT
Signature: _______________________________
Printed Name: ____________________________
Date: ___________________________________
```

**Do not provision** the current `DEFAULT_TEMPLATE_CONTENT` cancellation / insurance / arbitration clauses as the Hello to Cheers starter for new accounts.

**§14 build:** Prefer resolving venue address/phone/email, client email/phone, package name, and payment schedule summary via merge when those values exist — until then keep bracketed placeholders so staff never ship blank magical tokens.

---

### 5.H Event Order Template — EO-01 Wedding Day Operations

**Name:** Wedding Day Operations  
**Description:** A complete starting Event Order for a wedding celebration — overview lines, ceremony, cocktail, reception, timing, and operations.

**Sections and lines** (custom lines; quantities are realistic starters venues edit; unit prices $0 for process lines; modest example pricing on rental-like lines):

| Section | Description | Qty | Unit price |
|---------|-------------|-----|------------|
| Event Overview | Contracted guest count confirmation | 1 | 0 |
| Event Overview | Spaces in use this date | 1 | 0 |
| Ceremony | Ceremony seating setup | 1 | 0 |
| Ceremony | Officiant microphone / sound check | 1 | 0 |
| Ceremony | Ceremony arch / focal setup | 1 | 0 |
| Cocktail Hour | High-top tables | 6 | 35 |
| Cocktail Hour | Cocktail linens | 6 | 8 |
| Reception | Round guest tables (60") | 15 | 0 |
| Reception | Banquet chairs | 150 | 0 |
| Reception | Guest table linens | 15 | 18 |
| Reception | Place settings | 150 | 0 |
| Reception | Head table / sweetheart setup | 1 | 0 |
| Food & Beverage | Meal service window (see questionnaire) | 1 | 0 |
| Food & Beverage | Vendor meal count | 1 | 0 |
| Schedule | Ceremony start (confirmed) | 1 | 0 |
| Schedule | Cocktail hour | 1 | 0 |
| Schedule | Dinner service | 1 | 0 |
| Schedule | Dancing / reception end | 1 | 0 |
| Operations | Vendor arrival window | 1 | 0 |
| Operations | Rain plan posted for staff | 1 | 0 |
| Operations | End-of-night load-out complete | 1 | 0 |

**Workflow demonstrated:** Inventory Template → Event Inventory (finalize) → Add to Event Order → Event Order lines with inventory provenance → invoice/payment review as already designed in booking financial architecture. EO template seeds structure; inventory feeds priced stock.

---

### 5.I Inventory

#### INV-CAT — Starter Master Catalog (examples)

Seed as editable catalog items (not frozen). Hello to Cheers finished product: **49** approachable examples across Tables / Chairs / Linens / Ceremony / Reception / Tabletop / Equipment / Signage / Venue Amenities.

- `quantity_available = 0` (venue configures ownership — never invent stock counts)
- No prices (catalog has no price; Working Inventory holds unit price when billed)
- Floor-plan dimensions only where useful for furniture

See `lib/inventory/starters.ts` + `docs/hello-to-cheers-starter-inventory-implementation.md`.

#### INV-01 — Standard Wedding — Ceremony + Reception

Structural template (qty 1, `unit_price` null, included). Ceremony + reception seating/setup/tabletop/linens/signage/amenities. No invented event quantities or prices.

#### INV-02 — Standard Wedding — Reception Only

Same architecture; **ceremony items omitted** (not left empty).

**Correct form:** Venue-owned copies via `source_master_key`; Library `/library/inventory` + `/library/inventory-templates`.  
**Workflow:** Template → Working Inventory → Finalize → Add to Event Order (D5A).

---

### 5.J Planning Templates

#### PLB-C1 — Standard Wedding (Client Planning)

Provision the existing Standard Wedding Client Planning definition (`STANDARD_CLIENT_PLANNING_*`), enriched for finished-product deep links and copy:

| Milestone | Task | Offset | Verified completion | Couple lands in |
|-----------|------|--------|---------------------|-----------------|
| Booking | Sign your contract | -118 | `contract_signed` | Documents / portal contract |
| Booking | Choose your package | -115 | Manual or package selection when wired | Packages / overview |
| Planning | Complete your questionnaire | -90 | `questionnaire_submitted` | Questionnaire |
| Planning | Purchase event insurance | -60 | `document_uploaded_insurance` | Documents |
| Planning | Choose your vendors | -45 | `vendor_selected` | Vendors |
| Planning | Review your Event Order | -35 | Manual until `event_order_shared` verified path is applied | Event Order |
| Final Details | Submit your guest count | -30 | `guest_count_finalized` | Guest count flow |
| Final Details | Final payment | -30 | `final_payment_obligation_paid` | Payments |
| Final Details | Submit your seating plan | -21 | `seating_submitted` | Seating |
| Final Details | Submit your timeline | -14 | `timeline_submitted` | Timeline |
| After Your Day | Leave a review | +14 | Manual | External / link |

Add starter **description** on Review your Event Order:  
*When your venue shares your Event Order, review it carefully and reply with any corrections.*

#### PLB-V1 — Standard Wedding (Venue Planning)

Provision `STANDARD_VENUE_WORKFLOW_*` and strengthen descriptions:

| Milestone | Task | Offset | Trigger / notes |
|-----------|------|--------|-----------------|
| Booking | Send contract | -120 | Manual → documents |
| Booking | Verify deposit | -115 | `payment_received` |
| Booking | Apply client planning checklist | -114 | Manual |
| Final Details | Apply inventory template | -30 | Manual → inventory |
| Final Details | Build / refine Event Order | -28 | Manual → event order |
| Final Details | Build timeline | -21 | `timeline_created` |
| Final Details | Create floor plan | -14 | `floor_plan_created` (**must fire** when floor plan created — see §14) |
| Final Details | Confirm rentals | -14 | Vendor-owned |
| Final Details | Vendor COIs in file | -7 | `document_uploaded_insurance` |
| Wedding Day | Prepare venue | 0 | Team |
| Wedding Day | Day-of setup | 0 | Team |
| Post-Event | Send thank-you note | +3 | Use MSG-11 |

---

### 5.K Timeline Templates

#### TL-01 — Wedding Day — Classic  
Single-day template (Day 1). Minutes relative to ceremony start (0). Audiences: venue (+ couple where appropriate).

| Title | Minutes | Audience hint |
|-------|---------|---------------|
| Setup crew arrives | -360 | venue |
| Florist and décor begin setup | -300 | venue, vendors |
| Catering arrives | -240 | venue, vendors |
| Venue ready for photography | -120 | venue, couple |
| Bridal party pre-ceremony photos | -90 | couple |
| Doors open — guests arriving | -30 | venue, couple |
| Ceremony begins | 0 | venue, couple |
| Ceremony ends | 60 | venue, couple |
| Cocktail hour begins | 60 | venue, couple |
| Couple photos | 90 | couple |
| Reception opens — dinner | 120 | venue, couple |
| First dance | 150 | couple |
| Cake cutting | 210 | couple |
| Last song — event ends | 360 | venue, couple |
| Teardown begins | 360 | venue |

#### TL-02 — Wedding Day — Essentials  

| Title | Minutes |
|-------|---------|
| Setup and preparation | -180 |
| Guests begin arriving | -30 |
| Ceremony begins | 0 |
| Ceremony ends | 60 |
| Reception begins | 90 |
| Dinner service | 120 |
| Cake cutting | 180 |
| Event concludes | 240 |

*(Aligns with proven classic/essentials content already used in product timeline constants; provision as **venue-owned Library timeline templates**, not only hardcoded picker constants.)*

---

### 5.L Floor Plan Template — FP-01 Reception — Rounds (150)

| Field | Value |
|-------|-------|
| Name | Reception — Rounds (150) |
| Event type | wedding |
| Room | 60 ft × 40 ft (example; venue edits to real space) |
| Unit | feet |

**Starter objects (example layout — venue adjusts to real room):**  
- 15 × Round table objects (capacity 10 each), arranged in a rectangular grid with dance floor clear zone labeled “Dance Floor”  
- 1 × Sweetheart / head table  
- 1 × DJ / band rectangle  
- 1 × Cake table  
- 1 × Gift table  
- 2 × Bar stations  
- Ceremony chairs are **not** required on this reception template (use a second layout or blank for ceremony lawn if desired)

**Customer experience:** “Start from Reception — Rounds (150), rename it for your ballroom, resize to your real measurements, apply to an event.”

---

### 5.M Financial defaults

#### PAY-DEF-01 / 02 / 03

These already exist as system schedule presets (`SCHEDULE_PRESETS`). Finished product treats them as **first-class default configurations** every venue can rely on when creating a Payment Plan:

| ID | Label | Structure |
|----|-------|-----------|
| PAY-DEF-01 (`thirds`) | Standard Wedding — 3 Payments | Initial / Planning / Final (existing ≈33% splits, event-relative) |
| PAY-DEF-02 (`wedding_four`) | Standard Wedding — 4 Payments | Initial / Planning 1 / Planning 2 / Final (equal quarters structure) |
| PAY-DEF-03 (`custom`) | Custom Payment Schedule | Blank — venue builds lines |

Additional certified splits remain available: `fifty_fifty`, `deposit_30_70`.

**Correct form:** Default configuration (code masters + Library browse at `/library/payment-schedules` — not a separate DB template type).  
**Build:** Payment Plan create shows the three named starters prominently; amounts always derive from the linked invoice. See `docs/hello-to-cheers-starter-payment-financial-experience.md`.

#### Invoices

No provisioned “Invoice Template” document. Finished experience:

1. Create invoice from selected package(s) and add-ons (or Event Order).  
2. Create retainer invoice + deposit plan when collecting early (`createRetainer`-style flow already present).  
3. Keep Payment Plan linked 1:1 to Invoice; Needs Review when totals drift.  
4. Print/detail emphasize Amount Due Now, Paid to Date, Balance Remaining, venue branding, safe notes.

---

### 5.N Saved Reports

Only canonical report paths (`SAVED_REPORT_PATHS`). No invented metrics.

| ID | Name | Path | Date preset | Purpose |
|----|------|------|-------------|---------|
| RPT-01 | Sales Pipeline — This Quarter | `/reporting/sales` | `this_quarter` | Watch inquiry→booked movement |
| RPT-02 | Bookings — This Year | `/reporting/bookings` | `this_year` | Booked volume for the year |
| RPT-03 | Revenue — This Month | `/reporting/revenue` | `this_month` | Cash / revenue pulse |
| RPT-04 | Events Overview — This Quarter | `/reporting/events` | `this_quarter` | Operational event load |

Comparison behavior follows Reporting’s shared date-range resolver (automatic prior-period comparison labels). Saved reports store path + preset only — filters beyond that are not in the Saved Report model today; do not invent filter JSON unless Reporting gains it (§14 only if product expands Saved Reports).

---

## 6. Smart Field Matrix

### 6.1 Engine (real today)

`lib/shared-merge/tokens.ts`: replace `{{token}}`; **unknown tokens left as-is**, never blanked. Vocabularies are domain-specific via each `buildMergeData`.

### 6.2 Contract fields (`lib/contracts/constants.ts` + `merge.ts`)

| Customer-facing field | Token | Real today? | Source | Resolution |
|-----------------------|-------|-------------|--------|------------|
| Venue Name | `{{venue_name}}` | Yes | Venue | Contract create/send merge |
| Client Name | `{{couple_name}}` | Yes | Client names | Same |
| Primary Contact | `{{primary_contact_name}}` | Yes | Primary client name | Same |
| Event Date | `{{event_date}}` | Yes | Event | Long US date |
| Event Type | `{{event_type}}` | Yes | Event | Pretty label |
| Guest Count | `{{guest_count}}` | Yes | Merge context guest count | String |
| Today’s Date | `{{today_date}}` | Yes | Clock | Long US date |
| Contract Title | `{{contract_title}}` | Yes | Contract | Same |

### 6.3 Message fields (`lib/message-templates/constants.ts` + `merge.ts`)

| Customer-facing field | Token | Real today? | Source | Resolution |
|-----------------------|-------|-------------|--------|------------|
| Venue Name | `{{venue_name}}` | Yes | Venue | Scheduled send / share merge |
| Client Name | `{{client_name}}` | Yes | Client display name | Same |
| Coordinator Name | `{{coordinator_name}}` | Yes | Sender | Same |
| Event Date | `{{event_date}}` | Yes | Event | Same |
| Days Until Event | `{{days_until_event}}` | Yes | Computed | Same |
| Event Name | `{{event_name}}` | Yes (optional) | Event | Share defaults; empty string if omitted |
| Task Name | `{{task_name}}` | **Listed, not resolved** | Planning task | Left literal until task-linked send |

Preview substitutes samples via `SAMPLE_MERGE_VALUES` (not production send).

### 6.4 Brochures / EO templates / inventory templates / playbooks / floor plans / FAQs / packages

No `{{token}}` merge vocabulary in those bodies today. Personalization is live venue data, applied snapshots, or event screens.

### 6.5 Required product capabilities (desired fields — do not invent tokens in shipped content until built)

| Desired field | Why it matters | Origin | Consumers |
|---------------|----------------|--------|-----------|
| `tour_datetime` | Tour emails without manual typing | Tours / calendar | MSG-02, MSG-03 |
| `payment_label`, `payment_amount`, `payment_due_date` | Accurate payment reminders | Payment line item | MSG-10 |
| `task_name` resolution | Planning-linked reminders | Event task | planning messages |
| `venue_address`, `venue_phone`, `venue_email` | Complete agreements/letterhead | Venue | CTR-01 |
| `client_email`, `client_phone` | Contact block | Client | CTR-01 |
| `package_name`, `spaces_summary` | Honest booking summary | Event package / spaces | CTR-01, EO overview |
| `payment_schedule_summary` | Mirror portal plan in contract | Payment plan | CTR-01 |

---

## 7. Template → Working Item Matrix

| Starter | Becomes / applies to | Snapshot vs live |
|---------|----------------------|------------------|
| Message Template | Composed / scheduled message | Content copied into send |
| Contract Template | Contract | Merged/copied; contract lifecycle thereafter |
| Questionnaire Template | Event questionnaire (draft) | Snapshots included/required (+ future field defs) |
| Planning Template | Event tasks | Snapshot tasks + application record |
| Timeline Template | Event timeline entries | Snapshot on apply |
| Floor Plan Template | Event floor plan | Snapshot layout |
| Inventory Template | Event Inventory items | Snapshot |
| Event Order Template | Event Order sections/lines | Snapshot starting content |
| Package / FAQ | Invoice lines / brochure / guide | Live catalog |
| Brochure | Public share / PDF | Live packages/FAQs + editorial |
| Pipeline Template | Active pipeline stages | Copied stages |
| Payment defaults | Payment Plan installments | Generated from preset math |
| Saved Report | Opens report with preset | Relative dates re-resolve each open |

---

## 8. Collaboration Matrix

| Type | Configures | Completes as client | Finalizes |
|------|------------|---------------------|-----------|
| Messages | Venue team | Clients receive/reply | N/A |
| Contract | Venue drafts/sends | Couple signs | Venue finalize / amendment |
| Questionnaire | Venue sends | Couple submits (shared household) | Venue reviews / reopens |
| Planning (client) | Venue applies | Couple completes owned tasks | Verified domain actions |
| Planning (venue) | Venue team | N/A (internal/vendor) | Coordinator |
| Event Inventory | Venue | Couple does not edit catalog | Venue finalize |
| Event Order | Venue | Couple reviews when shared | Venue finalize (+ amended) |
| Brochure | Venue | Prospects view | On-demand PDF |
| Floor plan / timeline | Venue | Couple may view/submit where product allows | Venue |

Permissions remain Owner / Manager / Coordinator as each domain already enforces.

---

## 9. Sharing Matrix

| Type | Shared with | Mechanism |
|------|-------------|-----------|
| Contract | Couple | Sign link / portal |
| Questionnaire | Couple | Access key / portal |
| Event Order | Couple when shared | Unified share + PDF |
| Brochure | Prospects | Public `shareToken` + PDF |
| Messages | Clients / contacts | Email / SMS |
| Inventory / templates | Internal until applied | — |
| Client planning tasks | Couple | Portal |
| Floor plan / timeline | Couple when product shares them | Portal / share flows |

---

## 10. Finalization Matrix

| Type | Finalize / lock today? |
|------|-------------------------|
| Contract | Yes — send, sign, finalize, reopen, amendment |
| Questionnaire | draft → sent → submitted → reviewed; reopen |
| Event Inventory | finalize (feeds EO) |
| Event Order | open / finalized (+ amended via revision) |
| Brochure | No content lock |
| Message / planning / inventory templates | No; applied work lives on the event |
| Payment Plan | Paid line items; schedule Needs Review when invoice drifts |
| Floor plan / timeline | Event-level working state; template remains editable |

---

## 11. White-Label Matrix

| Customize | Examples |
|-----------|----------|
| Brand | Venue name, logo, colors, story, hero |
| Contact | Address, phone, email, website |
| Sellables | Package names, prices, inclusions |
| Policies | Contract placeholders, guide policies, FAQ answers |
| Operations | Inventory, EO lines, timelines, floor plans, tasks |
| Voice | All message subjects/bodies, brochure welcome/closing |

Starter content is Hello to Cheers authored. After first edit, treat as venue voice (clear “Starter” badge).

---

## 12. Provisioning Model

```
Hello to Cheers Master Starter (protected, system-owned)
        ↓ copy on venue create / first login provisioning
Independent venue-owned Library copy
        ↓ venue edits, duplicates, applies
Venue uses indefinitely
```

**Rules**

1. Masters never appear as editable rows in a venue’s Library.  
2. Venue edits never write back to masters or to other venues.  
3. Each provisioned copy stores `sourceMasterKey` (implementation detail; not customer-facing jargon) for “Get original starter again.”  
4. **Restore / re-copy:** “Add starter again” creates a **new** copy named like `Wedding Venue Agreement (Starter)` — never silent overwrite of a customized item.  
5. Existing customized venues migrating later get an opt-in “Add missing starters” that skips masters already present by `sourceMasterKey`.  
6. Editing Hello to Cheers masters (HQ) improves **future** provisions only, unless a venue explicitly re-copies.

**Customer behavior:**  
“Library already has useful examples. I tweak mine. If I make a mess, I can pull a fresh starter without losing my customized version.”

---

## 13. Current Capability Gaps

| Gap | Impact | Outcome in this pack |
|-----|--------|----------------------|
| No automated multi-domain starter provisioning on venue create | Empty Library on day one | **Build** provisioning service |
| Contract default content includes policy-like clauses | Legal safety risk | Replace with CTR-01 for new venues |
| Questionnaire limited to 6 optional fields | Inadequate final-details experience | Expand questionnaire model to QST-01 |
| Message `task_name` unresolved | Weaker planning reminders | Resolve when sending from a task |
| No tour/payment merge fields | Tour/payment emails less precise | Add merge context |
| Contract missing package/spaces/address tokens | Manual brackets remain | Extend contract merge |
| `floor_plan_created` may not auto-complete | Venue planning task never completes | Wire trigger |
| Timeline classic content exists as app constants | Not venue-owned Library templates | Provision TL-01/02 as DB templates |
| Floor plan starters not provisioned | Empty floor plan library | Seed FP-01 |
| Payment presets exist but aren’t framed as venue starter defaults | Easy to miss | Surface PAY-DEF as defaults |
| Brochure lacks spaces/capacity block | Less prospectus-complete | Optional brochure spaces section build |
| Saved reports empty on day one | Reporting feels unfinished | Seed RPT-01…04 |
| No master/re-copy UX | Hard to recover originals | Build master catalog + re-copy |

---

## 14. Required Engineering Build

### 14.1 Starter provisioning service (core)

**Customer experience:** First login / venue create → Library, Packages, Guide, Reports, and payment defaults already populated.  

**Data:** System master definitions (code fixtures and/or `system_starter_*` tables readable only by provisioning). Venue copies in existing tables with `source_master_key`, `is_starter_copy`, `starter_edited_at`.  

**Lifecycle:** Create-once on venue provision; idempotent.  

**Permissions:** System writes copies; venue edits copies via existing RLS.  

**Editing / isolation / sharing / finalization:** Unchanged domain rules on the copies.  

**Validation:** New venue has non-zero counts for each provisioned type; masters unchanged after venue edits.

### 14.2 Contract starter swap + merge extensions

- Ship CTR-01 body as default for new venues (retire assertive `DEFAULT_TEMPLATE_CONTENT` legal sections for new provisions).  
- Extend `MERGE_FIELDS` / `buildMergeData` for venue contact fields and, when event data exists, package name / spaces summary / payment schedule summary.  
- PDF/layout remains existing contracts PDF path.

### 14.3 Questionnaire expansion (finished QST-01)

**Customer experience:** Couples see sections §5.F; venues configure include/require per field (not only six hard-coded optionals).  

**Data:** Expand questionnaire field registry beyond `CONFIGURABLE_FIELDS`; migrate `event_questionnaires` / templates to store field presence + values for new keys (day-of planner, bar notes, accessibility, etc.). Keep always-required guest count + emergency contact.  

**Template model:** Template snapshots included/required field keys onto the event questionnaire (same D5D snapshot discipline).  

**Lifecycle / permissions / sharing / finalization:** Preserve D5 statuses and couple RPC validation.  

**Downstream:** Planning trigger `questionnaire_submitted` unchanged; portal completion unchanged.

### 14.4 Message merge completeness

- Provide `task_name` when sending/scheduling from an event task.  
- Provide tour datetime when message relates to a tour.  
- Provide payment label/amount/due date when reminding about a payment line.  
- Update MSG-02/03/10 bodies to use those tokens once live.

### 14.5 Planning deep links + auto-complete integrity

- Ensure client tasks for questionnaire, payments, Event Order, seating, timeline land on the owning portal/venue section (extend action types beyond today’s limited `TASK_ACTION_TYPES` where needed).  
- Wire `floor_plan_created` auto-complete from floor plan create.  
- Add PLB tasks listed in §5.J that aren’t already in constants.

### 14.6 Timeline & floor plan provisioning

- Insert TL-01/TL-02 as venue timeline templates (items with minutesOffset/dayOffset/audiences).  
- Insert FP-01 with dimensions + objects.  
- Keep hardcoded `TIMELINE_TEMPLATES` only if still useful as apply helpers — Library must show venue-owned copies.

### 14.7 Inventory + EO + catalog seed

- Seed INV-CAT, INV-01, INV-02, EO-01 into existing tables.  
- No second financial system.

### 14.8 Financial defaults surfacing

- Treat `SCHEDULE_PRESETS` as permanent starter defaults.  
- Add venue preferred preset setting.  
- Onboarding / payment create UX names PAY-DEF-01…03 explicitly.

### 14.9 Brochure spaces (recommended finished polish)

- Optional Spaces section on brochure render from venue spaces (name + capacity when available).  
- If spaces empty, omit section (no fake capacities).

### 14.10 Saved Reports seed

- Insert RPT-01…04 for the creating user / venue.  

### 14.11 Packages, FAQs, pipeline, brochure, messages, CTR, QST provision

- Content from §5.  

### 14.12 Master re-copy UX

- Library actions: “Add original starter again” per type.  
- Never overwrite customized rows.

---

## 15. Validation Requirements

### 15.1 Product / content review (before build)

- [ ] Contract safety: no invented operative legal language outside placeholders  
- [ ] Every message readable aloud as a real venue email  
- [ ] Questionnaire finished field list approved  
- [ ] Pricing examples clearly example-only  
- [ ] No Weven / VenueOS in customer-facing strings  
- [ ] Product name is Hello to Cheers throughout  

### 15.2 Provisioning acceptance (after build)

1. Create a brand-new venue → first Library visit shows all §2.1 items (or clear grouped counts).  
2. Edit a venue message → master unchanged; second new venue still gets original MSG-01.  
3. “Add starter again” duplicates without clobbering edited copy.  
4. Apply CTR-01 → contract merge fills real venue/client/event fields; placeholders remain only where venue must write policy.  
5. Apply QST-01 → couple sees full sections; cannot submit without required fields.  
6. Apply INV-02 → Event Inventory items present → finalize → add to Event Order → lines appear with inventory provenance.  
7. Apply EO-01 → sections/lines present on new Event Order.  
8. Apply PLB-C1 / PLB-V1 → tasks + relative dates + verified triggers fire on real actions.  
9. Apply TL-01 → timeline entries resolve against event start.  
10. Apply FP-01 → objects present; editable room size.  
11. PIPE-01 active → lead stages usable.  
12. Brochure public link shows packages + FAQs + branding.  
13. Create Payment Plan → PAY-DEF presets available; preferred default preselected if set.  
14. Saved Reports open correct pages with resolving relative date ranges.  
15. MSG-10 with payment context resolves amount/due date when build complete.  
16. Tour messages resolve `tour_datetime` when build complete.  
17. Mobile + desktop Library remains scannable (starter badge + groups).  

### 15.3 Final product test questions

1. Would a brand-new independent wedding venue owner be impressed by what’s already waiting?  
2. Could they use these without understanding how the software was engineered?  
3. Does this library show Hello to Cheers understands how a venue operates?  

If any answer is no, improve content or complete the named build — do not shrink the finished requirement.

---

## 16. Files Inspected (authoritative sample)

- `app/(app)/library/page.tsx`  
- `lib/shared-merge/tokens.ts`  
- `lib/contracts/{constants,merge,service,repository,types}.ts`  
- `lib/message-templates/{constants,merge,preview,service}.ts`  
- `lib/playbooks/constants.ts` (+ portal deep-link patterns in `lib/portal/unified-tasks.ts`)  
- `lib/events/questionnaire.ts`, `lib/events/questionnaire-constants.ts`, `components/form/couple-questionnaire-form.tsx`  
- `lib/questionnaire-templates/service.ts`  
- `lib/brochures/types.ts`  
- `lib/packages/types.ts`  
- `lib/event-inventory/types.ts`  
- `lib/event-order-templates/types.ts`  
- `lib/event-orders/constants.ts`  
- `lib/timeline/constants.ts`, `lib/timeline-templates/types.ts`  
- `lib/floor-plan-templates/types.ts`  
- `lib/pipeline-templates/types.ts`  
- `lib/payments/constants.ts` (SCHEDULE_PRESETS)  
- `lib/saved-reports/types.ts`, `lib/reporting/date-range.ts`  
- `lib/guide/venue-guide-data.ts`  
- Related BA/D/R docs referenced via library/reporting/inventory architecture comments  

---

## Stop

**No implementation in this phase:** no migrations, seeds, UI changes, token-engine changes, schema changes, or provisioning code.

**Next:** Product review of this content pack and §14 build list, then a precise engineering implementation brief.
