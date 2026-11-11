# HTC Texting — Self-Service ISV Design Audit (REVISED)

**Status:** Design / audit only — **no implementation in this pass.**  
**Revised:** 2026-09-21 (after Console verification of Primary Profile)  
**Supersedes:** earlier draft that incorrectly treated “QuickCloud LLC” Primary naming as a blocking gap.

---

## Absolute safety constraints (locked)

| Constraint | Status |
|---|---|
| Production untouched | Required |
| Do **not** create/modify/replace/resubmit/delete Primary Compliance Profile | Locked |
| Do **not** mutate QuickCloud approved Brand / Campaign / phone / MS | Locked |
| Do **not** share QuickCloud sender with any other venue | Locked |
| Do **not** repair/convert Jen’s Fancy synthetic stack | Locked |
| Do **not** submit real A2P registrations during this audit | Observed |
| Every step idempotent + resumable | Required |
| Uncertain Twilio dependency → STOP and verify | Required |

---

## 1. Does the verified QuickCloud LLC Primary Profile satisfy the ISV prerequisite?

**Yes.**

| Field | Verified value | Source |
|---|---|---|
| Primary Compliance Profile | QuickCloud LLC | Twilio Console (independent verification) |
| Status | Approved | Console |
| Business Identity | **ISV Reseller** | Console |
| Primary Profile SID | `BUc864a49a4cddc4ec348cff74d4d18095` | Console + read-only Trust Hub API |
| Parent AccountSid | `AC…f2828f64 (denylist; see twilio-protected-resources.ts)` | Sandbox secret `htc/sandbox/twilio` |

Twilio’s ISV overview requires an approved Primary Customer Profile with Business Identity **ISV Reseller or Partner**, then Secondary Profiles for each customer business. That is exactly this setup.

**Interpretation (corrected):**

- **QuickCloud LLC** = legal/business entity operating Hello to Cheers (the ISV).
- **Hello to Cheers** = the SaaS product.
- Do **not** create a second Primary Profile for “Hello to Cheers.”
- Do **not** modify `BUc864a49a4cddc4ec348cff74d4d18095`.

Parent-account API probe also shows Secondary Customer Profile creation under venue subaccounts already works (QuickCloud venue Secondary `BU8e544299…` is `twilio-approved`).

---

## 2. Exact Twilio architecture HTC will use

**Twilio ISV Architecture #1** (preferred / recommended by Twilio):

- Parent account uses subaccounts mapped **1:1 to customers**.
- Messaging Services are used.
- Traffic isolation: one customer’s noncompliance should not contaminate others.

```
QuickCloud LLC parent (ISV)
  Primary Profile BU…c864… (immutable)
  │
  ├─ Venue A subaccount AC…
  │    Secondary Profile (Venue A business)
  │    Brand (Venue A)
  │    Messaging Service (Venue A)
  │    Campaign(s) (Venue A use case)
  │    Phone number(s) (Venue A sender)
  │
  └─ Venue B subaccount AC…
       …same isolation…
```

HTC code already models this via `venue_twilio_accounts` + `resolveVenueTwilioForSend(venueId)` fail-closed.

---

## 3. Parent vs venue resource ownership

### Parent only (ISV)

| Resource | Notes |
|---|---|
| Parent AccountSid | Platform |
| Primary Profile `BUc864a49a4cddc4ec348cff74d4d18095` | **Immutable** |
| Parent Twilio credentials (`htc/{env}/twilio`) | Subaccount create + Event Streams admin |
| Optional: ISV-owned Brand/Campaign if HTC itself sends ISV traffic | Not required for venue texting |

### Per venue (customer)

| Resource | Persisted on |
|---|---|
| Subaccount `AC…` | `venue_twilio_accounts.twilio_account_sid` UNIQUE |
| API key + auth token | Secrets Manager `htc/{env}/twilio/venues/{AC…}` only |
| Messaging Service `MG…` | `messaging_service_sid` |
| Secondary Profile `BU…` | `secondary_profile_sid` (venue business details) |
| A2P Trust Product `BU…` | add column `a2p_trust_product_sid` |
| Brand `BN…` | `a2p_brand_sid` |
| Campaign `QE…` | `a2p_campaign_sid` |
| Phone `PN…` + E.164 | `phone_number_sid`, `default_from_e164` |

