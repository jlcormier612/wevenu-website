# HTC — Local-as-Truth Marketing Restoration

**Date:** 2026-11-10 (America/New_York)  
**Mode:** Local is source of truth · Preview-only redeploy · **No Production / Sandbox deploy**

---

## 1. Is the approved local website intact?

**YES — for marketing page source.**

| Check | Result |
|---|---|
| Working directory | `/Users/jensmac/Developer/wevenu-website` |
| Branch | `feat/spaces-booking-e1-smart-fields` |
| HEAD | `b9741d59` (docs-only after marketing tip) |
| Marketing tip (code) | `f70b03be6212b87cf2e113d35f6eb79853b156ce` |
| Tracked marketing page sources vs `f70b03be` | **Identical** (no dirty tracked Pricing/Contact/Home/Features/Walkthrough/Trust page files) |
| Destructive git ops during release prep | **None found** in reflog (only normal commits) |
| Untracked showroom-preview lab routes | Present locally; **not** required by live `/features` (all *used* showroom assets are tracked) |
| Local `.env.local` regression found | Calendly had been set to `/30min` — **corrected** to approved `/new-meeting` (gitignored) |

Rendered local (http://localhost:3001, cwd `marketing/`) matches the approved redesign generation:

- Contact: “We'd love to hear from you.” / LET'S CONNECT  
- Pricing: plans-first Gather/Celebrate/Flourish · no Custom card · Weven “friends” · Guided self-setup  
- Walkthrough / Trust: redesigned copy (not Sandbox-old)

---

## 2. Exact local identity

```
Directory: /Users/jensmac/Developer/wevenu-website
Branch:    feat/spaces-booking-e1-smart-fields
HEAD:      b9741d59 Document marketing Preview URL and final release tip SHA.
Marketing code tip: f70b03be (ancestor of HEAD; no marketing code delta after it)
Worktrees: several unrelated (luv-gate2, public-forms, occupancy) — not used for this marketing site
Staged: none
```

Dev server already running from the correct directory: `marketing/` on port **3001**.

---

## 3. Was local altered during release preparation?

| Item | Altered? |
|---|---|
| Tracked marketing redesign sources | **No** — committed as `d138de6e` / tip `f70b03be`; working tree still matches |
| Local Calendly URL in `.env.local` | **Yes (regression)** — was `/30min`; restored to `/new-meeting` |
| Launch V1 display env in `.env.local` | **Was missing** (caused fail-closed CTAs vs approved Get Started captures) — **restored** |
| Untracked assets / docs | Untouched; preserved |

Release preparation did **not** overwrite approved page implementations. The earlier wrong conclusion that “Preview ≠ approved” was largely **Sandbox lag** + **missing Launch V1 Preview env**, not loss of local code.

---

## 4. Discrepancy matrix (rendered)

| Page | Local (approved) | Sandbox `f22b8c14` | Corrected Preview | Production (untouched this pass) |
|---|---|---|---|---|
| **Pricing** | Plans-first · Get Started (with Launch V1 env) · first 100 | **OLD** hospitality lead · Custom card · different section order | **Matches local structure + Get Started** · founding remaining **94** (CRM) | Same code · still fail-closed (no Prod Launch V1) · founding **64** |
| **Contact** | Approved redesign | **OLD** “Reach the team…” | **Matches local** | Matches local structure |
| **Walkthrough** | Redesign + Calendly `new-meeting` | **OLD** “Pick a time…” | Matches local | Matches local |
| **Trust** | “Trust is earned. Every day.” | **OLD** “isn't something you ask for” | Matches local | Matches local |
| Home / Product / Features / Our Story | Same generation | Same generation | Same | Same |

Screenshots: `docs/design/marketing-local-truth/screenshots/`

---

## 5. Root cause of each discrepancy

1. **Sandbox Pricing/Contact/Walkthrough/Trust wrong**  
   - Cause: Sandbox still serves ECS image `f22b8c14` — **never redeployed** with marketing RC `d138de6e`/`f70b03be`.  
   - Not a local code loss.

2. **Preview previously showed Contact-us / unavailable on Pricing**  
   - Cause: Preview lacked `PRICING_LAUNCH_V1` + V1 price/coupon IDs. Approved local captures used Launch V1 process env (`docs/design/pricing-v1-reconciliation`).  
   - **Fixed:** Preview-only env added (Production Stripe secrets untouched).

3. **Founding “100” local vs “94” Preview**  
   - Cause: Preview has Supabase CRM → live remaining-spots calculation. Local without durable founding grants shows capacity **100**.  
   - Intentional runtime difference when CRM is connected; not a missing file.

4. **Production fail-closed Pricing CTAs**  
   - Cause: Launch V1 env was **not** applied to Production (hard stop / no Prod config change this pass).  
   - Production still serves RC page code from earlier promote, but CTA mode differs from approved Launch V1 visual.

5. **Excluded showroom-preview**  
   - Not a customer-facing gap: live Features uses tracked `features-showroom` assets; preview lab routes remain local-only.

---

## 6. Exact corrections made

| Correction | Scope |
|---|---|
| Restored `marketing/.env.local` Calendly → `…/new-meeting` + Launch V1 display keys | Local gitignored only |
| Documented Launch V1 keys in `marketing/.env.example` | Tracked |
| Added **Preview-only** Vercel env: `PRICING_LAUNCH_V1`, `PRICING_WEVEN_V1`, Gather/Growing/Professional/White Glove/Weven price + coupon IDs | Preview only · Production Stripe secrets unchanged |
| Redeployed Preview from `f70b03be` so new env applies | Preview only |
| **No** page redesigns, **no** Sandbox deploy, **no** Production promote/rollback |

---

## 7. Local vs corrected Preview

| Check | Local | Preview `dpl_i4c3SmFddfqrjtyPUHkwP7599jeD` |
|---|---|---|
| Pricing H1 | One platform… | Same |
| Get Started CTAs | Yes | Yes |
| Unavailable banner | No | No |
| Contact H1 | We'd love to hear from you. | Same |
| Walkthrough | Let's talk… + `new-meeting` | Same |
| Trust | Trust is earned… | Same |
| Founding remaining phrase | first **100** | first **94** (CRM) |

---

## 8. Corrected release identity

| Field | Value |
|---|---|
| Release SHA (marketing code) | **`f70b03be6212b87cf2e113d35f6eb79853b156ce`** |
| Verified Preview URL | https://hello-to-cheers-2v4wh3xsb-hello-77130364s-projects.vercel.app |
| Deployment | `dpl_i4c3SmFddfqrjtyPUHkwP7599jeD` |
| Docs tip commit (optional follow-up) | `b9741d59` + pending `.env.example` update |

No new marketing page SHA required — approved local implementation was already in `f70b03be`. The missing piece was **Preview Launch V1 configuration** (+ local Calendly env correction).

---

## 9. Remaining issues

1. **Sandbox** still on old marketing pages until an authorized Sandbox marketing deploy of `f70b03be`.  
2. **Production** still fail-closed on Pricing CTAs (Launch V1 not enabled there by design this pass).  
3. Preview founding remaining (**94**) vs local (**100**) while CRM connected — expected soft-100 display behavior.  
4. Production currently still hosts the earlier promote of this RC code; no Production action taken under the hold.  
5. Facebook Sharing Debugger still requires a logged-in Meta session for scrape refresh.

**Recommendation:** Treat corrected Preview as the verification target for the approved local website. Authorize Sandbox deploy next if you want Sandbox to stop showing the old Pricing/Contact. Production remains on hold.
