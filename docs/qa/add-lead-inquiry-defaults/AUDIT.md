# Add Lead — Inquiry date default + Message/notes audit

## 1. Inquiry date defaults to tomorrow

**Root cause:** `createInitialLeadInput()` in `lib/leads/constants.ts` set:

```ts
inquiryDate: new Date().toISOString().slice(0, 10)
```

`toISOString()` is always UTC. After ~20:00 America/New_York (or ~21:00 America/Moncton), UTC has already rolled to the next calendar day, so the date input shows tomorrow while the venue is still on “today.”

Observed: on 2026-09-22 the form showed `09/23/2026`.

**Persisted meaning:** `leads.inquiry_date` (date-only calendar day) — unchanged. Only the default source must use venue-local today via `venueToday(timezone)`.

## 2. “Message / notes” field

| Question | Answer |
|----------|--------|
| Form field | `inquiryMessage` |
| DB | `leads.inquiry_message` (text, nullable) |
| Write path | `createLeadAction` → `createLead` → `create_lead_atomic` / repository payload `inquiryMessage` |
| Conversation/message? | **No** — does not create `conversation_messages` |
| Internal note? | **No** — does not write `lead_notes` / Notes tab |
| Where it appears | Lead Overview → **Inquiry details** → labeled “Message” |
| Product intent | Customer/inquiry-provided context at first contact — separate from Internal notes |

Ambiguous label “Message / notes” caused the field to look like Notes; it never belonged to the Internal notes system.