**Critical compliance boundary:** Secondary Profile + Brand + Campaign must use **the venue’s business details**, never QuickCloud LLC / HTC ISV details. Twilio states this explicitly for ISV customer registration.

---

## 4. Verified dependency / order (from current Twilio ISV API guide)

Source of truth for sequence: [A2P 10DLC Standard/LVS Brand Onboarding Guide for ISVs](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/onboarding-isv-api).

### Documented order

| Step | Twilio section | Hard gate? |
|---|---|---|
| 1. Secondary Customer Profile (create, attach EndUsers/docs, assign to Primary, evaluate, submit) | §1 | May continue before Secondary `twilio-approved` |
| 2. A2P Trust Product (create, attach, evaluate, submit) | §2 | May continue before TrustProduct approved |
| 3. BrandRegistration | §3 | Fee-incurring; rate-limit 1 rps |
| 4. **Wait until Brand `status = APPROVED`** | Caution before §5 | **Hard gate** |
| 5. Create Messaging Service (new MS for A2P; configure inbound/fallback URLs) | §4 | After Brand approved in the official guide order |
| 6. Fetch available Use Cases for Brand+MS | §5.1 | Brand must be APPROVED |
| 7. Create Usa2p Campaign on Messaging Service | §5 | Brand must be APPROVED |
| 8. Add 10DLC phone number to Messaging Service | §6 | After Campaign created (ISV API guide) |
| 9. Await phone A2P registration | Event Streams number-registration.* | Async |

### HTC product sequencing (infra vs compliance)

To give venues a “Setting up” experience before they finish the questionnaire, HTC may create **subaccount + credentials + Messaging Service + webhooks** as soon as texting is enabled. That does **not** contradict Twilio: Messaging Service creation does not require Brand. The **hard Twilio gate** is: **do not create Campaign until Brand is APPROVED**.

**Recommended HTC job order:**

```
Enable texting
  1 create_subaccount
  2 create_api_key
  3 store_secret
  4 create_messaging_service   ← allowed early
  5 configure_webhooks
  → UI: Setting up → Details needed

Venue submits validated questionnaire + attestation
  6 submit_secondary_profile   (venue business; assign to Primary BUc864…)
  7 submit_a2p_trust_product
  8 submit_brand
  → UI: Under review  (only after Brand/Secondary actually submitted)
  9 await_brand_approved       (Event Streams + reconcile)
 10 fetch_usecases
 11 submit_campaign            (Brand APPROVED required)
  → UI: Under review (campaign pending)
 12 await_campaign_verified
 13 buy_number                 (see open verification note below)
 14 attach_number_to_ms
 15 await_number_a2p_registered
 16 mark_ready                 (isVenueTwilioSendReady)
```

### Open verification note (must resolve in Sandbox E2E — do not guess)

Twilio’s **ISV API guide** adds the phone **after** Campaign create (§6).  
Twilio’s **Direct Standard Console guide** says a Campaign’s Messaging Service should have **at least one** 10DLC number **before** Campaign submission.

These conflict. Implementation rule:

1. Prefer ISV API guide for Architecture #1 automation.
2. In the first disposable Sandbox E2E, attempt Campaign create **without** a number (ISV path).  
   - If Twilio accepts → keep buy/attach **after** Campaign VERIFIED (minimizes stranded numbers).  
   - If Twilio rejects for missing sender → buy+attach **after Brand APPROVED and before Campaign**, then proceed.  
3. Document the observed outcome in the E2E report before enabling the feature flag.

**Do not buy numbers before Brand approval.** That wastes inventory if Brand fails.

---

## 5. What HTC must collect from a venue

Reuse `venue_texting_registrations` fields (already present), with UX clarifying legal vs display name:

**Business identity (Secondary Profile / Brand)**

- Legal business name (not only venue display name)
- Website, address, country, contact email/phone
- Business type, industry, registration ID type + EIN (encrypted)
- Regions of operation
- Authorized representative (name, email, phone, title, job position)

**Messaging use case (Campaign)**

