# Shared Email (Project 3 — Real Email)

One mail module for Hello to Cheers **product** email. Marketing and the Relationship Workspace import `@shared/email`. Every customer-facing send also appears on the Relationship timeline (like VenueOS messaging).

## Architecture

```
marketing / workspace
        │
        ▼
 shared/email/
   client.ts          Resend transport + dry-run
   templates/         Registry (live + stub)
   send.ts            sendRelationshipEmail → Resend + timeline
   enrollment.ts      Post-checkout welcome / founder / WB / WG
        │
        ├──► Resend (when RESEND_API_KEY + from address)
        └──► shared/relationships  email_sent + outbound communication
```

Ops team notify (CRM / inquiry alerts) uses `sendRawEmail` only — **not** timeline’d.

## Environment

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key. **Without it, sends dry-run** (console log) and still append timeline with `delivery: simulated`. |
| `EMAIL_FROM` | From address, e.g. `Hello to Cheers <hello@hellotocheers.com>` |
| `EMAIL_REPLY_TO` | Optional Reply-To |
| `FROM_EMAIL` | Back-compat alias for `EMAIL_FROM` (existing marketing ops notify) |
| `INQUIRY_NOTIFY_EMAIL` | Ops inbox for team alerts (not product welcome) |
| `NEXT_PUBLIC_MARKETING_URL` | Used in template links |

Add the same Resend vars to **marketing** and **workspace** `.env.local` if Luv / workflows should send for real.

## Dry-run vs real send

1. **No `RESEND_API_KEY`** — `sendRawEmail` / `sendRelationshipEmail` log `[email] dry-run …` and return `delivery: "simulated"`. Timeline event still created with `meta.simulated: true`.
2. **With key** — POST to Resend; timeline `meta.delivery: "sent"` + `provider_id`.

## Templates

| Id | Status | Wired now |
|----|--------|-----------|
| `welcome` | live | Checkout (non-founder) |
| `founder_welcome` | live | Checkout when Founding Member |
| `welcome_back` | live | Checkout when Welcome Back requested (acknowledgment; verify later) |
| `welcome_back_verified` | live | Project 5 — ops **Approve** on Relationship |
| `welcome_back_rejected` | live | Project 5 — ops **Reject** on Relationship |
| `kickoff` | live | White Glove checkout |
| `white_glove_scheduling` | live | White Glove checkout |
| `luv_suggestion` | live | Luv draft **Send** + workflow email steps |
| `payment_receipt` | registry | Optional companion; Stripe receipt is source of truth |
| `trial_reminder` | registry | Hook: `sendTrialReminder()` — trial not live |
| `renewal_reminder` | registry | Hook: `sendRenewalReminder()` — wire from renewal workflows later |

### Checkout email policy

- Always: Welcome **or** Founder Welcome.
- If Welcome Back requested: also Welcome Back acknowledgment.
- If White Glove: also Kickoff + Scheduling.
- Do **not** auto-send payment receipt companion (rely on Stripe).

## Timeline appearance

After a send (real or simulated), the Relationship shows:

- Timeline type `email_sent` with title like `Welcome Email Sent`
- Outbound `communication` (channel `email`) with full subject/body
- Meta: `template_id`, `delivery` (`sent` \| `simulated` \| `failed`), `provider_id`, `to`

## How to test

### Without API key (dry-run + timeline)

```bash
# marketing .env.local — leave RESEND_API_KEY unset
npm run dev:marketing   # :3001
npm run dev:workspace   # :3002

# Complete a test Stripe checkout (or call sendEnrollmentProductEmails from a smoke script)
# Then open the Relationship in workspace — expect Welcome Email Sent (simulated).
```

Or unit-style:

```bash
cd marketing
npx tsx -e "
import { sendRelationshipEmail } from '../shared/email/index.ts';
// Use a real relationshipId from shared/relationships/.data after a form submit
"
```

### With Resend

1. Set `RESEND_API_KEY`, `EMAIL_FROM`, optional `EMAIL_REPLY_TO` in marketing (and workspace for Luv).
2. Use a verified domain / Resend test recipient.
3. Checkout or Luv **Send** — inbox + timeline `delivery: sent`.

## Files

| File | Role |
|------|------|
| `client.ts` | Resend + dry-run |
| `send.ts` | `sendRelationshipEmail`, trial/renewal hooks |
| `enrollment.ts` | Post-purchase product email set |
| `templates/` | Registry + renderers |
| `index.ts` | Public exports |
