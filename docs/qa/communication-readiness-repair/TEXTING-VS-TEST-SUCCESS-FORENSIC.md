# Communication Readiness — Texting “Not ready” vs “Test message successful”

**Generated:** 2026-10-13  
**Mode:** Read-only forensic. No code/DB/config/deploy changes. No email or SMS sent.  
**Production:** untouched.  
**Related prior GREEN work:** `STATUS.md` (status definitions + SMS button gate) — this report does **not** reopen that repair; it investigates the remaining cross-channel checklist inconsistency.

---

## Screenshot inconsistency (as stated)

| UI element | Observed |
|------------|----------|
| Texting setup | Not ready yet; enable in Settings → Communications |
| Send test text | Disabled |
| Test message successful | Ready — “A test message was accepted by the delivery provider.” |

---

## 1. Source of “Texting setup” / Send test text enabled

| Concern | Source |
|---------|--------|
| Configured? | `getCommunicationReadiness()` → `isSmsConfigured(venue.id)` (`lib/communication/readiness.ts`) |
| Checklist item | `key: "sms"`, label `"Texting setup"`, `not_ready` detail: `"Not ready yet. Enable text messaging for your venue in Settings → Communications."` |
| Button enable | Client: `isSmsTestActionAvailable({ smsConfigured, venuePhone })` (`lib/communication/test-send.ts`) — requires **both** `smsConfigured` and non-empty `venuePhone` |
| UI | `components/communication/readiness-checklist.tsx` — `disabled={sendingSms \|\| !smsAvailable}` + helper copy when `!smsConfigured` |

**Confirmed:** When texting is unconfigured, Send test text stays disabled and copy states the provider will not be called.

---

## 2. Source of “Test message successful”

| Concern | Source |
|---------|--------|
| Persistence | `venues.communication_test_email_at` **OR** `venues.communication_test_sms_at` |
| Calculation | `testedOk = !!(communication_test_email_at \|\| communication_test_sms_at)` — **channel-agnostic OR** |
| Checklist item | `key: "test_message"`, label always `"Test message successful"` |
| Ready detail | Always `"A test message was accepted by the delivery provider."` — **no channel, no timestamp in the detail string** |
| Writers | `sendTestEmail()` → updates **only** `communication_test_email_at`; `sendTestSms()` → updates **only** `communication_test_sms_at` |

**Verified meaning of success state:** Latest successful **email and/or SMS** test acceptance is collapsed into one boolean. An email-only success marks the item `ready` even when SMS was never tested and texting is `not_ready`.

Not stale client-only state: after `sendTestEmail`, UI calls `refresh()` → `getCommunicationReadinessAction()` reloads from DB. The OR is **server-side persisted**.

---

## 3. Channel / timestamp / venue context on the success record

| Field | Stored? |
|-------|---------|
| Channel | **Separate columns** (`*_email_at` vs `*_sms_at`) — but **UI does not expose which** |
| Timestamp | ISO on the column that was written — **not shown** in checklist detail |
| Venue | Row scoped by `venues.id` |
| Provider result id | Not stored on venue row (only acceptance timestamp) |

---

## 4. Can an email test visually imply SMS success?

**Yes — labeling / aggregation defect.**  
Email success sets `testedOk` true → checklist shows “Test message successful” next to “Texting setup / Not ready yet” and a disabled Send test text. A reader can reasonably infer a text test succeeded. The code does **not** set `communication_test_sms_at` from email.

---

## 5. Unconfigured SMS cannot invoke the provider

**Confirmed in code:**

```ts
// sendTestSms — short-circuit before sendSms
const smsConfigured = await isSmsConfigured(venue.id);
if (!smsConfigured) {
  return { ok: false, message: SMS_TEST_NOT_CONFIGURED_MESSAGE };
}
```

Regression seams: `lib/communication/test-send.test.ts` asserts the guard appears before `sendSms` and that the UI disables when unconfigured.

Prior QA (`STATUS.md`, Fancy unconfigured): Send test text disabled; copy that provider will not be called — **GREEN for the button gate**, not for the shared “Test message successful” label.

---

## 6. Existing evidence

| Evidence | What it shows |
|----------|----------------|
| `reproduce-results.json` (pre-repair) | Fancy: SMS `not_ready`, yet `test_message` `ready` after email path (older success copy) |
| `STATUS.md` / browser verify | Email test feedback + SMS disable when unconfigured |
| `test-send.test.ts` | SMS short-circuit seam; email success copy ≠ Delivered |

**Not proven this pass (no new browser run):** live Fancy/Meadowbrook row timestamps for `communication_test_*_at` at screenshot time — root cause is established from code + prior evidence pattern.

---

## Root cause (verified)

**Combination: copy/labeling + aggregated readiness rule.**

Single checklist item `"Test message successful"` is driven by `email_at OR sms_at`, with channel-neutral wording. Functional SMS send remains correctly blocked when unconfigured; the inconsistency is **truthfulness of the checklist item relative to texting**, not an SMS send leak.

---

## Smallest scoped fix recommendation (not implemented)

1. Split into two items **or** make the existing item channel-aware, e.g.  
   - “Test email successful” ↔ `communication_test_email_at`  
   - “Test text successful” ↔ `communication_test_sms_at` (untested/not applicable when SMS not configured)  
2. Or keep one item but detail must name the channel(s) and never read as SMS success from email-only.  
3. Do not change `isSmsConfigured` / send short-circuit (already correct).

### Focused regressions to add when authorized

1. Successful email test + texting unconfigured → email success shown; SMS item remains not_ready; Send test text disabled; **no** SMS-success implication.  
2. `sendTestSms` with SMS unconfigured → returns `SMS_TEST_NOT_CONFIGURED_MESSAGE`; `sendSms` not invoked.  
3. Successful SMS test only when configured + provider accept → sets `communication_test_sms_at`.  
4. Independent display of email vs SMS test results after refresh.  
5. Refresh/reload preserves DB-backed timestamps (not toast-only).

---

## Confirmed vs hypothesis vs next step

| Confirmed | Hypothesis | Next authorized step |
|-----------|------------|----------------------|
| OR aggregation in `getCommunicationReadiness` | Screenshot venue has non-null `communication_test_email_at` and null `*_sms_at` | Optional read-only DB check of that venue’s two columns |
| SMS send gated before provider | — | Implement split/channel-aware checklist when approved |
| Prior repair fixed button + status defs | — | Do not reopen unrelated readiness items |

**Implementation (2026-10-13):** Split into `test_email` / `test_sms` via `buildChannelTestReadinessItems` (`lib/communication/readiness-channel-tests.ts`). Email-only success no longer implies SMS test success. See `docs/qa/email-consistency-audit/STATUS.md`.