- Category multi-select (inquiry / tour / planning / payments / contracts / other logistics) → assembled Campaign description
- Sample messages (≥2)
- Opt-in surface selection + opt-in description aligned to **live** HTC forms
- Privacy / Terms attestation (Campaign payload uses HTC canonical URLs — see §6)

**Attestation checklist** before submit (phone ≠ consent, optional SMS, honor STOP, accurate business info).

---

## 6. Existing HTC consent / compliance code to reuse (do not fork)

| Asset | Role |
|---|---|
| `lib/communication/sms-consent.ts` | Checkbox language, optional hint, disclosures |
| Inquiry + tour forms | Live opt-in surfaces |
| `communication_permissions` | Persisted SMS permission; outbound gate |
| STOP/START/HELP handling | Unchanged |
| `lib/texting-registration/a2p-campaign-payload.ts` | MessageFlow, samples, keywords (**no YES**), HTC Privacy/Terms/evidence URLs |
| `marketing/.../sms-opt-in` | Public reviewer evidence |

**Preserve exactly:**

- phone number ≠ SMS consent  
- preferred contact method ≠ SMS consent  
- Terms/Privacy acceptance ≠ SMS consent  
- SMS optional; inquiry/tour possible without SMS  
- fail-closed outbound without `opted_in`  

Campaign MessageFlow must describe **this live flow**, not a hypothetical future flow. Promote the existing builder; do not invent a second consent system to “make Twilio happier.”

---

## 7. Idempotency model

**Key:** `{venue_id}:{provisioning_generation}:{step}` UNIQUE  
**Rule:** If the SID for that step is already persisted → **skip create**; sync status only.

| Step | Persist before next | Duplicate prevention |
|---|---|---|
| create_subaccount | `twilio_account_sid` | If set, never create another |
| create_api_key / store_secret | Secrets Manager; validate load | If secret loads for AccountSid, skip |
| create_messaging_service | `messaging_service_sid` | If set, skip |
| configure_webhooks | step row succeeded | Idempotent PUT |
| submit_secondary_profile | `secondary_profile_sid` | Never second BU for same generation |
| submit_a2p_trust_product | `a2p_trust_product_sid` | Same |
| submit_brand | `a2p_brand_sid` | Same |
| submit_campaign | `a2p_campaign_sid` | Resubmit updates existing Usa2p via MS; never second Campaign for same MS |
| buy_number | `phone_number_sid` + E.164 | If set, skip buy |
| attach_number | step succeeded | If already in sender pool, skip |

Partial failure: keep successful SIDs; resume at first incomplete step.  
Never “start over” by creating a second Brand/Campaign because a later step failed (Twilio-documented cleanup hazard).

---

## 8. Partial failure recovery

| Failure class | Behavior |
|---|---|
| Retryable (5xx, 429, network, lease expiry) | Backoff (Facebook/QB pattern: ~8 attempts, exponential) |
| Venue data rejection (Brand/Campaign FAILED with fixable errors) | `needs_attention` + human copy; lock Twilio SIDs; allow edit + resubmit **in place** |
| Terminal infra (quota, unrecoverable) | `failed`; ops alert; no silent retry forever |
| Mid-pipeline success then later fail | Preserve SIDs; do not delete Brand/Campaign/Profile |

**Resubmit after rejection:** update/resubmit the existing Brand or Usa2p Campaign (Twilio supports rejected campaign resubmit via Messaging Service SID). Do not create a second BN/QE unless Twilio returns a hard “must create new object” error — then bump `provisioning_generation` explicitly and log why.

---

## 9. Status synchronization (source of truth)

| State | Primary signal | Safety net |
|---|---|---|
| Secondary / TrustProduct status | Trust Hub `StatusCallback` + GET | Reconcile every 15–30 min |
| Brand | Event Streams brand-registration.* | GET BrandRegistration |
| Campaign | Event Streams campaign-registration.* | GET Usa2p on MG |
| Phone A2P | Event Streams number-registration.* | Phone registration report / GET |
| HTC Ready | Derived: `isVenueTwilioSendReady` | Recompute on every sync |

**Event Streams types to subscribe (current docs):**

Brand (6) + Campaign (3) + Number registration/deregistration (6).

