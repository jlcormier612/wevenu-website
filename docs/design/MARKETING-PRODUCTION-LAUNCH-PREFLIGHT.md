# HTC — Marketing Production Launch Preflight

**Updated:** 2026-11-10 (America/New_York) — Final marketing release commit prepared (no Production deploy)  
**Mode:** Marketing-only release candidate committed · Preview authorized by existing workflow · **Production deploy HARD STOP**  
**Recommendation:** **CONDITIONAL GO** — awaiting Production Vercel env corrections + your explicit deploy approval

---

## 0. Executive verdict

| Layer | Verdict |
|---|---|
| Calendly Sandbox → CRM | **CLOSED / GREEN** (unchanged) |
| Sandbox marketing serving | **`f22b8c14…`** / ECS `:1142` |
| CTA/footer/nav (`02157600`) | Confirmed in ancestry |
| Marketing release commit | **Prepared** (see §2) |
| Build / focused tests | **PASS** |
| Production Vercel env | **Gaps remain** (Calendly URL, Resend/email, site URL) |
| Production deploy | **NOT DONE** |

---

## 1. Release candidate

| Item | Value |
|---|---|
| Branch | `feat/spaces-booking-e1-smart-fields` |
| Sandbox serving | `f22b8c14…` (no newer approved Sandbox marketing deploy) |
| Baseline ancestry | Includes homepage/product/features/Our Story + `02157600` CTA/footer/nav + Calendly fail-closed |
| Release commit | *(filled at commit time — see §2)* |

### Included (approved launch work)

- OG 1200×630 hospitality share image + root/homepage metadata
- Contact + walkthrough experiences, Calendly embed URL resolver, inquiry spam/idempotency hardening
- Pricing / Trust / Our Story CTA destination polish; Launch Yourself / White Glove checkout paths
- Minimal shared pricing helpers required by dirty marketing Stripe webhook (`founding-lifecycle`, `group-anchor` + index exports)
- This preflight update

### Excluded (remain dirty / unfinished / unrelated)

- `marketing/app/features/showroom-preview/**` and preview components (`feature-explorer`, showroom/spotlights preview)
- Extra untracked showroom/homepage asset dumps not required by committed Features page
- Dirty `shared/pricing/offer-store*`, `group-fulfillment`, `resolve-checkout`, `weven-phase2` (not required for this commit)
- Dirty `shared/email/**`
- Venue app, workspace, QA docs, infra-only work

---

## 2. Marketing-only release commit

*(SHA and file list recorded after `git commit` in this session — see chat report §1–2.)*

Deploy assemble path continues to upload **`marketing` + `shared` only** via `hello-to-cheers` Vercel project.

---

## 3. Production Vercel configuration (`hello-to-cheers`)

Inspected Production env keys (values not printed for secrets).

| Variable | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_CALENDLY_URL` | **MISSING** | Reuse Sandbox GitHub var: `https://calendly.com/jennifer-hellotocheers/new-meeting` |
| `RESEND_API_KEY` | **MISSING** | Reuse Sandbox ECS secret `RESEND_API_KEY` (same Resend account / HTC domain) — copy via Vercel UI or CLI; do not paste into chat |
| `INQUIRY_NOTIFY_EMAIL` | **MISSING** | Sandbox uses `jennifer@hellotocheers.com` (ops). Recommend same or `hello@hellotocheers.com` |
| `EMAIL_FROM` | **MISSING** | Sandbox: `Hello to Cheers <jennifer@hellotocheers.com>`. Brand template in `.env.example`: `Hello to Cheers <hello@hellotocheers.com>` — confirm preferred Production identity |
| `EMAIL_REPLY_TO` | **MISSING** | Align with From identity (`jennifer@…` or `hello@…`) |
| `NEXT_PUBLIC_SITE_URL` | **PRESENT — WRONG VALUE** | Currently `https://hello-to-cheers.vercel.app` — must be `https://hellotocheers.com` for OG absolute URLs |
| `NEXT_PUBLIC_MARKETING_URL` | **PRESENT — WRONG VALUE** | Same vercel.app host — must be `https://hellotocheers.com` |
| Stripe Price / coupon / secret keys | **PRESENT** | Do not rotate. `STRIPE_PRICE_STARTER_FOUNDER` absent (OK — Launch V1 uses coupon path) |
| `CALENDLY_WEBHOOK_SIGNING_KEY` | **MISSING** | **NON-BLOCKER** for launch (no Production CRM). Optional later |
| `FOUNDER_PROGRAM_ACTIVE` / `FOUNDER_SPOTS_REMAINING` | **PRESENT** | — |

**Manual actions required (you):** set/correct the missing and wrong-value rows above in Vercel → Project → Settings → Environment Variables → Production (and Preview if desired). Do not change Stripe secrets.

Suggested CLI pattern (run locally; do not paste secret into chat):

```bash
# Public corrections
printf '%s' 'https://hellotocheers.com' | vercel env add NEXT_PUBLIC_SITE_URL production
printf '%s' 'https://hellotocheers.com' | vercel env add NEXT_PUBLIC_MARKETING_URL production
printf '%s' 'https://calendly.com/jennifer-hellotocheers/new-meeting' | vercel env add NEXT_PUBLIC_CALENDLY_URL production

# Secrets: pull from Sandbox SM / ECS or Resend dashboard, then:
# vercel env add RESEND_API_KEY production
# vercel env add EMAIL_FROM production
# vercel env add EMAIL_REPLY_TO production
# vercel env add INQUIRY_NOTIFY_EMAIL production
```

If a key already exists with wrong value, remove/replace via Vercel UI (agent will not overwrite without explicit approval).

---

## 4. Validation (this pass)

| Check | Result |
|---|---|
| `marketing` `next build` | **PASS** (TypeScript + 58 routes) |
| Focused marketing unit tests (Calendly URL, contact/walkthrough copy, pricing, spam, checkout-pricing, webhook-auth) | **PASS** |
| founding-lifecycle / group-anchor tests | **PASS** |
| Contact hardening orchestration test | **PASS** |
| Production dependency on venue app/CRM | **None required** for browse/book/contact; checkout may dry-run product sync without `PRODUCT_API_BASE_URL` |

---

## 5. Deployment plan (Production HARD STOP)

### Preview (authorized by existing workflow)

```bash
node marketing/scripts/deploy-marketing-preview.mjs <RELEASE_SHA>
```

Assembles commit `marketing`+`shared`, deploys **Preview only** (refuses `--prod`).

### Production (requires your explicit later approval)

1. Confirm env §3 complete.  
2. Prefer: promote the verified Preview in Vercel Dashboard → Deployments → Promote to Production.  
3. Or authorized one-time Production deploy using the same assemble rules with `--prod` (not in the preview script).  

### Rollback

Promote prior Production deployment `dpl_HWJ57SLX5sQkM81CXzNibfXxpMiN` (git `de27f6e1…`).

### Post-deploy smoke (after you approve Production)

`/`, `/product`, `/features`, `/pricing`, `/our-story`, `/walkthrough` (Calendly iframe), `/contact`, `/getting-started`, legal footer, mobile nav, view-source `og:image` absolute URL, Facebook/LinkedIn debugger scrape.

---

## 6. Calendly Sandbox (CLOSED)

No changes. Subscription `2fc29a30-…` remains active.

---

## 7. Verdict

**CONDITIONAL GO** — release commit ready; Production blocked only on env corrections + your deploy authorization.
