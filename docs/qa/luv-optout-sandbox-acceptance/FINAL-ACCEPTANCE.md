# LUV-OPTOUT — Final Sandbox acceptance (GREEN / CLOSED)

**Disposition:** **GREEN / CLOSED** (documentation PR for founder merge review; product already on Sandbox `cfeca21a`).  
**Authoritative register:** [`docs/launch/LAUNCH-READINESS.md`](../../launch/LAUNCH-READINESS.md)  
**Desktop:** `~/Desktop/HTC-LUV-OPTOUT-acceptance/`  
**Package:** this directory (`ACCEPTANCE-REPORT.md`, matrices, `screenshots/`)

---

## Deployment

| Item | Result |
|------|--------|
| PR #111 approved head | `a36fa488a1b416282641b7d98aa576361cdc3d7c` |
| Merge SHA | `cfeca21abc933618d57c8f3835fc7405a18f28be` |
| Migration | `20270204120000_luv_settings_master_enabled.sql` — Apply Sandbox Migration [44639439697](https://github.com/jlcormier612/wevenu-website/actions/runs/44639439697) **SUCCESS** |
| Deploy Sandbox | [44639726149](https://github.com/jlcormier612/wevenu-website/actions/runs/44639726149) **SUCCESS** |
| Serving SHA (ECS + `dpl=`) | `cfeca21abc933618d57c8f3835fc7405a18f28be` |
| ECS | venue `:1237` / marketing `:1215` / workspace `:1216` / scheduler `:1164` — rollouts **COMPLETED**, running=desired=1 |
| Health | `GET /api/health` → `{"ok":true,"checks":{"env":"ok","supabase":"ok"}}` |
| Sandbox CloudWatch alarms | All **OK** |
| Production | Untouched |

---

## Product behavior accepted

Venue-level **Enable Luv** master (`public.luv_settings.enabled`, DEFAULT `true`):

- **OFF** hides relevant staff, client, and guest Luv interfaces (dashboard Luv CTAs, lead/event Luv surfaces, portal Ask Luv UI, wedding-website guest concierge).
- Nested Settings (observations, drafting, preferred tone) remain visible but disabled while master is OFF; values are preserved.
- Direct draft / roll-up / observation / recommendation routes **block** while OFF (staff APIs return **403**).
- Portal Ask returns **HTTP 200** with `outcome=unavailable` **by design**, with **no** Luv signal write and **no** AI activity.
- **13** pending drafts and nested preferences remained unchanged across OFF → ON.
- Re-enable restored the previous configuration.
- Multi-venue isolation (Fancy OFF did not change Meadowbrook) and ordinary Focus/dashboard + Messages workflows passed.

---

## Live Sandbox verification vs code-only / partial

| Case | Mode |
|------|------|
| Migration apply + OpenAPI/`luv_settings.enabled` reads | **LIVE** Sandbox |
| Merge + Deploy Sandbox + ECS / `dpl=` / health / alarms | **LIVE** Sandbox |
| Browser Settings OFF/ON; dashboard / lead / event / portal / website | **LIVE** Sandbox |
| Staff API gates: draft POST, roll-up POST, observation PATCH, recommendation PATCH | **LIVE** Sandbox (403 while OFF) |
| Portal Ask API unavailable response | **LIVE** Sandbox (200 + `outcome=unavailable`, no AI/signal) |
| Spot-pattern recommendation manufacture under OFF | **CODE-GATED** (unit/source contracts) — **not live-triggered** (avoid further paid AI) |
| Stale-tab / long-lived client bypass beyond server gates | **PARTIAL** — server 403s verified; no full multi-tab stale SPA matrix |
| Independent AI (migration smart-extract, lead-intake email-extract) | **CODE-ONLY** — confirmed **not** master-gated |
| HQ Luv observations for opted-out venues | **CODE** path gated via `isLuvMasterEnabledForVenueId` |
| Vendor-operator Luv | **Intentional boundary** — vendor briefing remains vendor-operator surface, **not** venue `luv_settings` |

---

## Safety / OpenAI during the test exercise

**Do not claim zero OpenAI calls for the complete exercise.**

An **initial harness mistake** (wrong switch selector — Base UI `span[role=switch]` vs `button`) left Enable Luv **ON** and invoked `POST /api/luv/roll-up`, which returned `ok:true` with observations — **likely one paid OpenAI call**. No new `luv_drafts` rows were created from that pass. Corrected OFF-state testing subsequently blocked draft and roll-up with **403**. No uncontrolled email/SMS/Stripe. Production untouched.

---

## Vendor-operator boundary & independent AI

- **Venue master** governs venue staff, client portal, and guest wedding-website Luv for that venue, plus HQ observation generation for that venue id.
- **Vendor-operator Luv** (vendor portal briefing) is intentionally **not** bound to venue `luv_settings` — separate operator surface.
- **Independent AI** used for import / lead email extraction remains operational and is **not** master-gated (source contract in `lib/luv/luv-optout-master.test.ts`).

---

## Residual limitations

1. Spot-pattern manufacture under OFF was not live-fired.
2. Stale-tab acceptance is partial (server gates only).
3. One likely paid OpenAI call occurred during the mistaken ON-state harness roll-up before corrected OFF tests.

---

## Preserved closures

LUV-CONSENT **GREEN/CLOSED** · LUV-FINAL **GREEN** · RESEND-SCALE **GREEN/CLOSED** · NAV-PERF **OPEN** · primary dirty worktree preserved (~746) · no Production · docs-only closure package (no product/schema/deploy in this PR).