**Venue mapping:** `data.accountsid` → `venue_twilio_accounts.twilio_account_sid` first; fallback BrandSid / CampaignSid / MessagingServiceSid.

**Do not rely on a single synchronous create response** for terminal approval.

---

## 10. What exactly makes a venue “Ready”?

Existing gate (keep — fail closed):

```
status === "ready"
AND twilio_account_sid
AND messaging_service_sid
AND default_from_e164
AND phone_number_sid
```

Plus operational confirmation on sync:

- Campaign `campaign_status` VERIFIED (or equivalent approved)
- Number registration successful (Event Streams or reconcile)
- Secret loadable for AccountSid

UI **Ready** only when this gate is true. Never when “we submitted something.”

---

## 11. What exactly causes “Needs attention”?

Venue-facing `needs_attention` when:

- Brand `FAILED` / secondary vetting failure with correctable feedback  
- Campaign `FAILED` / rejection (e.g. consent MessageFlow issues such as 30923-class)  
- Secondary Profile `twilio-rejected` with fixable field errors  
- Pre-submit HTC validation failure (does not reach Twilio)

Not needs_attention:

- Waiting on Brand/Campaign review → **Under review**  
- Infra still creating subaccount/MS → **Setting up**  
- Campaign approved, number not yet registered → **Setting up number**

---

## 12. Rejected Brand/Campaign correction without duplicates

1. Persist rejection into `attention_*` + `support_debug` (raw Twilio errors ops-only).  
2. Unlock only the fields implicated by the rejection mapping.  
3. Venue edits → Resubmit.  
4. Worker updates **existing** Secondary/Brand/Campaign resources.  
5. Unique DB constraints on BN/QE/MG/PN prevent accidental second inserts.  
6. Generation bump only on explicit “must recreate” Twilio outcomes.

---

## 13. Protecting existing approved QuickCloud resources

### Immutable denylist (hard-code in worker)

| Resource | SID / value | Action |
|---|---|---|
| Parent Primary Profile | `BUc864a49a4cddc4ec348cff74d4d18095` | Never update/resubmit/delete |
| QuickCloud venue_id | `0149e0d4-3cd9-459a-a9a2-6c5e2b30869e` | Exclude from self-service mutate paths |
| Subaccount | `AC…1e2b351d (denylist; see twilio-protected-resources.ts)` | Never recreate |
| Messaging Service | `MG4e1f566d614667068a57ad9a63dad994` | Never reconfigure in automation |
| Phone | `+15083749761` / `PNe61f3b76f5bdfc3e502828384234aedc` | Never release/move |
| Brand | `BN6dd5457b78fc5a24380b3cd9ca72b045` | Never mutate |
| Campaign | `QE2c6890da8086d771620e9b13fadeba0b` | Never mutate |
| Secondary | `BU8e544299aba2aa6b77d694f135a85928` | Never mutate |

These are **reference/validation only**. Self-service must create **new** resources under **new** venue subaccounts.

### Jen’s Fancy (synthetic)

| Field | Value |
|---|---|
| venue_id | `a415ac52-cd74-42a6-8df7-7a8f6e71d080` |
| Subaccount | `AC…03cb5f14 (denylist; see twilio-protected-resources.ts)` |
| Status | `pending_compliance` with explicit synthetic block in `status_detail` |
| Profile/Brand/Campaign/Phone | null |

**Do not** attempt to make this account compliant. Mark `synthetic=true` (or denylist) so workers refuse A2P submission.

---

## 14. Preventing cross-venue contamination

| Control | Mechanism |
|---|---|
| Architecture #1 isolation | One subaccount per venue |
| Send path | `resolveVenueTwilioForSend(venueId)` only |
| Inbound/status | AccountSid → `venue_twilio_accounts` |
| Secrets | Per AccountSid path; never shared |
| Unique SID constraints | Prevent SID reuse across venues |
| Campaign/MS binding | One Campaign per MS (Twilio); one MS per venue in v1 |

---

## 15. Customer-facing states (honesty rules)

