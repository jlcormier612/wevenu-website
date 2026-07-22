# Shared Relationship Store

One venue relationship, one timeline, one source of truth — shared by the **marketing** site and the **Relationship Workspace**.

## Architecture

```
marketing (writes)  ──┐
                      ├──► shared/relationships/.data/*.jsonl
workspace (reads)   ──┘
```

Both Next apps import `@shared/relationships` (via tsconfig paths). Data lives on disk under `shared/relationships/.data/` (or `RELATIONSHIPS_DATA_PATH`).

### Deduplication

`findOrCreateRelationship` / ingest helpers match (in order):

1. **Primary contact email** (case-insensitive) — strongest signal
2. **Stripe customer id**, **subscription id**, or **checkout session id** — links Pricing checkout-start drafts → purchase / lifecycle
3. **Normalized venue name** — only when emails are compatible (empty or equal)

If an email matches an existing relationship with a different venue name, the email match wins. Venue name / owner fields are only filled when empty. **Never create a second record for the same email.**

Checkout-start may create a **session-id draft** before Stripe collects email. On purchase, any draft sharing that session/customer id is **absorbed** into the email-matched Relationship (timeline moved, draft deleted).

### Never overwrite (merge)

Field patches **merge**; they do not wipe stronger data:

| Field | Rule |
|-------|------|
| Status | `promoteStatus` — only advances (Support overlays customers only) |
| Plan / onboarding | Rank upward only (`none` → Gather → …; self-guided → White Glove) |
| Founding / Welcome Back requested | Ratchet **true-only** |
| Welcome Back verified | `none` → `pending` → verified/rejected (never downgrade to `none`) |
| Venue / owner / referral | Fill empties only |
| Timeline | Always **append** |

### Append-only timeline

Every marketing event appends a `TimelineEvent` (and usually a `Communication`). Subscriptions, walkthroughs, notifications, and Relationship **tasks** are written alongside when relevant.

### Project 6 — White Glove Implementation Checklist

When a Relationship has `onboardingType === white_glove`, the shared helper creates **eight Tasks** on that Relationship (not a separate CRM module):

1. Venue branding  
2. Packages  
3. Contracts  
4. Questionnaires  
5. Email templates  
6. Website review  
7. Launch review  
8. Go Live  

**When it fires (idempotent):**

- After `ingestSubscriptionPurchased` if the Relationship is White Glove (including when checkout already ratcheted WG and purchase payload is self-guided)
- After `ingestSubscriptionLifecycle` if the Relationship is White Glove
- After `updateRelationshipFields` when onboarding becomes / stays White Glove
- Workspace page load backfill (`/onboarding`, `/tasks`, Relationship detail) for any live WG venue missing the checklist

Default task owner: **Eli Torres** (`tm_eli`, Implementation). Marker: `meta.checklist = white_glove_implementation`. Re-ingest does not duplicate titles already present.

Completing a task (workspace **Complete**) sets status + appends timeline `task_completed`.

### Project 10 — Product Sync

After a successful Stripe purchase → Relationship upsert, `enqueueProductSync` runs the idempotent pipeline (Venue → Workspace → Website → Subscription → Owner Account → Onboarding → Launch). State lives on `relationship.productSync`; timeline gets `product_sync_*` events. Provisioning of real Supabase venues is **simulated** via `shared/product-sync` adapters until a product internal API exists. See `shared/product-sync/README.md`.

### Wired entry points

| Source | Ingest |
|--------|--------|
| Contact form | `ingestContactForm` |
| Schedule Walkthrough | `ingestWalkthroughRequest` |
| Calendly invitee.created / canceled | `ingestWalkthroughRequest` (with `scheduledAt`) / `ingestWalkthroughCanceled` |
| Manual Add Relationship (workspace) | `ingestManualRelationship` |
| Manual Log Walkthrough (workspace) | `ingestWalkthroughRequest` + `setWalkthroughStatus` |
| Pricing checkout start | `ingestCheckoutStarted` (session-id draft OK without email) |
| Stripe purchase (incl. Founder) | `ingestSubscriptionPurchased` |
| Stripe subscription updated / cancelled | `ingestSubscriptionLifecycle` |
| Welcome Back form + checkout checkbox | `ingestWelcomeBackRequest` / purchase path |
| Newsletter / Support | also wired (same store) |

## Stripe (Project 2) — test mode + CLI

Marketing webhook: `POST /api/stripe/webhook` (marketing app, default `:3001`).

### Env (marketing `.env.local`)

| Variable | Purpose |
|----------|---------|
| `STRIPE_SECRET_KEY` | Test-mode secret (`sk_test_…`) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe CLI (`whsec_…`) or Dashboard endpoint |
| `STRIPE_PRICE_*` | Plan + White Glove price IDs (test mode) |
| `RELATIONSHIPS_DATA_PATH` | Shared store path (same as workspace) |

