# Meadowbrook Valley Venue missing from venue switcher — forensic

**Audit type:** Read-only. No purchases, activations, memberships, active-venue changes, refunds, or deploys.  
**Observation window (UTC):** 2026-10-11T19:27:09Z – 2026-10-11T19:29:00Z  
**Dirty working tree:** preserved.

---

## Root-cause verdict

**CONFIRMED — VENUE EXISTS; MEMBERSHIP BELONGS TO A DIFFERENT AUTH IDENTITY THAN THE SESSION IN THE SCREENSHOT**

| Layer | Result |
|---|---|
| Environment | **Sandbox** (Stripe `livemode=false` / `cs_test_…`; Supabase `wvpsldwwjqdannqasrdf`) |
| Purchase | **Paid + complete** |
| Venue created | **Yes** — `Meadowbrook Valley Venue` |
| Activation / owner membership | **Yes** — for `jlcormier612@gmail.com` |
| Visible in `jennifer@hellotocheers.com` switcher | **No — correctly excluded** (no `venue_staff` row for that auth user) |
| Switcher / `B_keep_valid` defect | **Ruled out** for this symptom |
| Duplicate venue | **None** for this name |

This is **not** “purchase failed” and **not** “switcher UI dropped a membership.” The purchaser identity on checkout is **`jlcormier612@gmail.com`**. The screenshot session is **`jennifer@hellotocheers.com`**. Those are two different Supabase Auth users.

---

## Phase 1 — Environments

| Surface | Evidence |
|---|---|
| Venue app | `https://app.sandbox.hellotocheers.com` · `dpl=f276f919886b6ebb744b769138deb7cf94669009` · `/api/health` ok |
| Supabase | Sandbox project `wvpsldwwjqdannqasrdf` (matches app + enrollment rows) |
| Stripe | Sandbox SaaS secret `htc/sandbox/stripe-saas` · **test mode** (`sk_test…`) |
| Checkout session | `cs_test_b19KKqYvN4iOs6GAAh2danhEWNAIFKiOIF0sKMjBTc2zDp9PyTR0LkM2nK` · `livemode=false` |
| Marketing | Public site on Vercel; Sandbox marketing ECS service ACTIVE (`htc-sandbox-marketing:630`). Checkout used **test** Stripe → processed against Sandbox provisioning. |
| Production app | Not deployed / not wired (prior audits); this purchase is **not** a Production-only orphan |

Checkout and app data for this venue are the **same Sandbox Supabase project**. No cross-environment handoff miss.

---

## Phase 2 — Purchase chain (Meadowbrook)

| Step | Status | Redacted evidence |
|---|---|---|
| Checkout session | complete | `cs_test_b19KKqYv…` created **2026-10-11T19:10:06Z** |
| Payment | paid | `payment_status=paid`, mode `subscription`, amount **19900** USD |
| Customer email | **`jlcormier612@gmail.com`** | Stripe `customer_details.email` |
| Metadata venue | `Meadowbrook Valley Venue` | Stripe metadata |
| Plan | Celebrate / growing (founder price mode) | `htc_plan=growing`, `pricing_mode=plan_founder_price`, `founding_member=true` |
| Onboarding | self_guided | metadata + enrollment `self_setup` |
| Customer / subscription | created | `cus_VQIkgmZdeRFsVZ` / `sub_1UPS9IErUqJH7nktQZYOJRSi` |
| Enrollment | created → **activated** | `dd706eb8-4475-48df-a58d-912cd06b1c60` · created 19:11:17Z · status `activated` · `purchaser_is_owner=true` |
| Welcome email marker | set | `welcome_email_sent_at=19:11:36Z` (transport claimed; inbox not verified here) |
| Venue row | created | `05f16a15-1752-4855-8a3b-aad5c593d8d9` · 19:11:19Z · `owner_user_id=6721694e-…` · `account_status=active` |
| Owner membership | created | `venue_staff` owner / `is_owner=true` / `is_active=true` · 19:22:38Z · email `jlcormier612@gmail.com` |
| Onboarding handoff | created, **unconsumed** | user `6721694e-…` · expires 2026-10-12T19:22:39Z · **not** Jennifer Fancy auth id |

**Duplicate search:** one venue named Meadowbrook Valley Venue; one enrollment for that venue/session; one owner staff row.

---

## Phase 3 — Identity / ownership / membership