| UI state | When |
|---|---|
| Not started | Never enabled |
| Details needed | Questionnaire incomplete / editable |
| Setting up | Infra jobs running; **no** compliance submission yet |
| Under review | Real Twilio review artifact exists (Brand/Campaign/Secondary pending-review/in-review) |
| Needs attention | Fixable rejection / missing venue data |
| Setting up number | Campaign verified; phone buy/attach/A2P registration in progress |
| Ready | `isVenueTwilioSendReady` |
| Paused / Failed | Suspended or terminal infra failure |

**Fix required in implementation:** stop mapping bare `pending_compliance` → “Under review” when no SIDs / no `compliance_submitted_at` (Jen’s Fancy honesty bug).

---

## 16. Current HTC code gaps (reuse map)

| Exists | Gap |
|---|---|
| `venue_twilio_accounts` + secrets + send/inbound | No automated create path |
| `OpsFirstTextingProviderOrchestrator` deferred | Replace with live enqueue orchestrator |
| Questionnaire + validation + attention | Need `setting_up` phase + honesty |
| `a2p-campaign-payload.ts` | Promote to sole Campaign builder |
| SMS consent stack | Reuse unchanged |
| Facebook/QB queue claim/backoff | Pattern for provisioning steps |
| No Event Streams sink | Must add |
| No step table | Must add |

---

## 17. Sandbox-only E2E proof (disposable venue)

**Do not use QuickCloud or Jen’s Fancy.**

1. Create disposable venue `HTC Texting E2E {date}` with cleanup marker.  
2. Enable texting → assert new AC/MG/secret; UI Setting up / Details needed.  
3. Complete questionnaire with real (non-synthetic) test business data.  
4. Submit → Secondary/TrustProduct/Brand SIDs appear; Under review only after submit evidence.  
5. Wait Brand APPROVED (events + reconcile).  
6. Resolve phone-before-vs-after Campaign question (record outcome).  
7. Campaign VERIFIED → number attached → number-registration.successful → Ready.  
8. Send/receive Sandbox SMS; confirm AccountSid isolation.  
9. Rejection drill: induce correctable Campaign failure → Needs attention → edit → resubmit → **same** Campaign SID.  
10. Cleanup disposable resources; **assert QuickCloud denylist SIDs unchanged**.

Success standard: a brand-new venue completes setup without Ops manually creating Twilio resources, without duplicates, without mutating approved QuickCloud resources.

---

## 18. Explicit answers checklist

| Question | Answer |
|---|---|
| Primary Profile OK? | **Yes** — QuickCloud LLC, Approved, ISV Reseller, `BUc864…` — do not modify |
| Architecture | Twilio ISV **#1**: 1 venue = 1 subaccount + own MS/Brand/Campaign/phone |
| Parent vs venue | Primary+parent creds on parent; all customer messaging identity in venue subaccount |
| Order | Secondary → TrustProduct → Brand → **wait APPROVED** → (MS if not early) → Campaign → phone → A2P number ready; verify phone-vs-campaign timing in E2E |
| Collect from venue | Legal business + rep + use-case categories + samples + opt-in surfaces + attestation |
| Consent reuse | Existing inquiry/tour/`communication_permissions`/A2P MessageFlow — no second system |
| Idempotent how? | Persist SID per step; unique keys; skip if present |
| Partial failure | Resume; never duplicate Brand/Campaign |
| Sync | Event Streams + StatusCallbacks + reconcile GET |
| Ready | `isVenueTwilioSendReady` + campaign verified + number registered |
| Needs attention | Fixable Twilio/venue data rejection |
| Rejection | In-place resubmit; unique constraints |
| Protect QuickCloud | Hard denylist of SIDs/venue_id; no shared sender |
| Isolation | Subaccounts + AccountSid routing + fail-closed resolver |
| E2E | New disposable venue only; cleanup; QuickCloud unchanged |

---

## 19. Implementation gate

**Do not implement until this audit is accepted.**

When implementation is authorized:

1. Schema + step worker behind feature flag (Sandbox only).  
2. Denylist + synthetic exclusion first.  
3. Disposable E2E including phone-order verification.  
4. Honesty UI fix.  
5. Only then consider wider Sandbox enablement.  
6. Production remains untouched until a separate approval.

**Standard:** not “Twilio API returned 201.” Standard: new venue self-serves to Ready, isolated, idempotent, consent-truthful, QuickCloud untouched.