### Forward webhooks locally

```bash
# Terminal A — marketing app
npm run dev:marketing

# Terminal B — Stripe CLI (install: https://stripe.com/docs/stripe-cli)
stripe login
stripe listen --forward-to localhost:3001/api/stripe/webhook
# Copy the printed whsec_… into STRIPE_WEBHOOK_SECRET, restart marketing if needed
```

### Happy path

1. Open http://localhost:3001/pricing → Get Started (optional Welcome Back + White Glove).
2. Pay with test card `4242 4242 4242 4242`.
3. Confirm webhook logs `checkout.session.completed → venue enrollment` with `mrrCents`.
4. In workspace (`:3002`), open the Relationship — expect:
   - plan, foundingMember, welcomeBack*, onboardingType
   - `stripeCustomerId` / `stripeSubscriptionId`
   - Subscription row with real MRR (from Stripe Price; estimate fallback only if price missing)
   - Timeline: Checkout started → Founder/Subscription Purchased → White Glove Selected / Welcome Back / Founding Member as applicable
   - Timeline: Welcome Email Sent (or Founder Welcome) — simulated without `RESEND_API_KEY`, real with Resend
   - If Welcome Back / White Glove: additional `email_sent` rows (acknowledgment / kickoff / scheduling)
   - If White Glove: Implementation Checklist tasks (8) on the Relationship + timeline “Implementation Checklist created”
5. Ops CRM notify via Resend is team-only and is not timeline’d.

### Lifecycle

```bash
# After a real test subscription exists (sub_… from Dashboard or CLI):
stripe subscriptions update sub_… --cancel-at-period-end=true
# or cancel immediately:
stripe subscriptions cancel sub_…

# Expect: Relationship status → former_customer, subscription status → cancelled,
# timeline: "Subscription cancelled". Still one Relationship (no duplicate).
```

Triggerable events to have enabled for the endpoint (CLI listen forwards all; Dashboard should include at least):

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### Unit-style smoke (no Stripe)

```bash
RELATIONSHIPS_DATA_PATH=./shared/relationships/.smoke-data npx tsx shared/relationships/_smoke.mts
```

### Email smoke (Project 3, no Resend key)

```bash
npx tsx shared/email/_smoke.mts
# Expect dry-run logs + timeline email_sent rows, then SMOKE OK
```

## Environment

| Variable | App | Purpose |
|----------|-----|---------|
| `RELATIONSHIPS_DATA_PATH` | marketing + workspace | Absolute/relative path to the `.data` directory. Defaults to `<repo>/shared/relationships/.data`. |
| `USE_SEED_DATA` | workspace | When `false`, workspace never falls back to Phase 1 seed venues. Default: use seed **only when the live store has zero relationships**. |
| `FOUNDER_PROGRAM_CAPACITY` | marketing + workspace | Total founder seats (default 100). Remaining = capacity − founding count. |
| `FOUNDER_SPOTS_REMAINING` | marketing | Fallback remaining when live store is empty (see `founder-program.ts`). |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | marketing | SaaS billing webhook (see Stripe section above) |
| `NEXT_PUBLIC_CALENDLY_URL` | marketing | Public Calendly event URL for `/walkthrough` embed |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | marketing | HMAC key from Calendly webhook subscription |
| `CALENDLY_WEBHOOK_SHARED_SECRET` | marketing | Optional fallback: require `x-calendly-webhook-secret` header |
| `RESEND_API_KEY` / `EMAIL_FROM` / `EMAIL_REPLY_TO` | marketing + workspace | Product email (Project 3). See [`../email/README.md`](../email/README.md). |

## Calendly walkthroughs (Jennifer)

Marketing page: http://localhost:3001/walkthrough

### Env (marketing `.env.local`)

```bash
NEXT_PUBLIC_CALENDLY_URL=https://calendly.com/your-org/walkthrough
CALENDLY_WEBHOOK_SIGNING_KEY=   # from Calendly when you create the webhook
# Optional if signing key unset:
# CALENDLY_WEBHOOK_SHARED_SECRET=some-shared-value
```

### Calendly setup steps

