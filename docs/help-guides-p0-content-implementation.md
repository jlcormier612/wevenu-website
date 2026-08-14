# Help & Guides P0 Content — Implementation

**Status:** Implemented  
**Date:** 2026-08-13  
**Sources:** Approved implementation prompt; `docs/help-guides-p0-procedural-research.md`; `docs/help-guides-p0-category-mapping.md`

---

## Exact articles published

### Preserved (unchanged)

1. Getting Started: Your First Morning (`getting-started-your-first-morning`)
2. Creating Your First Package
3. Inviting Your First Couple to Their Portal
4. Getting Paid, On Time
5. Turning a Lead into a Signed Client
6. Getting the Most from Your Vendor Network

### New (18)

| Slug | Title | Category |
|---|---|---|
| `getting-started-what-to-set-up-before-i-start` | What should I set up before I start? | Getting Started |
| `how-does-my-pipeline-work` | How does my Pipeline work? | Finding & Booking Clients |
| `can-i-customize-my-pipeline-stages` | Can I customize my Pipeline stages? | Finding & Booking Clients |
| `what-happens-when-i-move-a-lead-into-a-stage-with-an-automation` | What happens when I move a lead into a stage with an Automation? | Finding & Booking Clients |
| `whats-the-difference-between-a-lead-and-a-client` | What's the difference between a Lead and a Client? | Finding & Booking Clients |
| `who-signs-a-contract-first-and-what-happens-after` | Who signs a contract first, and what happens after? | Contracts & Payments |
| `can-more-than-one-person-sign-a-contract` | Can more than one person sign a contract? | Contracts & Payments |
| `can-couples-pay-online` | Can couples pay online? | Contracts & Payments |
| `what-do-sent-paid-and-void-mean-on-an-invoice` | What do Sent, Paid, and Void mean on an invoice? | Contracts & Payments |
| `whats-the-difference-between-a-package-inventory-and-an-inventory-template` | What's the difference between a Package, Inventory, and an Inventory Template? | Building the Event |
| `what-do-the-floor-plan-studio-icons-mean` | What do the Floor Plan Studio icons mean? | Building the Event |
| `how-do-i-move-an-object-thats-behind-another-one` | How do I move an object that's behind another one? | Building the Event |
| `what-is-an-automation` | What is an Automation? | Finding & Booking Clients |
| `can-i-pause-an-automation-for-just-one-person` | Can I pause an Automation for just one person? | Finding & Booking Clients |
| `why-did-this-person-get-this-message` | Why did this person get this message? | Finding & Booking Clients |
| `what-happens-to-an-automation-if-someone-is-marked-lost-cancelled-or-books` | What happens to an Automation if someone is marked Lost, Cancelled, or books? | Finding & Booking Clients |
| `where-do-my-venue-colors-actually-show-up` | Where do my venue colors actually show up? | Your Venue |
| `how-do-i-start-collecting-inquiries-from-my-website` | How do I start collecting inquiries from my website? | Finding & Booking Clients |

**Published total:** 24 articles (6 pre-existing + 18 new). P0 set intended: 19 (1 existing First Morning + 18 new) plus the other 5 original Help articles remain.

---

## Categories used

Existing 12-area taxonomy only (`lib/help-guides/areas.ts` unchanged).

- Editorial label **“Planning Events”** in the prompt → canonical **`Building the Event`**
- All four Automation articles → **`Finding & Booking Clients`**
- No **Automations** category created

---

## Content source / publishing mechanism

- Store: `success_library_articles`
- Mechanism: SQL migration seed (`on conflict (slug) do nothing`)
- Rendering: existing `/help` + `/help/[slug]` Best Practice sections (`why_it_matters`, `when_to_use`, `best_practices`, `common_mistakes`, `related_features`)
- Approved prose mapped into those fields without inventing product behavior
- Stripe implementer-only footnote (“Important Stripe boundary…”) was **not** published as venue-facing content

---

## Files / migrations changed

| File | Why |
|---|---|
| `supabase/migrations/20261288000000_help_guides_p0_content.sql` | Publish 18 approved articles |
| `docs/qa/help-guides-p0-content/smoke.mjs` | Browser validation |
| `docs/qa/help-guides-p0-content/results.json` | Smoke results |
| `docs/qa/help-guides-p0-content/help-home.png` | Home screenshot |
| `docs/help-guides-p0-content-implementation.md` | This report |

No application code, taxonomy, Help UI, navigation, Pipeline, Automation, Stripe, Contracts, branding, or Library changes.

---

## Validation results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Pass |
| `npm test` | **538 / 538** pass |
| Browser smoke | **57 / 57** pass (`docs/qa/help-guides-p0-content/`) |

Browser confirmed:

- All 12 Help areas remain; no Automations category
- All 18 new articles open with titles + back link
- Automation articles under Finding & Booking Clients
- First Morning unchanged
- Five original articles still present
- Stripe article: Connect with Stripe; screens may differ; never paste credentials; no invented fixed Stripe screen path

---

## Unrelated environment issue (not product)

Local Next.js on `:3000` initially returned **500** due to corrupted `node_modules/tar-stream/package.json`. Reinstalled `tar-stream` and restarted the venue app so browser validation could run. Not a Help-content defect; not committed as a product change.

---

## Explicit confirmation — out of scope unchanged

Did **not** change: left navigation, Library IA, Pipeline architecture/colors/LeadStatus, Automation engine/triggers/exits/editor, Stripe OAuth/payments, Contracts signing, branding, Couple Portal / Hosted / RSVP, Luv, Dashboard, Help search/relatedness/contextual help, Help taxonomy (`areas.ts`), Help UI redesign.

---

## Commit / push

**No commit. No push.**