| Identity | Auth user id | Role for Meadowbrook |
|---|---|---|
| Checkout purchaser | `6721694e-3f38-45e6-9afa-383ba1fd7564` · `jlcormier612@gmail.com` | **Owner** (`venue_staff` present) |
| Screenshot session | `2fa73101-337b-4530-8c77-f3c272c5463e` · `jennifer@hellotocheers.com` | **None** |

`jennifer@hellotocheers.com` memberships (exact switcher source):

| Venue | Role |
|---|---|
| Jen's Fancy Venue (`a415ac52-…`) | Owner |
| Sweet Daisy Barn & Farm (`5c84e74e-…`) | Manager |
| Texting E2E Disposable 1790024905116 (`31ea4816-…`) | Owner |

That list **matches the reported switcher** (Fancy Owner, Sweet Daisy Manager, Texting E2E Disposable Owner). Meadowbrook is absent because it is not in this set.

`jlcormier612@gmail.com` memberships **do** include Meadowbrook (Owner), plus Sally Sunshine (Owner), Lulu's Lakeview Lodge (Manager), Juniper Valley Farm (Manager).

---

## Phase 4 — Venue switcher path

Persistent switcher lists **accepted `venue_staff` memberships for the signed-in auth user** (`offersPersistentVenueSwitch` / membership loaders; authorization still via `set_active_venue`).

| Check | Result |
|---|---|
| Backend would return Meadowbrook for Jennifer? | **No** — no staff row |
| Backend returns Meadowbrook for purchaser? | **Yes** |
| Hidden by stale client cache? | **No evidence**; DB membership set already excludes it |
| `B_keep_valid` hiding a membership? | **No** — that path preserves *active venue among existing memberships*; it cannot invent a membership on another auth user |
| Unconsumed handoff for Jennifer? | **No** — handoff `user_id` is purchaser only |

---

## Phase 5 — Historical pattern (not the same bug)

Prior work (`launch-blocker-2-active-venue-identity`, `same-email-second-venue-purchase`, K2) covered:

- Membership deferred until activation  
- `B_keep_valid` keeping a *prior* venue active after second-venue purchase for the **same** auth user  
- Success-page race when enrollment lookup lagged  

**This incident differs:** activation **did** run (`status=activated`, `purchaser_is_owner=true`, staff row present). The gap is **which auth account** owns that membership vs which account is open in the browser.

Related human factor: purchaser name on Stripe metadata is “Jennifer Cormier”, but email is Gmail — easy to assume Fancy login should see the venue.

Deployed Sandbox revision `f276f919…` contains prior multi-venue / handoff lineage; nothing in this audit indicates the switcher dropped a Jennifer membership that exists in DB.

---

## Phase 6 — Preserve purchase

Do **not** re-purchase, refund, merge venues, or attach Meadowbrook to `jennifer@hellotocheers.com` without a separate product/authorization decision.

Preserve:

- Venue `05f16a15-1752-4855-8a3b-aad5c593d8d9`
- Enrollment `dd706eb8-4475-48df-a58d-912cd06b1c60`
- Checkout `cs_test_b19KKqYv…` / sub `sub_1UPS9IErUqJH7nktQZYOJRSi`
- Staff + unconsumed handoff on purchaser auth user

---

## Phase 7 — Classification (contract options)

Closest accurate label:

**CONFIRMED — VENUE EXISTS BUT MEMBERSHIP/OWNERSHIP IS ON THE PURCHASER AUTH USER (`jlcormier612@gmail.com`), NOT ON THE SCREENSHOT SESSION (`jennifer@hellotocheers.com`)**

Not applicable: venue not created; switcher query bug; Production orphan; failed payment.

---

## What the customer should do (operational, not implemented here)

1. Sign into the venue app as **`jlcormier612@gmail.com`** (the checkout email).  
2. Meadowbrook should appear in that account’s switcher; unconsumed onboarding handoff may still target that user until expiry.  
3. If the business intent was ownership under Fancy (`jennifer@hellotocheers.com`), that is a **separate** ownership-transfer / invite flow — not a switcher repair.

---

## Safety

- No checkout, payment, refund, activation retry, membership write, or active-venue change.  
- No Production / marketing code changes.  
- No secrets or full payment instruments in this report.  
- Stripe accessed read-only via existing Sandbox secret; key material not printed.