1. Create a Calendly **event type** for the product walkthrough (e.g. “Hello to Cheers Walkthrough”).
2. Add a custom question for **Venue name** (optional but recommended — mapped into the Relationship).
3. Copy the event link into `NEXT_PUBLIC_CALENDLY_URL`.
4. In [Calendly Developer](https://developer.calendly.com/) → Webhooks, create a subscription:
   - **URL:** `https://<marketing-host>/api/calendly/webhook`  
     Local: use a tunnel (ngrok / Cloudflare) → `https://….ngrok.io/api/calendly/webhook`
   - **Events:** `invitee.created`, `invitee.canceled`
   - **Scope:** user or organization
5. Save the **signing key** returned once → `CALENDLY_WEBHOOK_SIGNING_KEY`.
6. Book a test slot → workspace Relationship should show status **Walkthrough Scheduled**, real `scheduledAt`, timeline “Walkthrough scheduled”.
7. Cancel in Calendly → walkthrough status **cancelled** + timeline “Walkthrough cancelled”.

Without `NEXT_PUBLIC_CALENDLY_URL`, `/walkthrough` shows “Scheduling link coming soon” plus the email lead form. With Calendly set, the embed is primary and an optional “Prefer email? Contact us” form remains.

### Manual entry (workspace)

| Action | Where | Permission |
|--------|--------|------------|
| **Add Relationship** | `/relationships` (header) | `edit_relationships` (Owner, Admin, Sales, CS) |
| **Log Walkthrough** | `/walkthroughs` (header) and `/relationships/[id]` | `manage_walkthroughs` (Owner, Admin, Sales) |
| Complete / Reschedule / Cancel | `/walkthroughs` row actions | `manage_walkthroughs` |

Email-first dedupe applies — re-adding the same email merges into one Relationship and appends timeline.

Add the same `RELATIONSHIPS_DATA_PATH` to both apps’ `.env.local` if you need a custom location.

## Project 3 — Real Email

Customer product email lives in [`../email/`](../email/). After `ingestSubscriptionPurchased`, marketing calls `sendEnrollmentProductEmails` which:

1. Sends via Resend when configured (otherwise dry-run console)
2. Always appends timeline `email_sent` + outbound communication

Luv **Send** and workflow email steps use the same `sendRelationshipEmail` helper.

## Local verification (Jennifer)

1. Start both apps (separate terminals):

```bash
npm run dev:marketing   # :3001
npm run dev:workspace   # :3002
```

2. **Contact** — http://localhost:3001/contact  
   Submit with a unique email (e.g. `jen-test@example.com`).  
   Open http://localhost:3002/relationships — one Relationship, timeline: Contact form submitted.

3. **Same email again** — submit Walkthrough at http://localhost:3001/walkthrough with the **same email**.  
   Still **one** Relationship; timeline has Contact + Walkthrough (no duplicate row).

4. **Welcome Back form** — http://localhost:3001/welcome-back with the same email.  
   `welcomeBackRequested` true, verified `pending`, timeline appends Welcome Back requested.

5. **Verify Welcome Back (Project 5)** — http://localhost:3002/relationships/[id] as Owner / Admin / CS.  
   When pending, Approve | Reject | Needs Follow Up appear on the Relationship (not a separate queue).  
   - Approve → `verified` + `foundingMember`, timeline “Welcome Back Approved”, email `welcome_back_verified`  
   - Reject → `rejected`, timeline + `welcome_back_rejected` email  
   - Needs Follow Up → stays pending, timeline + Task  
   Founder Dashboard `/founding` counts update; pending tile links to the list filter.

6. **Pricing checkout** — http://localhost:3001/pricing → Get Started (optional Welcome Back checkbox + White Glove).  
   After session create, a draft appears (or merges) with Checkout started.  
   Complete Stripe test checkout (webhook → `ingestSubscriptionPurchased`). Confirm:
   - Still one Relationship (email / session id merge)
   - Plan, founding, Stripe ids filled
   - Timeline: Founder Subscription Purchased (if founder active), White Glove Selected, Welcome Back requested as applicable
   - Existing Welcome Back / plan not wiped
   - If White Glove: 8 Implementation Checklist tasks owned by Eli; `/onboarding` and `/tasks` list them; Complete appends timeline

7. Inspect the store:

```bash
ls shared/relationships/.data/
# One line per relationship — count should not grow on repeat same-email submits
wc -l shared/relationships/.data/relationships.jsonl
wc -l shared/relationships/.data/tasks.jsonl
rg '"type":' shared/relationships/.data/timeline-events.jsonl | tail
```

## Files

| File | Role |
|------|------|
| `types.ts` | Shared model (aligned with workspace) |
| `normalize.ts` | Email / venue / plan mapping |
| `store.ts` | JSONL load/save + lock |
| `service.ts` | `findOrCreate`, `appendTimelineEvent`, `completeRelationshipTask`, `setRelationshipStatus`, `resolveWelcomeBackVerification`, `mutateRelationship` |
| `ingest.ts` | Marketing event → relationship mappers |
| `white-glove-checklist.ts` | Project 6 — idempotent Implementation Checklist tasks |
| `paths.ts` | Data directory resolution |
